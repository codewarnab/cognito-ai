import type { CodeModeElementContext } from '@cognito/shared/types';

export interface CodeModeChatParams {
  messages: Array<{
    role: 'user' | 'assistant';
    content: Array<{ type: 'text'; text: string }>;
  }>;
  elementContext?: CodeModeElementContext;
  agent: {
    name: string;
    command: string;
    args: string[];
  };
  sessionId?: string;
}

export interface BridgeTextEvent {
  type: 'text';
  content: string;
}

export interface BridgePatchProposalEvent {
  type: 'patch_proposal';
  patchId: string;
  unifiedDiff: string;
  summary?: string;
}

export interface BridgeToolCallEvent {
  type: 'tool_call';
  toolName: string;
  toolCallId: string;
  args: Record<string, unknown>;
}

export interface BridgeToolResultEvent {
  type: 'tool_result';
  toolCallId: string;
  result: unknown;
}

export interface BridgeErrorEvent {
  type: 'error';
  error: string;
}

export interface BridgeDoneEvent {
  type: 'done';
}

export type BridgeEvent =
  | BridgeTextEvent
  | BridgePatchProposalEvent
  | BridgeToolCallEvent
  | BridgeToolResultEvent
  | BridgeErrorEvent
  | BridgeDoneEvent;

export interface ApplyPatchResult {
  applied: boolean;
  filesChanged: string[];
  error?: string;
}
