# Tool Approval System - Human-in-the-Loop for Sensitive Actions

This document describes how the tool approval system works in Cognito AI, providing a human-in-the-loop mechanism for sensitive browser automation tools.

## Overview

The Tool Approval System implements a security mechanism that requires explicit user consent before executing potentially dangerous browser actions. This prevents the AI from performing unintended actions that could:
- Navigate to malicious websites
- Submit forms with sensitive data
- Execute arbitrary JavaScript
- Capture screenshots of sensitive content

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AI LAYER                                       │
│  ┌──────────────────────┐    ┌──────────────────────┐                      │
│  │  Vercel AI SDK v6    │    │   Tool Registry      │                      │
│  │  streamText()        │    │                      │                      │
│  └──────────┬───────────┘    └──────────────────────┘                      │
└─────────────┼───────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXECUTION LAYER                                   │
│  ┌──────────────────────┐    ┌──────────────────────┐                      │
│  │  streamExecutor.ts   │───▶│  ToolPartRenderer    │                      │
│  │  (strips execute)    │    │                      │                      │
│  └──────────────────────┘    └──────────┬───────────┘                      │
│                                         │                                   │
│                                         ▼                                   │
│                              ┌──────────────────────┐                      │
│                              │ CompactToolRenderer  │                      │
│                              │  (approval logic)    │                      │
│                              └──────────┬───────────┘                      │
└─────────────────────────────────────────┼───────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           APPROVAL LAYER                                    │
│  ┌──────────────────┐  ┌────────────────────┐  ┌─────────────────────┐     │
│  │ approvalStore.ts │  │ approvalConfig.ts  │  │ ApprovalDropdown.tsx│     │
│  │ (Zustand Store)  │  │ (Tool Configs)     │  │ (UI Component)      │     │
│  └────────┬─────────┘  └────────────────────┘  └─────────────────────┘     │
└───────────┼─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             STORAGE                                         │
│  ┌──────────────────────┐    ┌──────────────────────┐                      │
│  │  In-Memory (Set)     │    │  chrome.storage.local│                      │
│  │  Session Approvals   │    │  Persisted Approvals │                      │
│  └──────────────────────┘    └──────────────────────┘                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Tool Requiring Approval

```
┌──────────┐       ┌─────────┐       ┌──────────────┐       ┌───────────────┐
│   User   │       │   AI    │       │streamExecutor│       │CompactTool    │
│          │       │ Gemini  │       │              │       │Renderer       │
└────┬─────┘       └────┬────┘       └──────┬───────┘       └───────┬───────┘
     │                  │                   │                       │
     │ "Navigate to     │                   │                       │
     │  github.com"     │                   │                       │
     │─────────────────▶│                   │                       │
     │                  │                   │                       │
     │                  │ navigateTo(url)   │                       │
     │                  │──────────────────▶│                       │
     │                  │                   │                       │
     │                  │                   │ Tool in APPROVAL list │
     │                  │                   │ Strip execute func    │
     │                  │                   │──────────────────────▶│
     │                  │                   │                       │
     │                  │                   │       ┌───────────────┴───────────┐
     │                  │                   │       │ Check isAutoApproved()    │
     │                  │                   │       │ for "navigateTo" + domain │
     │                  │                   │       └───────────────┬───────────┘
     │                  │                   │                       │
     │◀─────────────────────────────────────────────────────────────│
     │  Show Approve/Deny buttons                                   │
     │                                                              │
     │  [User clicks "Allow for this website"]                      │
     │──────────────────────────────────────────────────────────────▶
     │                                                              │
     │                  │                   │       ┌───────────────┴───────────┐
     │                  │                   │       │ 1. Save website approval  │
     │                  │                   │       │ 2. Execute tool           │
     │                  │                   │       │ 3. addToolOutput(result)  │
     │                  │                   │       └───────────────┬───────────┘
     │                  │                   │                       │
     │                  │◀──────────────────────────────────────────│
     │                  │  Tool result                              │
     │                  │                                           │
     │◀─────────────────│                                           │
     │  "I've navigated │                                           │
     │   to github.com" │                                           │
     │                  │                                           │
```

---

## Key Components

### 1. `TOOLS_REQUIRING_APPROVAL` (remoteMode.ts)

Array of tool names that require human approval:

```typescript
export const TOOLS_REQUIRING_APPROVAL = [
    'navigateTo',      // Navigation to external URLs
    'executeScript',   // Arbitrary JavaScript execution
    'typeInField',     // Form filling (passwords, payments)
    'clickByText',     // Button clicks (form submissions, purchases)
    'pressKey',        // Keyboard simulation
    'takeScreenshot',  // Privacy-sensitive screen capture
];
```

### 2. `streamExecutor.ts`

Strips the `execute` function from tools requiring approval:

```typescript
if (TOOLS_REQUIRING_APPROVAL.includes(name)) {
    const { execute, ...toolWithoutExecute } = tool;
    boundTools[name] = toolWithoutExecute;
    return; // AI SDK waits for addToolOutput
}
```

This leverages Vercel AI SDK v6's human-in-the-loop pattern where tools without an `execute` function will wait for the frontend to call `addToolOutput`.

### 3. `CompactToolRenderer.tsx`

The core approval UI logic:

```
                    ┌─────────────────────────┐
                    │   Tool Call Received    │
                    └───────────┬─────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │ In TOOLS_REQUIRING_     │
                    │ APPROVAL?               │
                    └───────────┬─────────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                   No                      Yes
                    │                       │
                    ▼                       ▼
          ┌─────────────────┐   ┌─────────────────────┐
          │Execute Immediately│   │Check isAutoApproved │
          └─────────────────┘   └───────────┬─────────┘
                                            │
                                ┌───────────┴───────────┐
                                │                       │
                               Yes                      No
                                │                       │
                                ▼                       ▼
                    ┌─────────────────┐   ┌─────────────────┐
                    │Execute Immediately│   │Show Approval UI │
                    └─────────────────┘   └───────────┬─────┘
                                                      │
                                    ┌─────────────────┼─────────────────┐
                                    │                 │                 │
                                 Allow           Allow+Auto          Deny
                                    │                 │                 │
                                    ▼                 ▼                 ▼
                          ┌──────────────┐ ┌──────────────────┐ ┌───────────────┐
                          │Execute Tool  │ │Save Pref+Execute │ │Send Denial    │
                          │addToolOutput │ │addToolOutput     │ │addToolOutput  │
                          └──────────────┘ └──────────────────┘ └───────────────┘
```

### 4. `approvalStore.ts`

Zustand store managing approval preferences:

| Approval Type | Storage | Scope | Persistence |
|--------------|---------|-------|-------------|
| Session | In-memory | Tool only | Browser session |
| Website | chrome.storage.local | Tool + Domain | Permanent |
| Always | chrome.storage.local | Tool only | Permanent |

### 5. `approvalConfig.ts`

Per-tool configuration for website-specific approvals:

```typescript
interface ToolApprovalConfig {
    supportsWebsiteApproval: boolean;
    extractDomain?: (input: any, currentTabUrl?: string) => string | null;
}
```

**Domain Extraction by Tool Type:**

| Tool Type | Domain Source | Example |
|-----------|--------------|---------|
| `navigateTo` | Target URL from input | `navigateTo({url: "github.com"})` → `github.com` |
| Page Interaction | Current tab URL | On `twitter.com` → `twitter.com` |

---

## State Diagram: Approval States

```
                    ┌─────────┐
                    │ pending │◀──── Tool call received
                    └────┬────┘
                         │
           ┌─────────────┼─────────────┐
           │             │             │
    User clicks     Auto-approved   User clicks
      "Allow"                         "Deny"
           │             │             │
           ▼             ▼             ▼
       ┌───────────────────┐       ┌────────┐
       │    executing      │       │ denied │
       └─────────┬─────────┘       └────┬───┘
                 │                      │
    ┌────────────┴────────────┐         │
    │                         │         │
 Success                   Error        │
    │                         │         │
    ▼                         ▼         ▼
┌─────────┐             ┌─────────┐  ┌─────────┐
│approved │             │approved │  │  END    │
│(success)│             │(w/error)│  │         │
└────┬────┘             └────┬────┘  └─────────┘
     │                       │
     └───────────┬───────────┘
                 │
                 ▼
        Result sent to AI
```

---

## Approval Options Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Approval Button UI                       │
│                                                             │
│   ┌──────────────┐  ┌────┐     ┌──────────────┐            │
│   │  ✓ Allow     │  │ ▼  │     │   ✕ Deny     │            │
│   └──────┬───────┘  └──┬─┘     └──────┬───────┘            │
│          │             │              │                     │
│          │             ▼              │                     │
│          │   ┌─────────────────────┐  │                     │
│          │   │ Dropdown Menu       │  │                     │
│          │   │ ┌─────────────────┐ │  │                     │
│          │   │ │Session auto-appr│ │  │                     │
│          │   │ ├─────────────────┤ │  │                     │
│          │   │ │Allow for website│ │  │                     │
│          │   │ ├─────────────────┤ │  │                     │
│          │   │ │Always auto-appr │ │  │                     │
│          │   │ └─────────────────┘ │  │                     │
│          │   └─────────────────────┘  │                     │
└──────────┼─────────────┼──────────────┼─────────────────────┘
           │             │              │
           ▼             ▼              ▼
    ┌────────────┐ ┌────────────┐ ┌────────────┐
    │Execute Once│ │Add Pref    │ │Send Denial │
    │            │ │+ Execute   │ │to AI       │
    └────────────┘ └────────────┘ └────────────┘
```

---

## File Structure

```
apps/extension/src/
├── ai/
│   ├── setup/
│   │   └── remoteMode.ts          # TOOLS_REQUIRING_APPROVAL list
│   ├── stream/
│   │   └── streamExecutor.ts      # Strips execute for HITL tools
│   └── tools/
│       ├── approvalConfig.ts      # Per-tool domain extraction config
│       └── components/
│           └── CompactToolRenderer.tsx  # Approval UI logic
├── stores/
│   └── approval/
│       ├── approvalStore.ts       # Zustand store
│       └── types.ts               # TypeScript interfaces
└── components/
    └── ui/
        └── tools/
            └── cards/
                └── ApprovalDropdown.tsx  # Dropdown UI component
```

---

## Adding a New Tool to Approval System

Follow these steps to add approval requirements for additional tools:

### Step 1: Add to Approval List

```typescript
// remoteMode.ts
export const TOOLS_REQUIRING_APPROVAL = [
    // ... existing tools
    'newToolName',
];
```

### Step 2: Add Approval Configuration

```typescript
// approvalConfig.ts
export const TOOL_APPROVAL_CONFIG: Record<string, ToolApprovalConfig> = {
    // ... existing configs
    newToolName: {
        supportsWebsiteApproval: true, // or false for cross-site tools
        extractDomain: (input: any, currentTabUrl?: string) => {
            // Return domain string or null
            // For target URL tools: extract from input
            // For page tools: use currentTabUrl
        },
    },
};
```

### Step 3: Ensure UI Renderer Passes addToolOutput

If the tool has a custom UI renderer:

```typescript
// In tool registration
registerToolUI('newToolName', (state: ToolUIState, options) => {
    return <CompactToolRenderer state={state} addToolOutput={options?.addToolOutput} />;
});
```

---

## Security Considerations

> **⚠️ CAUTION**: Tools without approval can perform actions without user consent. Only skip approval for truly safe operations like `readPageContent`.

### Risk Assessment

| Risk Level | Tools | Approval Required |
|------------|-------|-------------------|
| 🔴 Critical | `executeScript` | Always |
| 🟠 High | `navigateTo`, `typeInField`, `clickByText` | Always |
| 🟡 Medium | `pressKey`, `takeScreenshot` | Recommended |
| 🟢 Low | `readPageContent`, `analyzeDom` | No |

---

## Testing

### Manual Testing Checklist

1. **Approval Prompt**
   - [ ] Tool shows "Allow/Deny" buttons when called
   - [ ] Dropdown shows all applicable options

2. **One-Time Approval**
   - [ ] Tool executes after clicking "Allow"
   - [ ] AI receives result and continues conversation

3. **Session Auto-Approve**
   - [ ] Same tool auto-executes in same session
   - [ ] Approval clears after browser restart

4. **Website Auto-Approve**
   - [ ] Same tool + domain combo auto-executes
   - [ ] Different domain still requires approval
   - [ ] Preference persists across sessions

5. **Always Auto-Approve**
   - [ ] Tool auto-executes regardless of domain
   - [ ] Preference persists across sessions

6. **Denial**
   - [ ] AI receives denial message
   - [ ] AI responds appropriately

---

## Related Documentation

- [Vercel AI SDK v6 - Human in the Loop](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#human-in-the-loop-for-tool-calls)
- [TOOL_APPROVAL_ANALYSIS.md](./TOOL_APPROVAL_ANALYSIS.md) - Risk assessment for all tools
