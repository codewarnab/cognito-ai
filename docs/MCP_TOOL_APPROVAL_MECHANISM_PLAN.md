# MCP Tool Approval Mechanism - Implementation Plan

## Overview

This document outlines a comprehensive plan to implement a **human-in-the-loop approval mechanism** for MCP (Model Context Protocol) tool calls in the Chrome AI extension. The mechanism will require user approval before executing any MCP tool, with an optional auto-approve feature for the current session.

## Current Architecture Analysis

### Tool Execution Flow
1. **User sends message** → `handleSendMessage()` in `sidepanel.tsx`
2. **Transport layer** → `SimpleFrontendTransport.sendMessages()` 
3. **AI Logic** → `streamAIResponse()` in `aiLogic.ts`
4. **Tool Registration** → MCP tools via `getMCPToolsFromBackground()` in `mcpProxy.ts`
5. **Tool Execution** → Background service worker executes tool via `callServerTool()`
6. **Result Display** → `ToolPartRenderer` and `McpToolCall` components

### Key Files to Modify
- `src/ai/mcpProxy.ts` - Tool executor proxy (intercept point)
- `src/ai/aiLogic.ts` - Stream handling and tool integration
- `src/components/McpToolApproval.tsx` - NEW: Approval UI component
- `src/ai/toolApprovalStore.ts` - NEW: Approval state management
- `src/types/toolApproval.ts` - NEW: Type definitions
- `src/styles/tool-approval.css` - NEW: Approval UI styles

## Phase 1: Basic Approval Mechanism

### Goal
Implement mandatory user approval for every MCP tool call before execution.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI Model (Gemini)                           │
│                  Generates Tool Calls                           │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ Tool call generated
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              mcpProxy.ts (Tool Registration)                    │
│    - Removes execute function from tool definition             │
│    - Tool call forwarded to frontend as "input-available"      │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ Tool call intercepted
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│         ToolPartRenderer / McpToolApproval (Frontend)           │
│    - Detects tool call in "input-available" state              │
│    - Renders approval UI with Approve/Cancel buttons           │
│    - Waits for user interaction                                │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ User clicks Approve/Cancel
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              useChat().addToolResult()                          │
│    - Adds tool result with approval status                     │
│    - Triggers new generation with updated tool result          │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ Messages sent back to backend
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│     aiLogic.ts (processToolCalls utility function)              │
│    - Checks tool result for approval status                    │
│    - If approved: executes tool via background proxy           │
│    - If denied: returns error message                          │
│    - Updates tool result with actual execution result          │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ Continue generation with result
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AI Model Continues                            │
│              Processes tool result                              │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Steps

#### Step 1: Create Type Definitions

**File:** `src/types/toolApproval.ts`

```typescript
/**
 * Tool approval states
 */
export type ToolApprovalStatus = 
  | 'pending'      // Waiting for user approval
  | 'approved'     // User approved execution
  | 'denied'       // User denied execution
  | 'executed';    // Tool has been executed

/**
 * Tool approval request
 */
export interface ToolApprovalRequest {
  toolCallId: string;
  toolName: string;
  serverId: string;
  serverName: string;
  args: Record<string, any>;
  status: ToolApprovalStatus;
  timestamp: number;
}

/**
 * Approval constants for tool results
 */
export const APPROVAL = {
  YES: 'APPROVED_BY_USER',
  NO: 'DENIED_BY_USER',
} as const;

export type ApprovalResponse = typeof APPROVAL[keyof typeof APPROVAL];
```

#### Step 2: Create Approval State Store

**File:** `src/ai/toolApprovalStore.ts`

```typescript
/**
 * Tool Approval State Management
 * Manages pending tool approvals and auto-approve settings
 */

import { create } from 'zustand';
import type { ToolApprovalRequest } from '../types/toolApproval';

interface ToolApprovalState {
  // Pending approvals by toolCallId
  pendingApprovals: Map<string, ToolApprovalRequest>;
  
  // Auto-approve settings per server (Phase 2)
  autoApproveServers: Set<string>;
  
  // Actions
  addPendingApproval: (request: ToolApprovalRequest) => void;
  removePendingApproval: (toolCallId: string) => void;
  getPendingApproval: (toolCallId: string) => ToolApprovalRequest | undefined;
  clearAllPending: () => void;
  
  // Phase 2: Auto-approve actions
  enableAutoApprove: (serverId: string) => void;
  disableAutoApprove: (serverId: string) => void;
  isAutoApproved: (serverId: string) => boolean;
  clearAutoApprove: () => void;
}

export const useToolApprovalStore = create<ToolApprovalState>((set, get) => ({
  pendingApprovals: new Map(),
  autoApproveServers: new Set(),
  
  addPendingApproval: (request) => {
    const newMap = new Map(get().pendingApprovals);
    newMap.set(request.toolCallId, request);
    set({ pendingApprovals: newMap });
  },
  
  removePendingApproval: (toolCallId) => {
    const newMap = new Map(get().pendingApprovals);
    newMap.delete(toolCallId);
    set({ pendingApprovals: newMap });
  },
  
  getPendingApproval: (toolCallId) => {
    return get().pendingApprovals.get(toolCallId);
  },
  
  clearAllPending: () => {
    set({ pendingApprovals: new Map() });
  },
  
  // Phase 2 implementations
  enableAutoApprove: (serverId) => {
    const newSet = new Set(get().autoApproveServers);
    newSet.add(serverId);
    set({ autoApproveServers: newSet });
  },
  
  disableAutoApprove: (serverId) => {
    const newSet = new Set(get().autoApproveServers);
    newSet.delete(serverId);
    set({ autoApproveServers: newSet });
  },
  
  isAutoApproved: (serverId) => {
    return get().autoApproveServers.has(serverId);
  },
  
  clearAutoApprove: () => {
    set({ autoApproveServers: new Set() });
  },
}));
```

#### Step 3: Modify MCP Proxy to Remove Execute Function

**File:** `src/ai/mcpProxy.ts`

**Change:** Remove the `execute` function from MCP tool definitions so tool calls are forwarded to the frontend for approval.

```typescript
// Current implementation has execute function
tools[toolDef.name] = {
  description: toolDef.description || `Tool from ${toolDef.serverName}`,
  parameters: zodSchema,
  execute: async (args: any) => {
    // THIS WILL BE REMOVED for Phase 1
  }
};

// NEW implementation WITHOUT execute function
tools[toolDef.name] = {
  description: toolDef.description || `Tool from ${toolDef.serverName}`,
  parameters: zodSchema,
  // NO execute function - will trigger "input-available" state
  // Store metadata for approval UI
  _metadata: {
    serverId: toolDef.serverId,
    serverName: toolDef.serverName,
  }
};
```

**Note:** This change will cause AI SDK to forward tool calls to the frontend without execution, triggering the `input-available` state that we can intercept.

#### Step 4: Create Approval UI Component

**File:** `src/components/McpToolApproval.tsx`

```typescript
/**
 * MCP Tool Approval Component
 * Displays approval UI for MCP tool calls
 */

import React from 'react';
import { useToolApprovalStore } from '../ai/toolApprovalStore';
import { APPROVAL } from '../types/toolApproval';
import { getMcpServerIcon } from './ui/McpIconMapper';
import type { ToolApprovalRequest } from '../types/toolApproval';

interface McpToolApprovalProps {
  toolCallId: string;
  toolName: string;
  serverId: string;
  serverName: string;
  args: Record<string, any>;
  onApprove: (toolCallId: string) => Promise<void>;
  onDeny: (toolCallId: string) => Promise<void>;
}

export const McpToolApproval: React.FC<McpToolApprovalProps> = ({
  toolCallId,
  toolName,
  serverId,
  serverName,
  args,
  onApprove,
  onDeny,
}) => {
  const [isProcessing, setIsProcessing] = React.useState(false);
  const ServerIcon = getMcpServerIcon(serverId);

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await onApprove(toolCallId);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeny = async () => {
    setIsProcessing(true);
    try {
      await onDeny(toolCallId);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mcp-tool-approval">
      <div className="mcp-tool-approval-header">
        <div className="mcp-tool-approval-info">
          {ServerIcon && (
            <div className="mcp-tool-approval-icon">
              <ServerIcon width={20} height={20} />
            </div>
          )}
          <div className="mcp-tool-approval-details">
            <span className="mcp-tool-approval-name">{toolName}</span>
            <span className="mcp-tool-approval-server">{serverName}</span>
          </div>
        </div>
        <div className="mcp-tool-approval-badge">
          ⏳ Approval Required
        </div>
      </div>

      {args && Object.keys(args).length > 0 && (
        <details className="mcp-tool-approval-args" open>
          <summary className="mcp-tool-approval-args-title">
            Tool Arguments
          </summary>
          <pre className="mcp-tool-approval-args-content">
            {JSON.stringify(args, null, 2)}
          </pre>
        </details>
      )}

      <div className="mcp-tool-approval-actions">
        <button
          className="mcp-tool-approval-btn mcp-tool-approval-btn-approve"
          onClick={handleApprove}
          disabled={isProcessing}
        >
          {isProcessing ? '⏳ Processing...' : '✅ Approve'}
        </button>
        <button
          className="mcp-tool-approval-btn mcp-tool-approval-btn-deny"
          onClick={handleDeny}
          disabled={isProcessing}
        >
          {isProcessing ? '⏳ Processing...' : '❌ Deny'}
        </button>
      </div>

      <div className="mcp-tool-approval-warning">
        ⚠️ This tool will access external services. Review the arguments before approving.
      </div>
    </div>
  );
};
```

#### Step 5: Update ToolPartRenderer to Show Approval UI

**File:** `src/ai/ToolPartRenderer.tsx`

Add approval UI handling for MCP tools:

```typescript
// Import approval component and utilities
import { McpToolApproval } from '../components/McpToolApproval';
import { getToolServerId } from '../utils/toolMetadataStore';
import { isToolUIPart, getToolName } from 'ai';
import { APPROVAL } from '../types/toolApproval';

// Inside ToolPartRenderer component
function ToolPartRenderer({ part }: { part: any }) {
  const { addToolResult, sendMessage } = useChat(); // Get from context

  // Check if this is an MCP tool requiring approval
  if (isToolUIPart(part) && part.state === 'input-available') {
    const toolName = getToolName(part);
    const serverId = getToolServerId(toolName);
    
    // If this is an MCP tool, show approval UI
    if (serverId) {
      const handleApprove = async (toolCallId: string) => {
        // Add tool result with approval status
        await addToolResult({
          toolCallId,
          tool: toolName,
          output: APPROVAL.YES,
        });
        // Trigger continuation
        sendMessage();
      };

      const handleDeny = async (toolCallId: string) => {
        // Add tool result with denial status
        await addToolResult({
          toolCallId,
          tool: toolName,
          output: APPROVAL.NO,
        });
        // Trigger continuation
        sendMessage();
      };

      return (
        <McpToolApproval
          toolCallId={part.toolCallId}
          toolName={toolName}
          serverId={serverId}
          serverName={part._metadata?.serverName || serverId}
          args={part.input || {}}
          onApprove={handleApprove}
          onDeny={handleDeny}
        />
      );
    }
  }

  // Existing tool rendering logic for other tools...
}
```

#### Step 6: Create Tool Approval Processing Utility

**File:** `src/ai/toolApprovalProcessor.ts`

```typescript
/**
 * Tool Approval Processing Utilities
 * Handles processing of approved/denied tool calls
 */

import type { UIMessage, UIMessageStreamWriter } from 'ai';
import { isToolUIPart, getToolName, convertToModelMessages } from 'ai';
import { APPROVAL } from '../types/toolApproval';
import { createLogger } from '../logger';

const log = createLogger('ToolApprovalProcessor');

/**
 * Process tool calls that have been approved/denied by the user
 * 
 * This function:
 * 1. Checks the last message for tool calls with approval status
 * 2. Executes approved tools via background proxy
 * 3. Returns error messages for denied tools
 * 4. Updates tool results with actual execution results
 */
export async function processApprovedToolCalls(
  messages: UIMessage[],
  writer: UIMessageStreamWriter
): Promise<UIMessage[]> {
  const lastMessage = messages[messages.length - 1];
  
  if (!lastMessage || !lastMessage.parts) {
    return messages;
  }

  const processedParts = await Promise.all(
    lastMessage.parts.map(async (part) => {
      // Only process tool invocation parts with output
      if (!isToolUIPart(part) || part.state !== 'output-available') {
        return part;
      }

      const toolName = getToolName(part);
      const output = part.output;

      // Check if this is an approval response
      if (output === APPROVAL.YES) {
        log.info(`✅ Tool approved by user: ${toolName}`);
        
        try {
          // Execute tool via background proxy
          const result = await executeToolViaBackground(toolName, part.input);
          
          // Forward updated result to client
          writer.write({
            type: 'tool-output-available',
            toolCallId: part.toolCallId,
            output: result,
          });

          // Return updated part with actual result
          return {
            ...part,
            output: result,
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Tool execution failed';
          log.error(`❌ Tool execution failed: ${toolName}`, error);
          
          // Forward error to client
          writer.write({
            type: 'tool-output-available',
            toolCallId: part.toolCallId,
            output: { error: errorMsg },
          });

          return {
            ...part,
            output: { error: errorMsg },
          };
        }
      } else if (output === APPROVAL.NO) {
        log.info(`❌ Tool denied by user: ${toolName}`);
        
        const denialMsg = { error: 'Tool execution denied by user' };
        
        // Forward denial to client
        writer.write({
          type: 'tool-output-available',
          toolCallId: part.toolCallId,
          output: denialMsg,
        });

        return {
          ...part,
          output: denialMsg,
        };
      }

      // Not an approval response, return unchanged
      return part;
    })
  );

  // Return updated messages
  return [
    ...messages.slice(0, -1),
    { ...lastMessage, parts: processedParts },
  ];
}

/**
 * Execute a tool via the background service worker
 */
async function executeToolViaBackground(
  toolName: string,
  args: Record<string, any>
): Promise<any> {
  // Get tool metadata to determine server
  const { getToolServerId } = await import('../utils/toolMetadataStore');
  const serverId = getToolServerId(toolName);

  if (!serverId) {
    throw new Error(`Cannot determine server for tool: ${toolName}`);
  }

  // Execute via background proxy
  const result = await chrome.runtime.sendMessage({
    type: `mcp/${serverId}/tool/call`,
    payload: {
      name: toolName,
      arguments: args,
    },
  });

  if (!result.success) {
    throw new Error(result.error || 'Tool execution failed');
  }

  return result.data;
}
```

#### Step 7: Integrate Approval Processing in AI Logic

**File:** `src/ai/aiLogic.ts`

Modify the `streamAIResponse` function to process approved tool calls:

```typescript
import { processApprovedToolCalls } from './toolApprovalProcessor';

// Inside createUIMessageStream execute function
const stream = createUIMessageStream({
  originalMessages: messages,
  execute: async ({ writer }) => {
    // Process any approved/denied tool calls from last message
    const processedMessages = await processApprovedToolCalls(messages, writer);

    // Convert to model messages
    const modelMessages = convertToModelMessages(processedMessages);

    // Continue with existing streamText logic...
    const result = streamText({
      model,
      system: enhancedSystemPrompt,
      messages: modelMessages,
      tools, // MCP tools WITHOUT execute functions
      // ... rest of config
    });

    writer.merge(result.toUIMessageStream({ 
      originalMessages: processedMessages 
    }));
  },
});
```

#### Step 8: Create Approval UI Styles

**File:** `src/styles/tool-approval.css`

```css
/* MCP Tool Approval Styles */

.mcp-tool-approval {
  background: rgba(255, 165, 0, 0.05);
  border: 2px solid rgba(255, 165, 0, 0.3);
  border-radius: 8px;
  padding: 16px;
  margin: 12px 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  animation: pulse-border 2s ease-in-out infinite;
}

@keyframes pulse-border {
  0%, 100% {
    border-color: rgba(255, 165, 0, 0.3);
  }
  50% {
    border-color: rgba(255, 165, 0, 0.6);
  }
}

.mcp-tool-approval-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.mcp-tool-approval-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mcp-tool-approval-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: rgba(255, 165, 0, 0.1);
  padding: 4px;
}

.mcp-tool-approval-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mcp-tool-approval-name {
  font-weight: 600;
  font-size: 14px;
  color: #1a1a1a;
}

.mcp-tool-approval-server {
  font-size: 12px;
  color: #666;
}

.mcp-tool-approval-badge {
  background: rgba(255, 165, 0, 0.2);
  color: #d97706;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.mcp-tool-approval-args {
  margin: 12px 0;
  border: 1px solid rgba(255, 165, 0, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.5);
}

.mcp-tool-approval-args-title {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #666;
  cursor: pointer;
  user-select: none;
}

.mcp-tool-approval-args-content {
  padding: 12px;
  margin: 0;
  font-size: 12px;
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  overflow-x: auto;
  background: rgba(0, 0, 0, 0.02);
  border-top: 1px solid rgba(255, 165, 0, 0.2);
}

.mcp-tool-approval-actions {
  display: flex;
  gap: 8px;
  margin: 16px 0 12px;
}

.mcp-tool-approval-btn {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mcp-tool-approval-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mcp-tool-approval-btn-approve {
  background: #22c55e;
  color: white;
}

.mcp-tool-approval-btn-approve:hover:not(:disabled) {
  background: #16a34a;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
}

.mcp-tool-approval-btn-deny {
  background: #ef4444;
  color: white;
}

.mcp-tool-approval-btn-deny:hover:not(:disabled) {
  background: #dc2626;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.mcp-tool-approval-warning {
  font-size: 11px;
  color: #d97706;
  padding: 8px 12px;
  background: rgba(255, 165, 0, 0.1);
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}
```

#### Step 9: Import Styles in Sidepanel

**File:** `src/sidepanel.tsx`

Add the import:

```typescript
import "./styles/tool-approval.css";
```

### Testing Strategy for Phase 1

1. **Test Basic Approval Flow**
   - Start a new chat
   - Trigger an MCP tool call (e.g., "search my Notion pages")
   - Verify approval UI appears
   - Click "Approve" and verify tool executes
   - Verify result is displayed

2. **Test Denial Flow**
   - Trigger an MCP tool call
   - Click "Deny"
   - Verify tool is not executed
   - Verify AI receives denial message and can respond appropriately

3. **Test Multiple Tool Calls**
   - Trigger multiple MCP tools in one response
   - Verify each tool shows separate approval UI
   - Test approving some and denying others

4. **Test Arguments Display**
   - Trigger tools with various argument types
   - Verify arguments are displayed correctly in JSON format
   - Test with nested objects and arrays

5. **Test Error Handling**
   - Approve a tool that will fail
   - Verify error message is displayed appropriately
   - Verify AI can handle the error gracefully

## Phase 2: Auto-Approve Feature

### Goal
Add a session-based auto-approve mechanism where users can enable automatic approval for all tools from a specific MCP server during the current chat session.

### Additional Features

#### 1. Auto-Approve Toggle in Approval UI

Enhance `McpToolApproval` component with auto-approve option:

```typescript
// Add to McpToolApproval component
const { enableAutoApprove, isAutoApproved } = useToolApprovalStore();
const [showAutoApprove, setShowAutoApprove] = useState(false);

const handleApproveAndAutoApprove = async () => {
  enableAutoApprove(serverId);
  await handleApprove(toolCallId);
};

// Add in JSX
<div className="mcp-tool-approval-auto">
  <label className="mcp-tool-approval-auto-label">
    <input
      type="checkbox"
      checked={showAutoApprove}
      onChange={(e) => setShowAutoApprove(e.target.checked)}
    />
    Auto-approve all tools from {serverName} in this session
  </label>
</div>

{showAutoApprove && (
  <button
    className="mcp-tool-approval-btn mcp-tool-approval-btn-approve-all"
    onClick={handleApproveAndAutoApprove}
    disabled={isProcessing}
  >
    ✅ Approve & Enable Auto-Approve
  </button>
)}
```

#### 2. Auto-Approve Check in Tool Processing

Modify `processApprovedToolCalls` to check auto-approve status:

```typescript
export async function processApprovedToolCalls(
  messages: UIMessage[],
  writer: UIMessageStreamWriter
): Promise<UIMessage[]> {
  const { isAutoApproved } = useToolApprovalStore.getState();
  
  // ... existing code ...
  
  const processedParts = await Promise.all(
    lastMessage.parts.map(async (part) => {
      if (!isToolUIPart(part) || part.state !== 'output-available') {
        return part;
      }

      const toolName = getToolName(part);
      const serverId = getToolServerId(toolName);
      
      // Check if server is auto-approved
      if (serverId && isAutoApproved(serverId)) {
        log.info(`🚀 Auto-approving tool: ${toolName} (server: ${serverId})`);
        
        try {
          const result = await executeToolViaBackground(toolName, part.input);
          // ... same as approved flow
        } catch (error) {
          // ... same as error flow
        }
      }

      // ... rest of existing logic
    })
  );
}
```

#### 3. Auto-Approve Indicator

Show visual indicator when auto-approve is active:

```typescript
// Add to ToolPartRenderer or McpToolCall
const { isAutoApproved } = useToolApprovalStore();

if (isAutoApproved(serverId)) {
  return (
    <div className="mcp-tool-auto-approved">
      <div className="mcp-tool-auto-approved-badge">
        ⚡ Auto-Approved
      </div>
      <McpToolCall
        name={toolName}
        status="executing"
        args={args}
        serverId={serverId}
      />
    </div>
  );
}
```

#### 4. Session Management

Clear auto-approve settings when appropriate:

```typescript
// In sidepanel.tsx
useEffect(() => {
  // Clear auto-approve when switching threads
  const { clearAutoApprove } = useToolApprovalStore.getState();
  clearAutoApprove();
}, [currentThreadId]);

// Optional: Add UI to manually clear auto-approve
const handleClearAutoApprove = () => {
  const { clearAutoApprove } = useToolApprovalStore.getState();
  clearAutoApprove();
};
```

#### 5. Auto-Approve Management UI

Add settings panel to view/manage auto-approved servers:

```typescript
// Component: src/components/AutoApprovePanel.tsx
export const AutoApprovePanel = () => {
  const { autoApproveServers, disableAutoApprove } = useToolApprovalStore();
  
  return (
    <div className="auto-approve-panel">
      <h3>Auto-Approved Servers</h3>
      {autoApproveServers.size === 0 ? (
        <p>No servers have auto-approve enabled</p>
      ) : (
        <ul>
          {Array.from(autoApproveServers).map((serverId) => (
            <li key={serverId}>
              <span>{serverId}</span>
              <button onClick={() => disableAutoApprove(serverId)}>
                Disable
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
```

### Testing Strategy for Phase 2

1. **Test Auto-Approve Enable**
   - Trigger MCP tool call
   - Enable auto-approve checkbox
   - Approve tool
   - Verify subsequent tools from same server auto-approve

2. **Test Auto-Approve Persistence**
   - Enable auto-approve for a server
   - Trigger multiple tool calls
   - Verify all auto-approve without UI

3. **Test Auto-Approve Clear**
   - Enable auto-approve
   - Switch threads
   - Verify auto-approve is cleared
   - Trigger tool and verify approval UI shows again

4. **Test Multiple Servers**
   - Enable auto-approve for Server A
   - Trigger tools from Server A (auto-approve)
   - Trigger tools from Server B (show approval UI)
   - Enable auto-approve for Server B
   - Verify both servers auto-approve

5. **Test Management UI**
   - Enable auto-approve for multiple servers
   - Open management panel
   - Disable auto-approve for one server
   - Verify tool now requires approval

## Security Considerations

1. **Argument Validation**
   - Display all arguments clearly before execution
   - Highlight potentially dangerous operations
   - Consider adding "argument sanitization" warnings

2. **Server Trust Indicators**
   - Show server credentials status
   - Display last successful connection time
   - Add visual indicators for verified vs unverified servers

3. **Audit Trail**
   - Log all approved/denied tool calls
   - Store timestamps and user decisions
   - Allow users to review past approvals

4. **Rate Limiting**
   - Consider limiting number of auto-approved tools per session
   - Add cooldown periods for sensitive operations
   - Implement safeguards for bulk operations

## UI/UX Considerations

1. **Approval Timeout**
   - Add timeout for pending approvals (e.g., 5 minutes)
   - Auto-deny expired approvals
   - Notify user when timeout occurs

2. **Keyboard Shortcuts**
   - Add keyboard shortcuts (e.g., Cmd+Enter to approve)
   - Support Tab navigation between approve/deny buttons
   - Add Escape key to cancel

3. **Accessibility**
   - Ensure screen reader compatibility
   - Add ARIA labels to all interactive elements
   - Provide clear focus indicators

4. **Mobile Considerations**
   - Ensure touch-friendly button sizes
   - Optimize layout for smaller screens
   - Test on various device sizes

## Performance Considerations

1. **Approval State Management**
   - Use Zustand for efficient state management
   - Avoid unnecessary re-renders
   - Clean up completed approvals

2. **Message Processing**
   - Process approvals efficiently
   - Avoid blocking the main thread
   - Use async/await properly

3. **UI Rendering**
   - Use React.memo for approval components
   - Lazy load approval UI when needed
   - Optimize CSS animations

## Future Enhancements

1. **Persistent Auto-Approve**
   - Store auto-approve preferences in chrome.storage
   - Allow persistent auto-approve across sessions
   - Add server-level trust settings

2. **Approval Templates**
   - Create reusable approval rules
   - Allow bulk approval for common patterns
   - Add smart approval suggestions

3. **Integration with MCP Settings**
   - Show approval settings in MCP server configuration
   - Allow pre-configuring trusted tools
   - Add tool-level permissions

4. **Advanced Notifications**
   - Browser notifications for pending approvals
   - Sound alerts for important decisions
   - Visual indicators in extension icon

## Migration Path

### From Current State to Phase 1

1. **Preparation**
   - Backup current codebase
   - Create feature branch
   - Update dependencies if needed

2. **Implementation Order**
   - Create type definitions
   - Implement approval store
   - Modify mcpProxy.ts
   - Create approval UI component
   - Update ToolPartRenderer
   - Create approval processor
   - Integrate in aiLogic.ts
   - Add styles
   - Test thoroughly

3. **Rollout**
   - Deploy to development environment
   - Conduct user testing
   - Gather feedback
   - Fix issues
   - Deploy to production

### From Phase 1 to Phase 2

1. **Enhance Store**
   - Add auto-approve state
   - Implement persistence logic

2. **Update UI**
   - Add auto-approve toggle
   - Create management panel
   - Add indicators

3. **Update Processing**
   - Add auto-approve checks
   - Implement bypass logic

4. **Testing**
   - Test all scenarios
   - Verify performance
   - Check security

## Documentation Requirements

1. **User Documentation**
   - How to approve/deny tools
   - How to use auto-approve
   - Security best practices

2. **Developer Documentation**
   - Architecture overview
   - API reference
   - Extension guide for new tools

3. **Video Tutorials**
   - Demo of approval mechanism
   - Auto-approve walkthrough
   - Troubleshooting guide

## Success Metrics

1. **Phase 1 Success**
   - ✅ All MCP tools require approval
   - ✅ Approval UI renders correctly
   - ✅ Approved tools execute successfully
   - ✅ Denied tools don't execute
   - ✅ Error handling works properly

2. **Phase 2 Success**
   - ✅ Auto-approve can be enabled
   - ✅ Auto-approved tools skip UI
   - ✅ Auto-approve clears on thread switch
   - ✅ Management UI works correctly
   - ✅ Multiple servers supported

## Conclusion

This implementation plan provides a comprehensive roadmap for adding a human-in-the-loop approval mechanism for MCP tool calls. The phased approach allows for iterative development and testing, ensuring each feature is solid before moving to the next.

**Phase 1** focuses on the core approval mechanism, requiring user confirmation for every MCP tool call. This provides maximum security and control.

**Phase 2** adds convenience through auto-approve, allowing power users to streamline their workflow while maintaining security through session-based scoping.

The architecture leverages AI SDK v5's built-in support for human-in-the-loop workflows, following the same patterns demonstrated in the official documentation, adapted for a Chrome extension context.

## Next Steps

1. ✅ Review this plan
2. ⏳ Get approval to proceed
3. ⏳ Create feature branch
4. ⏳ Begin Phase 1 implementation
5. ⏳ Conduct testing
6. ⏳ Deploy Phase 1
7. ⏳ Begin Phase 2 implementation

---

**Document Version:** 1.0  
**Created:** October 21, 2025  
**Status:** Pending Approval
