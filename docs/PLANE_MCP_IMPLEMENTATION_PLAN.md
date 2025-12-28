# Implementation Plan - Plane MCP with Multi-Field Credentials

Add [Plane MCP Server](https://github.com/makeplane/plane-mcp-server) with support for multiple credential fields.

## Overview

**Plane Requirements:**
| Env Variable | Required | Source |
|--------------|----------|--------|
| `PLANE_API_KEY` | Yes | User input |
| `PLANE_WORKSPACE_SLUG` | Yes | User input |
| `PLANE_API_HOST_URL` | No | Default: `https://api.plane.so/` |

**Command:** `npx -y @makeplane/plane-mcp-server`

---

## Architecture Changes

### Current Flow
```
PatAuthDialog (single input) → storePat(token) → McpBackendClient({ apiKey: token })
                                                        ↓
                                    Backend mcp.ts → env[envKeyName] = apiKey
```

### New Flow
```
PatAuthDialog (multi-field) → storePatFields({ apiKey, workspaceSlug }) 
                                                        ↓
                              McpBackendClient({ apiKey, fields: {...} })
                                                        ↓
                              Backend mcp.ts → for each (field → envVar) in envMapping
```

---

## File Changes

### Phase 1: Shared Package

#### [MODIFY] [mcpRegistry.ts](file:///c:/Users/User/code/hackathons/chrome-ai/packages/shared/src/constants/mcpRegistry.ts)

```diff
export interface McpServerRegistryEntry {
    id: string;
    command: string;
    args: string[];
    envKeyName?: string;
+   /** Maps credential field names to environment variables. Used for multi-field servers. */
+   envMapping?: Record<string, string>;
    staticEnv?: Record<string, string>;
    enabled: boolean;
}

+ // Add Plane entry
'plane': {
    id: 'plane',
    command: 'npx',
    args: ['-y', '@makeplane/plane-mcp-server'],
    envMapping: {
        'apiKey': 'PLANE_API_KEY',
        'workspaceSlug': 'PLANE_WORKSPACE_SLUG',
    },
    staticEnv: {
        'PLANE_API_HOST_URL': 'https://api.plane.so/',
    },
    enabled: true,
},
```

#### [MODIFY] [mcpRegistry.ts](file:///c:/Users/User/code/hackathons/chrome-ai/packages/shared/src/constants/mcpRegistry.ts) - Request types

```diff
export interface McpStdioRequest {
    serverId: string;
    credentials?: {
        apiKey?: string;
+       /** Additional credential fields for multi-field servers */
+       fields?: Record<string, string>;
    };
}
```

---

### Phase 2: Backend

#### [MODIFY] [mcp.ts](file:///c:/Users/User/code/hackathons/chrome-ai/packages/backend-vercel/src/routes/ai/mcp.ts)

Update env building in BOTH `/discover` and `/execute` handlers:

```typescript
// Build environment from registry config + credentials
const env: Record<string, string> = { ...serverConfig.staticEnv };

// Single-key servers (backward compatible)
if (serverConfig.envKeyName && body.credentials?.apiKey) {
    env[serverConfig.envKeyName] = body.credentials.apiKey;
}

// Multi-field servers (new)
if (serverConfig.envMapping && body.credentials?.fields) {
    for (const [fieldName, envVar] of Object.entries(serverConfig.envMapping)) {
        const value = body.credentials.fields[fieldName];
        if (value) {
            env[envVar] = value;
        }
    }
}
```

---

### Phase 3: Extension Frontend

#### [MODIFY] [mcpServers.tsx](file:///c:/Users/User/code/hackathons/chrome-ai/apps/extension/src/constants/mcpServers.tsx)

Add `fields` to `PatConfig`:

```typescript
/** Field definition for multi-field PAT authentication */
export interface PatConfigField {
    /** Unique field ID (matches envMapping key in registry) */
    id: string;
    /** Display label */
    label: string;
    /** Input placeholder */
    placeholder: string;
    /** Whether field is required */
    required?: boolean;
    /** Use password-style input */
    secret?: boolean;
}

export interface PatConfig {
    // ...existing fields...
+   /** Multi-field configuration. When present, renders multiple inputs. */
+   fields?: PatConfigField[];
}
```

Add Plane server entry:

```typescript
{
    id: "plane",
    name: "Plane",
    icon: <img src={planeImage} alt="Plane" style={{ width: 24, height: 24 }} />,
    initialEnabled: false,
    url: "stdio://plane",
    description: "AI automation for Plane projects, issues, cycles, and modules.",
    requiresAuthentication: true,
    isBackendOnly: true,
    authConfig: {
        type: 'pat',
        patConfig: {
            label: "Plane Credentials",
            placeholder: "",
            helpUrl: "https://plane.so",
            fields: [
                { id: 'apiKey', label: 'API Key', placeholder: 'plane_...', required: true, secret: true },
                { id: 'workspaceSlug', label: 'Workspace Slug', placeholder: 'my-workspace', required: true },
            ]
        }
    }
}
```

#### [MODIFY] [PatAuthDialog.tsx](file:///c:/Users/User/code/hackathons/chrome-ai/apps/extension/src/components/features/mcp/PatAuthDialog.tsx)

Update to support multi-field rendering:

```typescript
interface PatAuthDialogProps {
    // ...existing props...
-   onSubmit: (token: string) => Promise<void>
+   onSubmit: (token: string, fields?: Record<string, string>) => Promise<void>
}

// Inside component:
+ const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
+ const hasMultiField = patConfig.fields && patConfig.fields.length > 0;

// Render multiple inputs when hasMultiField is true
// Submit with fields instead of single token
```

#### [MODIFY] [oauth.ts](file:///c:/Users/User/code/hackathons/chrome-ai/apps/extension/src/mcp/oauth.ts)

Add multi-field PAT storage:

```typescript
export async function storePatFields(serverId: string, fields: Record<string, string>): Promise<void>
export function getPatFields(tokens: McpOAuthTokens): Record<string, string> | null
```

#### [MODIFY] [auth.ts](file:///c:/Users/User/code/hackathons/chrome-ai/apps/extension/src/background/mcp/auth.ts)

Update `startPatAuth` signature:

```typescript
export async function startPatAuth(
    serverId: string,
    token: string,
+   fields?: Record<string, string>
): Promise<McpExtensionResponse>
```

#### [MODIFY] [McpBackendClient.ts](file:///c:/Users/User/code/hackathons/chrome-ai/apps/extension/src/background/mcp/McpBackendClient.ts)

Update constructor and credential sending:

```typescript
constructor(
    private serverId: string,
    private accessToken: string | null,
+   private credentialFields?: Record<string, string>
)
```

#### [MODIFY] [manager.ts](file:///c:/Users/User/code/hackathons/chrome-ai/apps/extension/src/background/mcp/manager.ts)

Pass fields when creating McpBackendClient.

---

## Summary

| File | Change |
|------|--------|
| `packages/shared/src/constants/mcpRegistry.ts` | Add `envMapping`, Plane entry |
| `packages/backend-vercel/src/routes/ai/mcp.ts` | Multi-field env mapping |
| `apps/extension/src/constants/mcpServers.tsx` | Add `PatConfigField`, Plane entry |
| `apps/extension/src/components/features/mcp/PatAuthDialog.tsx` | Multi-field UI |
| `apps/extension/src/mcp/oauth.ts` | Add storage functions |
| `apps/extension/src/background/mcp/auth.ts` | Handle multi-field auth |
| `apps/extension/src/background/mcp/McpBackendClient.ts` | Send fields |
| `apps/extension/src/background/mcp/manager.ts` | Pass fields to client |
