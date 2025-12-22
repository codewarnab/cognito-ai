# WebMCP Malicious Tool Injection Security Fix Plan

## Overview

**Vulnerability**: Medium Severity - WebMCP Malicious Tool Injection  
**Affected Files**:
- `src/entrypoints/webmcp-proxy.content.ts`
- `src/background/webmcp/manager.ts`
- `src/ai/tools/webmcpTools.ts`
- `src/background/messaging/webmcpHandler.ts`

**Issue**: The extension automatically connects to a "WebMCP" server on any website that exposes one. A malicious website can register custom tools (e.g., `save_password`, `analyze_cookies`). If the AI is prompted to use these tools with sensitive data, that data could be exfiltrated to the malicious website.

**Impact**: High - Potential data exfiltration of sensitive information (passwords, cookies, personal data) through malicious tool definitions.

---

## Current Architecture Analysis

### Flow of WebMCP Tool Discovery & Execution

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CURRENT FLOW (VULNERABLE)                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Website with WebMCP Server                                                  │
│         │                                                                    │
│         ▼                                                                    │
│  webmcp-proxy.content.ts                                                     │
│  [Auto-connects after 1s delay]  ← ⚠️ NO USER CONSENT                       │
│         │                                                                    │
│         ▼                                                                    │
│  registerWebMCPTools() in manager.ts                                         │
│  [Stores tools immediately]      ← ⚠️ NO DOMAIN TRUST CHECK                  │
│         │                                                                    │
│         ▼                                                                    │
│  Tools available to AI           ← ⚠️ NO TOOL VETTING                        │
│         │                                                                    │
│         ▼                                                                    │
│  AI calls tool                   ← ⚠️ NO CONFIRMATION BEFORE CALLING         │
│         │                                                                    │
│         ▼                                                                    │
│  executeWebMCPTool() → Content Script → Website                              │
│  [Data sent to website]          ← ⚠️ POTENTIAL DATA EXFILTRATION            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Vulnerable Points

1. **`webmcp-proxy.content.ts:302-304`** - Auto-connects to WebMCP servers after 1s delay without user approval
2. **`manager.ts:79-110`** - Registers tools immediately without domain trust verification
3. **`webmcpTools.ts:execute`** - Executes tools without confirmation dialog
4. **No visual indicator** when WebMCP tools are active from the current page

---

## Proposed Security Measures

### 1. Trusted Domain List & User Approval for New Domains

**Goal**: Require explicit user approval before connecting to a WebMCP server on a new domain.

#### 1.1 New Types & Storage Keys

**File**: `src/types/webmcp.ts`

```typescript
// Add these new types and constants

/**
 * Trust level for a WebMCP domain
 */
export type WebMCPDomainTrustLevel = 'trusted' | 'blocked' | 'pending';

/**
 * Domain trust configuration
 */
export interface WebMCPDomainTrust {
  domain: string;
  trustLevel: WebMCPDomainTrustLevel;
  trustedAt?: number;      // Timestamp when trusted
  trustedForSession?: boolean; // Trust only for this session
  toolCount?: number;      // Number of tools discovered
  lastSeen?: number;       // Last time this domain was seen
}

/**
 * Storage key for trusted domains
 */
export const WEBMCP_TRUSTED_DOMAINS_KEY = 'webmcp.domains.trusted';

/**
 * Message to request domain approval
 */
export interface WebMCPDomainApprovalRequest {
  type: 'webmcp/domain/request-approval';
  domain: string;
  url: string;
  toolCount: number;
  toolPreview: { name: string; description?: string }[];
  favicon?: string;
}

/**
 * Response to domain approval request
 */
export interface WebMCPDomainApprovalResponse {
  approved: boolean;
  trustLevel: WebMCPDomainTrustLevel;
  trustForSession?: boolean;
}
```

#### 1.2 Domain Trust Manager

**New File**: `src/background/webmcp/domainTrust.ts`

```typescript
/**
 * WebMCP Domain Trust Manager
 * 
 * Manages the trusted/blocked domain list for WebMCP connections.
 * Persists trust decisions in chrome.storage.local.
 */

import { createLogger } from '~logger';
import type { WebMCPDomainTrust, WebMCPDomainTrustLevel } from '@/types/webmcp';
import { WEBMCP_TRUSTED_DOMAINS_KEY } from '@/types/webmcp';

const log = createLogger('WebMCP-DomainTrust', 'WEBMCP');

// In-memory cache for faster lookups
let domainTrustCache: Map<string, WebMCPDomainTrust> = new Map();
let sessionTrustedDomains: Set<string> = new Set();

/**
 * Initialize the domain trust cache from storage
 */
export async function initializeDomainTrust(): Promise<void>;

/**
 * Check if a domain is trusted
 */
export async function isDomainTrusted(domain: string): Promise<boolean>;

/**
 * Get trust level for a domain
 */
export async function getDomainTrustLevel(domain: string): Promise<WebMCPDomainTrustLevel | null>;

/**
 * Trust a domain (permanently or for session)
 */
export async function trustDomain(
  domain: string, 
  options?: { forSession?: boolean }
): Promise<void>;

/**
 * Block a domain
 */
export async function blockDomain(domain: string): Promise<void>;

/**
 * Remove trust/block decision for a domain
 */
export async function resetDomainTrust(domain: string): Promise<void>;

/**
 * Get all trusted/blocked domains for settings UI
 */
export async function getAllDomainTrust(): Promise<WebMCPDomainTrust[]>;

/**
 * Clear session-only trust (called on extension restart)
 */
export function clearSessionTrust(): void;
```

#### 1.3 Update Content Script to Check Trust Before Connecting

**File**: `src/entrypoints/webmcp-proxy.content.ts`

**Changes**:
- Before `attemptConnection()`, check if domain is trusted
- If not trusted, send approval request to background and wait for user decision
- Only proceed with connection if approved

```typescript
// In attemptConnection() function, add trust check before connecting

async function attemptConnection(): Promise<void> {
  // ... existing guards ...
  
  const domain = extractDomain(window.location.href);
  
  // Check domain trust BEFORE attempting connection
  const trustResponse = await browser.runtime.sendMessage({
    type: 'webmcp/domain/check-trust',
    domain,
    url: window.location.href,
  });
  
  if (!trustResponse?.trusted) {
    console.debug('[WebMCP Proxy] Domain not trusted, skipping connection');
    return;
  }
  
  // ... rest of connection logic ...
}
```

#### 1.4 Update Manager to Enforce Trust

**File**: `src/background/webmcp/manager.ts`

**Changes**:
- Add trust check in `registerWebMCPTools()`
- Reject tools from untrusted domains
- Add new methods for domain trust management

---

### 2. Visual Indicator for Active WebMCP Tools

**Goal**: Visually indicate in the UI when tools from the current page are active/available.

#### 2.1 Composer Toolbar Indicator

**File**: `src/components/features/chat/components/input/ComposerToolbar.tsx`

**New Component**: Add a WebMCP indicator badge next to the tools icon.

```tsx
// WebMCPIndicator component
interface WebMCPIndicatorProps {
  tools: WebMCPTool[];
  domain: string | null;
  favicon?: string;
}

export const WebMCPIndicator: React.FC<WebMCPIndicatorProps> = ({ 
  tools, 
  domain,
  favicon 
}) => {
  if (tools.length === 0) return null;
  
  return (
    <Tooltip content={`${tools.length} tools from ${domain}`}>
      <div className="webmcp-indicator">
        {favicon ? (
          <img src={favicon} alt="" className="webmcp-indicator-favicon" />
        ) : (
          <Globe size={14} />
        )}
        <span className="webmcp-indicator-badge">{tools.length}</span>
      </div>
    </Tooltip>
  );
};
```

#### 2.2 Tool Popover Enhancement

**File**: `src/components/features/chat/components/modals/ToolPopover/components/WebMcpSection.tsx`

**Changes**:
- Add warning banner for untrusted domains
- Show domain trust status
- Add "Trust this domain" / "Block this domain" actions

#### 2.3 CSS for Indicator

**File**: `src/styles/features/webmcp/indicator.css`

```css
.webmcp-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(255, 165, 0, 0.1);
  border: 1px solid rgba(255, 165, 0, 0.3);
  border-radius: 6px;
  font-size: 12px;
  color: #ffa500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.webmcp-indicator:hover {
  background: rgba(255, 165, 0, 0.2);
  border-color: rgba(255, 165, 0, 0.5);
}

.webmcp-indicator-favicon {
  width: 14px;
  height: 14px;
  border-radius: 2px;
}

.webmcp-indicator-badge {
  background: rgba(255, 165, 0, 0.8);
  color: white;
  padding: 0 6px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
}

/* Warning state for untrusted domains */
.webmcp-indicator--warning {
  background: rgba(255, 100, 100, 0.1);
  border-color: rgba(255, 100, 100, 0.3);
  color: #ff6464;
}
```

---

### 3. Tool Execution Confirmation Dialog

**Goal**: Implement a confirmation dialog before the AI calls a tool provided by a website.

#### 3.1 Confirmation Dialog Component

**New File**: `src/components/features/chat/components/modals/WebMCPToolConfirmDialog.tsx`

```tsx
/**
 * WebMCP Tool Confirmation Dialog
 * 
 * Shows before executing a WebMCP tool to prevent data exfiltration.
 * Displays:
 * - Tool name and description
 * - Source domain (with favicon)
 * - Arguments being passed to the tool
 * - Warning about data being sent to external website
 */

interface WebMCPToolConfirmDialogProps {
  isOpen: boolean;
  tool: {
    name: string;
    originalName: string;
    description?: string;
    domain: string;
    favicon?: string;
  };
  args: Record<string, unknown>;
  onConfirm: () => void;
  onDeny: () => void;
  onRememberChoice?: (choice: 'always' | 'session' | 'never') => void;
}

export const WebMCPToolConfirmDialog: React.FC<WebMCPToolConfirmDialogProps>;
```

**Dialog Content**:
```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️  External Tool Execution                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [favicon] example.com wants to execute:                         │
│                                                                  │
│  Tool: save_user_data                                            │
│  Description: Save user data to our servers                      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Arguments being sent:                                        ││
│  │ {                                                            ││
│  │   "email": "user@example.com",                               ││
│  │   "data": "..."                                              ││
│  │ }                                                            ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ⚠️ This data will be sent to example.com                        │
│                                                                  │
│  □ Remember my choice for this session                           │
│  □ Always allow tools from this domain                           │
│                                                                  │
│  ┌─────────┐  ┌─────────┐  ┌───────────────┐                     │
│  │  Deny   │  │  Block  │  │  ✓ Allow Once │                     │
│  └─────────┘  └─────────┘  └───────────────┘                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.2 Confirmation State Management

**New File**: `src/stores/webmcp/confirmationStore.ts`

```typescript
/**
 * WebMCP Tool Confirmation Store
 * 
 * Manages pending tool confirmations and user preferences.
 */

interface PendingConfirmation {
  id: string;
  tool: WebMCPTool;
  args: Record<string, unknown>;
  resolve: (approved: boolean) => void;
  timestamp: number;
}

interface WebMCPConfirmationState {
  pendingConfirmations: PendingConfirmation[];
  sessionApprovedTools: Set<string>;  // toolName -> auto-approve for session
  sessionDeniedTools: Set<string>;    // toolName -> auto-deny for session
  
  // Actions
  requestConfirmation: (tool: WebMCPTool, args: Record<string, unknown>) => Promise<boolean>;
  approveConfirmation: (id: string, remember?: 'session' | 'always') => void;
  denyConfirmation: (id: string, remember?: boolean) => void;
  clearSessionPreferences: () => void;
}
```

#### 3.3 Integration with Tool Execution

**File**: `src/ai/tools/webmcpTools.ts`

**Changes**:
```typescript
// Modify the execute function in convertWebMCPToolsToAITools

execute: async (args: Record<string, unknown>) => {
  // Check if this tool needs confirmation
  const shouldConfirm = await checkToolNeedsConfirmation(webmcpTool);
  
  if (shouldConfirm) {
    const approved = await requestToolConfirmation(webmcpTool, args);
    
    if (!approved) {
      return {
        error: true,
        message: 'Tool execution was denied by user',
        toolName,
        feedback: `User denied execution of WebMCP tool "${webmcpTool.originalName}" from ${webmcpTool.domain}. Try a different approach.`
      };
    }
  }
  
  // Proceed with execution
  // ... existing execution logic ...
}
```

---

### 4. Sensitive Data Detection (Optional Enhancement)

**Goal**: Detect and warn when sensitive data might be passed to WebMCP tools.

#### 4.1 Sensitive Data Patterns

**New File**: `src/background/webmcp/sensitiveDataDetector.ts`

```typescript
/**
 * Sensitive Data Detector
 * 
 * Detects potentially sensitive data in tool arguments.
 * Used to show stronger warnings in confirmation dialog.
 */

export type SensitiveDataType = 
  | 'password'
  | 'email'
  | 'phone'
  | 'credit_card'
  | 'ssn'
  | 'api_key'
  | 'cookie'
  | 'token'
  | 'personal_name'
  | 'address';

interface SensitiveDataMatch {
  type: SensitiveDataType;
  field: string;
  value: string;  // Masked value for display
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Analyze tool arguments for sensitive data
 */
export function detectSensitiveData(
  args: Record<string, unknown>
): SensitiveDataMatch[];

/**
 * Check if tool name suggests sensitive operations
 */
export function isToolNameSuspicious(toolName: string): boolean;
```

**Suspicious Tool Name Patterns**:
```typescript
const SUSPICIOUS_PATTERNS = [
  /password/i,
  /credential/i,
  /auth/i,
  /token/i,
  /secret/i,
  /cookie/i,
  /session/i,
  /login/i,
  /account/i,
  /credit/i,
  /payment/i,
  /ssn/i,
  /social.*security/i,
  /bank/i,
  /private/i,
  /exfiltrate/i,
  /steal/i,
  /capture/i,
  /harvest/i,
];
```

---

## Implementation Tasks

### Phase 1: Domain Trust System (Priority: High)

| Task | File(s) | Est. Time |
|------|---------|-----------|
| 1.1 Add new types for domain trust | `types/webmcp.ts` | 30 min |
| 1.2 Create domain trust manager | `background/webmcp/domainTrust.ts` | 2 hrs |
| 1.3 Update content script to check trust | `entrypoints/webmcp-proxy.content.ts` | 1 hr |
| 1.4 Update manager to enforce trust | `background/webmcp/manager.ts` | 1 hr |
| 1.5 Add message handlers for trust | `background/messaging/webmcpHandler.ts` | 1 hr |
| 1.6 Create domain approval notification | New component + background logic | 2 hrs |

### Phase 2: Visual Indicators (Priority: High)

| Task | File(s) | Est. Time |
|------|---------|-----------|
| 2.1 Create WebMCP indicator component | New component | 1 hr |
| 2.2 Add indicator to ComposerToolbar | `ComposerToolbar.tsx` | 30 min |
| 2.3 Update ToolPopover with domain info | `WebMcpSection.tsx` | 1 hr |
| 2.4 Add indicator CSS styles | New CSS file | 30 min |
| 2.5 Add hook for WebMCP state | `hooks/webmcp/useWebMCPIndicator.ts` | 1 hr |

### Phase 3: Tool Confirmation Dialog (Priority: High)

| Task | File(s) | Est. Time |
|------|---------|-----------|
| 3.1 Create confirmation dialog component | New component | 2 hrs |
| 3.2 Create confirmation store | New Zustand store | 1 hr |
| 3.3 Integrate with tool execution | `webmcpTools.ts` | 1 hr |
| 3.4 Add dialog styles | CSS file | 30 min |
| 3.5 Handle async confirmation flow | Multiple files | 2 hrs |

### Phase 4: Sensitive Data Detection (Priority: Medium)

| Task | File(s) | Est. Time |
|------|---------|-----------|
| 4.1 Create sensitive data detector | New utility | 1.5 hrs |
| 4.2 Integrate with confirmation dialog | Update dialog | 1 hr |
| 4.3 Add suspicious tool name detection | New utility | 30 min |
| 4.4 Update dialog to show warnings | Update component | 1 hr |

### Phase 5: Settings & Management (Priority: Low)

| Task | File(s) | Est. Time |
|------|---------|-----------|
| 5.1 Add domain trust management to settings | Settings components | 2 hrs |
| 5.2 Add "manage trusted domains" UI | New component | 1.5 hrs |
| 5.3 Add bulk actions (clear all, export/import) | Settings | 1 hr |

---

## Security Considerations

### 1. Defense in Depth

Multiple layers of protection:
1. **Domain Trust** - First line of defense, blocks connection
2. **Visual Indicator** - User awareness
3. **Tool Confirmation** - Explicit consent before execution
4. **Sensitive Data Detection** - Enhanced warnings

### 2. Fail-Safe Defaults

- **New domains are UNTRUSTED by default**
- **Session trusts expire on browser restart**
- **Confirmation is required unless explicitly disabled**

### 3. User Education

- Clear explanations in approval dialogs
- Warning about data being sent to external sites
- Highlight suspicious tool names

### 4. Audit Trail (Future Enhancement)

- Log all WebMCP tool executions
- Track which tools were approved/denied
- Allow users to review history

---

## Testing Plan

### Unit Tests

1. Domain trust manager functions
2. Sensitive data detector patterns
3. Tool name suspicion detection
4. Confirmation store state management

### Integration Tests

1. Full flow: new domain → approval → tool execution
2. Blocked domain prevents connection
3. Session trust expires correctly
4. Confirmation dialog blocks execution until approved

### Manual Testing Scenarios

1. **Trusted Domain Flow**:
   - Visit trusted domain with WebMCP
   - Verify tools load without prompt
   - Verify indicator shows

2. **New Domain Flow**:
   - Visit new domain with WebMCP
   - Verify approval prompt appears
   - Test "Trust for session" option
   - Test "Block domain" option

3. **Malicious Tool Simulation**:
   - Create test page with suspicious tool names
   - Verify enhanced warnings appear
   - Verify sensitive data detection works

4. **Edge Cases**:
   - Multiple domains in quick succession
   - Tab switching during approval
   - Extension restart with session trusts

---

## Migration & Rollout

### Backward Compatibility

- Existing WebMCP functionality continues to work
- Users with existing trusted domains (none yet) are not affected
- Feature is opt-in by default (no breaking changes)

### Feature Flags (Optional)

```typescript
// In settings or feature flags
const WEBMCP_SECURITY_FEATURES = {
  requireDomainApproval: true,      // Phase 1
  showVisualIndicator: true,        // Phase 2
  requireToolConfirmation: true,    // Phase 3
  detectSensitiveData: true,        // Phase 4
};
```

### Rollout Order

1. **Stage 1**: Visual indicator only (low risk, high visibility)
2. **Stage 2**: Domain trust system (medium risk, high security value)
3. **Stage 3**: Tool confirmation (medium risk, high security value)
4. **Stage 4**: Sensitive data detection (low risk, nice-to-have)

---

## Success Metrics

1. **No automatic connections** to untrusted domains
2. **100% user consent** before WebMCP tool execution
3. **Clear visual feedback** when WebMCP tools are active
4. **Zero data exfiltration** through malicious tools

---

## Appendix: Related Files

| Category | Files |
|----------|-------|
| **Types** | `src/types/webmcp.ts` |
| **Background** | `src/background/webmcp/manager.ts`, `src/background/messaging/webmcpHandler.ts` |
| **Content Script** | `src/entrypoints/webmcp-proxy.content.ts` |
| **AI Tools** | `src/ai/tools/webmcpTools.ts`, `src/ai/backend/webmcpIntegration.ts` |
| **UI** | `src/components/features/chat/components/modals/ToolPopover/components/WebMcpSection.tsx` |
| **Hooks** | `src/hooks/webmcp/useWebMCPTools.ts` |
| **Stores** | `src/stores/mcp/mcpStore.ts` (reference for patterns) |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-22 | AI | Initial plan creation |
