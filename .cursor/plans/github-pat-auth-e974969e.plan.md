<!-- e974969e-528a-4317-953d-bfcc6eef34bd 5e8a1e7c-e7f8-4d59-a70b-5fb86d0c1dd5 -->
# Add GitHub Copilot PAT Authentication

## Overview

Implement PAT-based authentication for GitHub Copilot MCP server since it doesn't support dynamic OAuth registration. The solution will be clean, isolated, and won't interfere with existing OAuth flows.

## Implementation Steps

### 1. Update Server Configuration

**File: `src/constants/mcpServers.tsx`**

Change GitHub server name from "GitHub" to "GitHub Copilot" (line 108):

```tsx
name: "GitHub Copilot",
```

Add a new property to `ServerConfig` interface to mark PAT-based servers:

```tsx
export interface ServerConfig {
    // ... existing properties
    usesPatAuth?: boolean; // True if server uses PAT instead of OAuth
}
```

Mark GitHub server as PAT-based:

```tsx
{
    id: "github",
    name: "GitHub Copilot",
    // ... existing properties
    usesPatAuth: true,
}
```

### 2. Add PAT Storage Types

**File: `src/mcp/types.ts`**

Add new interface for PAT credentials after line 33:

```tsx
/**
 * Personal Access Token stored for servers that don't support OAuth
 */
export interface McpPatCredentials {
    access_token: string;
    created_at: number;
}
```

### 3. Add PAT Storage Utilities

**File: `src/mcp/oauth.ts`**

Add PAT storage functions at the end of the file (after line 390+):

```tsx
/**
 * Get storage key for PAT
 */
function getPatKey(serverId: string): string {
    return `pat.${serverId}.credentials`;
}

/**
 * Store PAT credentials
 */
export async function storePatCredentials(serverId: string, pat: string): Promise<void> {
    const credentials: McpPatCredentials = {
        access_token: pat,
        created_at: Date.now()
    };
    const key = getPatKey(serverId);
    await chrome.storage.local.set({ [key]: credentials });
    console.log(`[PAT:${serverId}] PAT credentials stored`);
}

/**
 * Get stored PAT credentials
 */
export async function getStoredPatCredentials(serverId: string): Promise<McpPatCredentials | null> {
    const key = getPatKey(serverId);
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
}

/**
 * Clear PAT credentials
 */
export async function clearPatCredentials(serverId: string): Promise<void> {
    const key = getPatKey(serverId);
    await chrome.storage.local.remove(key);
    console.log(`[PAT:${serverId}] PAT credentials cleared`);
}
```

### 4. Update Background Service Worker

**File: `src/background.ts`**

Import PAT utilities and types (add to imports around line 27):

```tsx
import { 
    // ... existing imports
    storePatCredentials,
    getStoredPatCredentials,
    clearPatCredentials
} from './mcp/oauth';
import type { McpPatCredentials } from './mcp/types';
```

Update `ServerState` interface to include PAT (around line 56):

```tsx
interface ServerState {
    client: McpSSEClient | null;
    tokens: McpOAuthTokens | null;
    credentials: DynamicClientCredentials | null;
    patCredentials: McpPatCredentials | null; // Add this line
    status: McpServerStatus;
    // ... rest of properties
}
```

Initialize PAT in `getServerState` (line 76):

```tsx
serverStates.set(serverId, {
    client: null,
    tokens: null,
    credentials: null,
    patCredentials: null, // Add this line
    status: { serverId, state: 'disconnected' },
    // ... rest
});
```

Add new PAT authentication handler before `startOAuthFlow` (around line 233):

```tsx
/**
 * Handle PAT authentication for servers that don't support OAuth
 */
async function handlePatAuth(serverId: string, pat: string): Promise<McpExtensionResponse> {
    const state = getServerState(serverId);
    const serverConfig = getServerConfig(serverId);

    if (!serverConfig || !serverConfig.usesPatAuth) {
        return {
            success: false,
            error: 'Server does not support PAT authentication'
        };
    }

    try {
        console.log(`[Background:${serverId}] Storing PAT credentials`);
        
        // Store PAT
        await storePatCredentials(serverId, pat);
        state.patCredentials = { access_token: pat, created_at: Date.now() };
        
        // Update status to authenticated
        state.status = { ...state.status, state: 'authenticated' };
        broadcastStatusUpdate(serverId, state.status);
        
        console.log(`[Background:${serverId}] PAT authentication successful`);
        return { success: true, data: { state: 'authenticated' } };
    } catch (error) {
        console.error(`[Background:${serverId}] PAT auth error:`, error);
        const errorMessage = error instanceof Error ? error.message : 'PAT authentication failed';
        
        state.status = {
            serverId,
            state: 'error',
            error: errorMessage
        };
        broadcastStatusUpdate(serverId, state.status);
        
        return { success: false, error: errorMessage };
    }
}
```

Update `ensureValidToken` to support PAT (around line 545):

```tsx
async function ensureValidToken(serverId: string): Promise<string | null> {
    const state = getServerState(serverId);
    const serverConfig = getServerConfig(serverId);

    // Check if this is a PAT-based server
    if (serverConfig?.usesPatAuth) {
        if (!state.patCredentials) {
            state.patCredentials = await getStoredPatCredentials(serverId);
        }
        return state.patCredentials?.access_token || null;
    }

    // Original OAuth token logic
    if (!state.tokens) {
        state.tokens = await getStoredTokens(serverId);
    }
    // ... rest of existing logic
}
```

Update `disconnectServerAuth` to clear PAT credentials (around line 771):

```tsx
async function disconnectServerAuth(serverId: string): Promise<McpExtensionResponse> {
    console.log(`[Background:${serverId}] Disconnecting and clearing all authentication data...`);
    const state = getServerState(serverId);
    const serverConfig = getServerConfig(serverId);

    disconnectMcpServer(serverId);

    // Clear OAuth data
    await clearTokens(serverId);
    await clearClientCredentials(serverId);
    await clearScopeData(serverId);

    // Clear PAT data if applicable
    if (serverConfig?.usesPatAuth) {
        await clearPatCredentials(serverId);
        state.patCredentials = null;
    }

    // Clear in-memory state
    state.tokens = null;
    state.credentials = null;
    // ... rest of existing logic
}
```

Update `initializeServerStatus` to check for PAT (around line 1005):

```tsx
async function initializeServerStatus(serverId: string): Promise<void> {
    const state = getServerState(serverId);
    const serverConfig = getServerConfig(serverId);

    try {
        // Check for PAT credentials first
        if (serverConfig?.usesPatAuth) {
            const patCreds = await getStoredPatCredentials(serverId);
            if (patCreds) {
                state.patCredentials = patCreds;
                state.status = { ...state.status, state: 'authenticated' };
                console.log(`[Background:${serverId}] Status initialized: authenticated (PAT found)`);
                return;
            }
        }

        // Original OAuth token check
        const tokens = await getStoredTokens(serverId);
        // ... rest of existing logic
    } catch (error) {
        // ... existing error handling
    }
}
```

Add PAT auth message handler in message listener (around line 1068):

```tsx
switch (action) {
    case 'auth/start':
        // Check if this is PAT-based auth with payload
        const serverConfig = getServerConfig(serverId);
        if (serverConfig?.usesPatAuth && message.payload?.pat) {
            response = await handlePatAuth(serverId, message.payload.pat);
        } else {
            response = await startOAuthFlow(serverId);
        }
        break;
    
    case 'auth/update-pat':
        // Handle PAT update
        response = await handlePatAuth(serverId, message.payload?.pat);
        break;
    
    // ... rest of existing cases
}
```

Update `initializeAllServers` to load PAT credentials (around line 1204):

```tsx
if (isEnabled) {
    const serverConfig = getServerConfig(serverId);
    
    // Load PAT credentials for PAT-based servers
    if (serverConfig?.usesPatAuth) {
        const patCreds = await getStoredPatCredentials(serverId);
        if (patCreds) {
            state.patCredentials = patCreds;
            const tokenValid = await ensureTokenValidity(serverId);
            if (tokenValid) {
                await connectMcpServer(serverId);
                console.log(`[Background] ${serverConfig.name} restored with PAT`);
            }
        }
    } else {
        // Original OAuth logic
        const tokens = await getStoredTokens(serverId);
        // ... rest of existing logic
    }
}
```

### 5. Update McpServerCard Component

**File: `src/components/McpServerCard.tsx`**

Import server config type (add to imports):

```tsx
import { MCP_SERVERS } from "../constants/mcpServers"
```

Add state for PAT input dialog (around line 31):

```tsx
const [isNarrowView, setIsNarrowView] = useState(false)
const [showPatDialog, setShowPatDialog] = useState(false)
const [patInput, setPatInput] = useState('')
const [showUpdatePatDialog, setShowUpdatePatDialog] = useState(false)
```

Get server config to check for PAT auth (around line 36):

```tsx
const cardRef = useRef<HTMLDivElement>(null)
const serverConfig = MCP_SERVERS.find(s => s.id === id)
const usesPatAuth = serverConfig?.usesPatAuth || false
```

Add PAT authentication handler (around line 254):

```tsx
const handleAuthenticate = async () => {
    // Check if this server uses PAT authentication
    if (usesPatAuth) {
        setShowPatDialog(true)
        return
    }

    // Original OAuth flow
    setIsLoading(true)
    try {
        const response = await sendMessage({ type: `mcp/${id}/auth/start` })
        // ... rest of existing logic
    }
}
```

Add PAT submit handler (after `handleAuthenticate`):

```tsx
const handlePatSubmit = async () => {
    if (!patInput.trim()) {
        alert('Please enter a valid Personal Access Token')
        return
    }

    setIsLoading(true)
    try {
        const response = await sendMessage({ 
            type: `mcp/${id}/auth/start`,
            payload: { pat: patInput.trim() }
        })
        
        if (response.success) {
            setShowPatDialog(false)
            setPatInput('')
            await loadStatus()
        } else {
            alert(response.error || 'PAT authentication failed')
        }
    } catch (error) {
        console.error(`[McpServerCard:${id}] PAT auth error:`, error)
        alert('PAT authentication failed')
    } finally {
        setIsLoading(false)
    }
}

const handleUpdatePat = async () => {
    if (!patInput.trim()) {
        alert('Please enter a valid Personal Access Token')
        return
    }

    setIsLoading(true)
    try {
        const response = await sendMessage({ 
            type: `mcp/${id}/auth/update-pat`,
            payload: { pat: patInput.trim() }
        })
        
        if (response.success) {
            setShowUpdatePatDialog(false)
            setPatInput('')
            await loadStatus()
        } else {
            alert(response.error || 'PAT update failed')
        }
    } catch (error) {
        console.error(`[McpServerCard:${id}] PAT update error:`, error)
        alert('PAT update failed')
    } finally {
        setIsLoading(false)
    }
}
```

Update button rendering to show "Update PAT" when authenticated with PAT (around line 363):

```tsx
{requiresAuth ? (
    isAuthenticated ? (
        <>
            {isEnabled && (
                <button
                    className={`btn btn--secondary btn--sm ${isNarrowView ? 'btn--icon' : ''}`}
                    onClick={handleHealthCheck}
                    disabled={isLoading}
                    title="Check server health"
                >
                    {/* ... existing health check icon */}
                </button>
            )}
            {usesPatAuth && (
                <button
                    className="btn btn--secondary btn--sm"
                    onClick={() => setShowUpdatePatDialog(true)}
                    disabled={isLoading}
                >
                    Update PAT
                </button>
            )}
            <button
                className="btn btn--secondary btn--sm"
                onClick={handleLogout}
                disabled={isLoading}
            >
                {isLoading && !healthCheckStatus.includes('Checking') ? 'Loading...' : 'Logout'}
            </button>
        </>
    ) : (
        // ... existing not authenticated UI
    )
) : (
    // ... existing non-auth UI
)}
```

Add PAT input dialogs before closing JSX (before the ConfirmDialog components):

```tsx
{/* PAT Input Dialog */}
{showPatDialog && (
    <div className="dialog-overlay" onClick={() => setShowPatDialog(false)}>
        <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="dialog-title">Enter GitHub Personal Access Token</h3>
            <p className="dialog-message" style={{ marginBottom: '12px' }}>
                Enter your GitHub Personal Access Token to authenticate with GitHub Copilot MCP.
            </p>
            <input
                type="password"
                className="pat-input"
                placeholder="ghp_xxxxxxxxxxxx"
                value={patInput}
                onChange={(e) => setPatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePatSubmit()}
                autoFocus
            />
            <div className="dialog-actions">
                <button 
                    className="btn btn--secondary btn--sm"
                    onClick={() => {
                        setShowPatDialog(false)
                        setPatInput('')
                    }}
                >
                    Cancel
                </button>
                <button 
                    className="btn btn--primary btn--sm"
                    onClick={handlePatSubmit}
                    disabled={isLoading || !patInput.trim()}
                >
                    {isLoading ? 'Authenticating...' : 'Authenticate'}
                </button>
            </div>
        </div>
    </div>
)}

{/* Update PAT Dialog */}
{showUpdatePatDialog && (
    <div className="dialog-overlay" onClick={() => setShowUpdatePatDialog(false)}>
        <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="dialog-title">Update GitHub Personal Access Token</h3>
            <p className="dialog-message" style={{ marginBottom: '12px' }}>
                Enter a new GitHub Personal Access Token.
            </p>
            <input
                type="password"
                className="pat-input"
                placeholder="ghp_xxxxxxxxxxxx"
                value={patInput}
                onChange={(e) => setPatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUpdatePat()}
                autoFocus
            />
            <div className="dialog-actions">
                <button 
                    className="btn btn--secondary btn--sm"
                    onClick={() => {
                        setShowUpdatePatDialog(false)
                        setPatInput('')
                    }}
                >
                    Cancel
                </button>
                <button 
                    className="btn btn--primary btn--sm"
                    onClick={handleUpdatePat}
                    disabled={isLoading || !patInput.trim()}
                >
                    {isLoading ? 'Updating...' : 'Update'}
                </button>
            </div>
        </div>
    </div>
)}
```

### 6. Add PAT Dialog Styles

**File: `src/styles/mcp.css`**

Add dialog styles at the end of the file:

```css
/* PAT Dialog Styles */
.dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.dialog-content {
    background: var(--bg-primary, #ffffff);
    border-radius: 12px;
    padding: 24px;
    max-width: 450px;
    width: 90%;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.dialog-title {
    margin: 0 0 8px 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary, #1a1a1a);
}

.dialog-message {
    margin: 0;
    font-size: 14px;
    color: var(--text-secondary, #6b7280);
    line-height: 1.5;
}

.pat-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 8px;
    font-size: 14px;
    font-family: monospace;
    margin-bottom: 16px;
    box-sizing: border-box;
}

.pat-input:focus {
    outline: none;
    border-color: var(--primary-color, #3b82f6);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.dialog-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
}
```

### 7. Update AI Logic for PAT-based Servers

**File: `src/ai/mcpClient.ts`**

No changes needed - the existing code already uses the headers provided by background.ts, which will now include the PAT in the Authorization header for GitHub Copilot.

## Key Design Decisions

1. **Clean Separation**: PAT authentication logic is isolated and doesn't mix with OAuth flows
2. **Consistent Storage**: Uses similar patterns to OAuth token storage (chrome.storage.local)
3. **Unified Interface**: Both OAuth and PAT servers use the same status badges and enable/disable workflow
4. **Type Safety**: New interfaces (McpPatCredentials) maintain type safety throughout
5. **Security**: PAT is stored in chrome.storage.local (encrypted by Chrome) and displayed as password field
6. **User Experience**: "Update PAT" button allows users to change their token without logging out

### To-dos

- [ ] Update mcpServers.tsx: rename GitHub to GitHub Copilot, add usesPatAuth property to ServerConfig interface and mark GitHub server with usesPatAuth: true
- [ ] Add McpPatCredentials interface to mcp/types.ts
- [ ] Add PAT storage utilities (storePatCredentials, getStoredPatCredentials, clearPatCredentials) to mcp/oauth.ts
- [ ] Update background.ts: add patCredentials to ServerState, import PAT utilities, initialize patCredentials in getServerState
- [ ] Add handlePatAuth function in background.ts to handle PAT authentication flow
- [ ] Update ensureValidToken, disconnectServerAuth, and initializeServerStatus in background.ts to support PAT credentials
- [ ] Update message listener in background.ts to handle auth/start with PAT payload and add auth/update-pat case
- [ ] Update initializeAllServers in background.ts to load and restore PAT credentials for PAT-based servers
- [ ] Update McpServerCard.tsx: add PAT dialog states, get server config, add PAT handlers (handlePatSubmit, handleUpdatePat), update handleAuthenticate to check for PAT auth
- [ ] Add PAT input dialogs and Update PAT button to McpServerCard.tsx UI
- [ ] Add PAT dialog styles to mcp.css