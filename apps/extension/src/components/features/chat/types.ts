/**
 * Chat Component Types
 * 
 * This file defines types used by chat components.
 * 
 * ## Mode Taxonomy in the Extension
 * 
 * The extension uses 4 distinct "mode" concepts:
 * 
 * ### 1. AIProviderMode (local/remote)
 * **Purpose**: Determines WHERE the AI inference runs.
 * **Values**:
 * - `local`: Uses Chrome's built-in AI (on-device Gemini Nano)
 * - `remote`: Uses cloud API (Gemini Pro/Flash)
 * **Store**: `useModelStore.mode`
 * 
 * ### 2. ToolsMode (chat/agent/adaptive/custom)
 * **Purpose**: Determines WHICH TOOLS are available to the AI.
 * **Values**:
 * - `chat`: Minimal tools, focused on reading and Q&A
 * - `agent`: Full browser automation capabilities
 * - `adaptive`: On-demand tool discovery via `discoverTools` + `executeTools`
 * - `custom`: User has customized the tool selection
 * **Store**: `useToolsStore.currentMode`
 * **Definition**: See `@/types/settings.ts`
 * 
 * ### 3. ChatMode (text/voice)
 * **Purpose**: Determines the user INPUT METHOD.
 * **Values**:
 * - `text`: User types messages
 * - `voice`: User speaks via ElevenLabs voice mode
 * **Store**: `useUINavigationStore.chatMode`
 * **Definition**: See `@/stores/ui/types.ts`
 * 
 * ### 4. Backend Mode (boolean)
 * **Purpose**: Determines HOW the remote AI API is called.
 * **Values**:
 * - `true`: Uses hosted Vercel backend (no API key needed, rate limited)
 * - `false`: BYOK mode (Bring Your Own Key - direct Google AI API calls)
 * **Store**: `useSettingsStore.useBackendMode`
 * **Features**:
 * - Graceful degradation (auto-fallback to BYOK when rate limited)
 * - Frontend tools pattern (backend sends tool schemas, extension executes)
 * - See `src/ai/backend/` for implementation
 * 
 * ## How Modes Interact
 * 
 * ```
 * AIProviderMode = 'local'  → Uses Chrome built-in AI (ToolsMode still applies)
 * AIProviderMode = 'remote' → Check Backend Mode:
 *   └─ useBackendMode = true  → Vercel backend API
 *   └─ useBackendMode = false → Direct Google AI API (requires API key)
 * ```
 * 
 * ToolsMode and ChatMode are independent of AIProviderMode/Backend Mode.
 */

export interface MessagePart {
    type: string;
    content?: string;
    toolCallId?: string;
    toolName?: string;
    result?: any;
    args?: Record<string, any>;
}

export interface Message {
    id?: string;
    role: 'user' | 'assistant';
    content: string;
    parts?: MessagePart[];
    generativeUI?: () => React.ReactElement | null;
    attachments?: FileAttachment[];
    metadata?: {
        internal?: boolean;
        [key: string]: any;
    };
}

export interface FileAttachment {
    name: string;
    size: number;
    type: string;
    mimeType: string;
    content?: string; // Base64 content
    url?: string; // For images
}

/**
 * ExecutionMode - where AI runs (older term used in some places)
 * 
 * Prefer `AIProviderMode` for new code.
 */
export type ExecutionMode = 'local' | 'cloud';

/**
 * AI Provider Mode - where the AI inference runs
 * 
 * - `local`: Uses Chrome's built-in AI (on-device Gemini Nano)
 * - `remote`: Uses cloud API (Gemini Pro/Flash)
 * 
 * When `remote` is selected, the API call routing depends on Backend Mode:
 * - Backend Mode ON: Uses hosted Vercel backend (no API key needed)
 * - Backend Mode OFF: BYOK - direct Google AI API calls (requires API key)
 */
export type AIProviderMode = 'local' | 'remote';

/**
 * AIMode - alias for AIProviderMode
 * 
 * Many files import `AIMode` instead of `AIProviderMode`.
 * Both refer to the same concept: where AI inference runs.
 */
export type AIMode = AIProviderMode;

export type RemoteModelType =
    | 'gemini-2.5-flash'
    | 'gemini-2.5-flash-lite'
    | 'gemini-2.5-pro'
    | 'gemini-2.5-flash-image'
    | 'gemini-3-flash-preview'
    | 'gemini-3-pro-preview';

export interface ModelState {
    mode: AIProviderMode;
    remoteModel: RemoteModelType;
    hasApiKey: boolean;
    conversationStartMode?: AIProviderMode | null;
    isLoading?: boolean;
}

