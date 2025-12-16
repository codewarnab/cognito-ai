# Tool Approval System - Implementation Guide

A human-in-the-loop approval system for sensitive browser actions like `navigateTo`.

## Overview

When the AI calls a tool requiring approval (e.g., `navigateTo`), instead of auto-executing:
1. The UI shows an **Approve/Deny** prompt
2. User makes a decision
3. Tool executes (or is denied)
4. AI continues with the result

---

## Files to Modify

### 1. `src/ai/setup/remoteMode.ts`

**Add constant for tools requiring approval:**

```typescript
// Tools that require human approval before execution
export const TOOLS_REQUIRING_APPROVAL = ['navigateTo'];
```

---

### 2. `src/ai/stream/streamExecutor.ts`

**Strip `execute` from approval-required tools so AI SDK waits for frontend result:**

```typescript
import { TOOLS_REQUIRING_APPROVAL } from '../setup/remoteMode';

// In the tool wrapping logic, for approval tools, don't include execute:
Object.entries(tools).forEach(([name, tool]) => {
    if (TOOLS_REQUIRING_APPROVAL.includes(name)) {
        log.info(`🛡️ Tool "${name}" configured for human approval - no auto-execute`);
        // Copy tool without execute
        const { execute, ...toolWithoutExecute } = tool as any;
        boundTools[name] = toolWithoutExecute;
    } else {
        // Normal tools get wrapped execute with error handling
        boundTools[name] = {
            ...tool,
            execute: async (args: any) => {
                // ... existing logic
            }
        };
    }
});
```

---

### 3. `src/ai/transport/SimpleFrontendTransport.ts`

**Add support for `submit-tool-result` trigger:**

```typescript
async sendMessages(params: {
    trigger: 'submit-message' | 'regenerate-message' | 'submit-tool-result';  // Add this
    // ... rest of params
}): Promise<ReadableStream> {
    // ... existing code

    if (trigger === 'regenerate-message') {
        log.info('Processing regenerate-message request', { messageId });
        requestMessages = messages;
    } else if (trigger === 'submit-tool-result') {
        // For tool result submission (human-in-the-loop approval)
        log.info('🛡️ Processing submit-tool-result request - continuing after tool approval', {
            messageId,
            messageCount: messages.length
        });
        requestMessages = messages;
    }
    
    // ... rest of existing code
}
```

---

### 4. `src/components/ui/tools/formatters/types.ts`

**Add `pending-approval` state:**

```typescript
export interface ActionFormatterContext {
    state: 'loading' | 'success' | 'error' | 'pending-approval';  // Add pending-approval
    // ... rest of interface
}
```

---

### 5. `src/ai/tools/components/CompactToolRenderer.tsx`

**Add approval state and handlers:**

```typescript
import { TOOLS_REQUIRING_APPROVAL } from '../../setup/remoteMode';
import { getTool } from '../registryUtils';

interface CompactToolRendererProps {
    state: ToolUIState;
    messageId?: string;
    addToolResult?: (args: any) => void;  // For human-in-the-loop
}

export function CompactToolRenderer({ state, messageId, addToolResult }: CompactToolRendererProps) {
    const { toolName, state: toolState, input, output, errorText, toolCallId } = state;
    
    // Approval state management
    const [approvalState, setApprovalState] = useState<'pending' | 'executing' | 'approved' | 'denied'>('pending');
    const [executionResult, setExecutionResult] = useState<any>(null);
    const [executionError, setExecutionError] = useState<string | null>(null);

    // Check if this tool requires approval
    const requiresApproval = TOOLS_REQUIRING_APPROVAL.includes(toolName);
    const isWaitingForResult = toolState === 'input-available' && !output;
    const isPendingApproval = requiresApproval && isWaitingForResult && approvalState === 'pending';
    const isExecuting = approvalState === 'executing';
    const wasApproved = approvalState === 'approved';
    const wasDenied = approvalState === 'denied';

    // Handle approval
    const handleApprove = async () => {
        log.info('🛡️ User approved tool execution:', { toolName, toolCallId, input });
        setApprovalState('executing');

        try {
            const tool = getTool(toolName);
            if (!tool) throw new Error(`Tool "${toolName}" not found`);

            const result = await tool.execute(input);
            setExecutionResult(result);
            setApprovalState('approved');

            // Send result to AI to continue conversation
            if (addToolResult && toolCallId) {
                addToolResult({
                    tool: toolName,
                    toolCallId,
                    output: result,
                });
            }
        } catch (error) {
            setExecutionError(error instanceof Error ? error.message : String(error));
            setApprovalState('approved');
        }
    };

    // Handle denial
    const handleDeny = () => {
        log.info('🛡️ User denied tool execution:', { toolName, toolCallId });
        setApprovalState('denied');

        if (addToolResult && toolCallId) {
            addToolResult({
                tool: toolName,
                toolCallId,
                output: { denied: true, message: 'User denied this action.' },
            });
        }
    };

    // Determine UI state
    let uiState: 'loading' | 'success' | 'error' | 'pending-approval';
    if (isPendingApproval) {
        uiState = 'pending-approval';
    } else if (isExecuting) {
        uiState = 'loading';
    } else if (wasDenied) {
        uiState = 'error';
    } else if (wasApproved || toolState === 'output-available') {
        uiState = hasError ? 'error' : 'success';
    } else {
        uiState = 'loading';
    }

    return (
        <CompactToolCard
            toolName={toolName}
            state={uiState}
            input={input}
            output={wasApproved ? executionResult : output}
            errorText={wasDenied ? 'Action was denied by user' : errorText}
            onApprove={isPendingApproval ? handleApprove : undefined}
            onDeny={isPendingApproval ? handleDeny : undefined}
        />
    );
}
```

---

### 6. `src/components/ui/tools/cards/CompactToolCard.tsx`

**Add approval UI:**

```typescript
interface CompactToolCardProps {
    // ... existing props
    onApprove?: () => void;
    onDeny?: () => void;
}

// In the component, add approval buttons:
{state === 'pending-approval' && (
    <div className="flex items-center gap-2 mt-2">
        <span className="text-xs text-[var(--text-secondary)]">
            Allow {toolName}?
        </span>
        {onApprove && (
            <button
                onClick={onApprove}
                className="px-3 py-1 text-xs font-medium rounded-md 
                         bg-green-600 hover:bg-green-700 text-white
                         transition-colors flex items-center gap-1"
            >
                <Check className="w-3 h-3" />
                Approve
            </button>
        )}
        {onDeny && (
            <button
                onClick={onDeny}
                className="px-3 py-1 text-xs font-medium rounded-md
                         bg-red-600 hover:bg-red-700 text-white
                         transition-colors flex items-center gap-1"
            >
                <X className="w-3 h-3" />
                Deny
            </button>
        )}
    </div>
)}
```

**Icon colors by state:**

```typescript
// Pending approval state (amber/yellow)
const pendingApprovalGradient = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';

const getIconGradient = () => {
    switch (state) {
        case 'loading': return loadingGradient;
        case 'success': return successGradient;
        case 'error': return errorGradient;
        case 'pending-approval': return pendingApprovalGradient;
    }
};
```

---

### 7. Prop Drilling `addToolResult`

Pass `addToolResult` through the component chain:

**`App.tsx` → `CopilotChatWindow` → `ChatMessages` → `ToolPartRenderer` → `CompactToolRenderer`**

```typescript
// In App.tsx, extract from useAIChat:
const { addToolResult, ...rest } = aiChat;

// Pass down through each component:
<CopilotChatWindow addToolResult={addToolResult} ... />
<ChatMessages addToolResult={addToolResult} ... />
<ToolPartRenderer addToolResult={addToolResult} ... />
<CompactToolRenderer addToolResult={addToolResult} ... />
```

---

## Color Scheme

| State | Icon Gradient | Description |
|-------|---------------|-------------|
| `loading` | Blue `#3b82f6` → `#1d4ed8` | Tool is executing |
| `success` | Green `#22c55e` → `#16a34a` | Tool completed successfully |
| `error` | Red `#ef4444` → `#dc2626` | Tool failed or was denied |
| `pending-approval` | Amber `#f59e0b` → `#d97706` | Waiting for user decision |

## Button Styling

| Button | Background | Hover | Text |
|--------|------------|-------|------|
| Approve | `bg-green-600` | `bg-green-700` | White |
| Deny | `bg-red-600` | `bg-red-700` | White |

---

## Testing Checklist

- [ ] Ask "go to google.com" - should show approval prompt
- [ ] Click **Approve** - should navigate and show success
- [ ] Click **Deny** - should show error state with denial message
- [ ] Test other tools (not in approval list) - should auto-execute as before
- [ ] AI should continue after approval/denial with appropriate response

---

## Future Enhancements

1. **Configurable approval list** - Let users choose which tools need approval
2. **Remember decisions** - "Always allow for this site" option
3. **Timeout** - Auto-deny after N seconds
4. **Batch approval** - Approve all pending at once
