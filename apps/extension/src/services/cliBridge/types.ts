
export type CliBridgeToolsMode = 'chat' | 'agent' | 'adaptive' | 'custom';

export interface CliBridgeChatParams {
    messages: Array<{
        role: 'user' | 'assistant';
        content: Array<
            | { type: 'text'; text: string }
            | { type: 'image'; data: string; mimeType: string }
            | { type: 'audio'; data: string; mimeType: string }
            | { type: 'resource'; data: string; mimeType: string; name: string }
        >;
    }>;
    agent: {
        name: string;
        command: string;
        args: string[];
    };
    /** List of enabled tool names - bridge will filter available tools to only these */
    enabledTools?: string[];
    /**
     * Tools mode (chat/agent/adaptive/custom) to help the bridge pick the right system prompt.
     * NOTE: This is NOT the provider selection (cloud vs CLI). Provider selection is handled separately.
     */
    toolsMode?: CliBridgeToolsMode;
    sessionId?: string;
}

export interface BridgeTextEvent {
    type: 'text';
    content: string;
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

export interface BridgeStatusEvent {
    type: 'status';
    message: string;
}

export type BridgeEvent =
    | BridgeTextEvent
    | BridgeToolCallEvent
    | BridgeToolResultEvent
    | BridgeErrorEvent
    | BridgeDoneEvent
    | BridgeStatusEvent;

// SSE Event Types for real-time bridge connection
export interface BridgeSSEConnectedEvent {
    type: 'connected';
    version: string;
    cwd: string;
}

export interface BridgeSSEHeartbeatEvent {
    type: 'heartbeat';
    timestamp: number;
}

export interface BridgeSSEClosingEvent {
    type: 'bridge:closing';
    reason: string;
}

export type BridgeSSEEvent =
    | BridgeSSEConnectedEvent
    | BridgeSSEHeartbeatEvent
    | BridgeSSEClosingEvent;
