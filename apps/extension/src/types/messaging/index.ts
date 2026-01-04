/**
 * Central Message Type Registry
 *
 * ALL extension messages must be defined here.
 * This ensures type safety across all contexts.
 *
 * @see /docs/TYPE_SAFE_MESSAGING.md for API reference
 */

// Re-export MCP message types
export * from './mcp';

// Re-export port message types
export * from './ports';

// =============================================================================
// REQUEST/RESPONSE TYPE HELPERS
// =============================================================================

/**
 * Defines a message with its payload and response types.
 * Use `undefined` for payload when no data is needed.
 * Use `void` for response when no response is expected.
 */
export interface MessageDefinition<TPayload = undefined, TResponse = void> {
    payload: TPayload;
    response: TResponse;
}

// =============================================================================
// MESSAGE REGISTRY
// =============================================================================

/**
 * Central registry of all message types in the extension.
 *
 * When adding new messages:
 * 1. Add the type here with payload and response types
 * 2. Add handler in the appropriate background handler file
 * 3. Optionally add Zod schema in validators.ts
 */
export interface MessageRegistry {
    // -------------------------------------------------------------------------
    // Tab Context Messages
    // -------------------------------------------------------------------------

    /** Get the current tab ID */
    GET_CURRENT_TAB_ID: MessageDefinition<undefined, { tabId: number | undefined }>;

    /** Get provider capabilities for the active AI provider */
    GET_PROVIDER_CAPABILITIES: MessageDefinition<
        undefined,
        {
            provider: string;
            capabilities: {
                functionCalling: boolean;
                webSearch: boolean;
                urlContext: boolean;
                multimodal: boolean;
                streaming: boolean;
                memoryFunctionCalling: boolean;
            };
        }
    >;

    // -------------------------------------------------------------------------
    // Memory / Supermemory Messages
    // -------------------------------------------------------------------------

    /** Check if Supermemory is ready to use */
    CHECK_SUPERMEMORY_READY: MessageDefinition<undefined, { ready: boolean }>;

    /** Queue a memory extraction for a chat thread */
    QUEUE_MEMORY_EXTRACTION: MessageDefinition<
        { threadId: string; messageCount: number },
        { success: boolean; error?: string }
    >;

    // -------------------------------------------------------------------------
    // UI Messages
    // -------------------------------------------------------------------------

    /** Check if sidebar is currently open */
    CHECK_SIDEBAR_STATUS: MessageDefinition<undefined, { isOpen: boolean }>;

    /** Open the sidebar panel */
    OPEN_SIDEBAR: MessageDefinition<undefined, { success: boolean; error?: string }>;

    /** Open the sidebar with a message and optional attachments */
    OPEN_SIDEBAR_WITH_MESSAGE: MessageDefinition<
        { message: string; tabAttachments?: unknown[] },
        { success: boolean; error?: string }
    >;

    /** Notification that sidebar has been opened (broadcast to content scripts) */
    SIDEBAR_OPENED: MessageDefinition<undefined, void>;

    /** Model download progress notification */
    MODEL_DOWNLOAD_PROGRESS: MessageDefinition<
        { modelId: string; loaded: number; total: number; progress: number },
        { success: boolean }
    >;

    /** Model download progress update (relayed to sidepanel) */
    MODEL_DOWNLOAD_PROGRESS_UPDATE: MessageDefinition<
        { modelId: string; loaded: number; total: number; progress: number },
        void
    >;

    // -------------------------------------------------------------------------
    // AI Notifications
    // -------------------------------------------------------------------------

    /** Create an AI notification */
    'ai/notification/create': MessageDefinition<
        { threadId: string; title: string; message: string; timestamp: number },
        { success: boolean; notificationId?: string; error?: string }
    >;

    /** Handle notification action (continue, dismiss, navigate) */
    'ai/notification/action': MessageDefinition<
        { action: 'continue' | 'dismiss' | 'navigate'; threadId: string },
        { success: boolean; error?: string }
    >;

    // -------------------------------------------------------------------------
    // Summarizer Messages
    // -------------------------------------------------------------------------

    /** Check summarizer availability */
    'summarize:availability': MessageDefinition<
        undefined,
        { available: boolean; error?: string }
    >;

    /** Request text summarization via offscreen document */
    'summarize:request': MessageDefinition<
        {
            requestId: string;
            text: string;
            options: {
                type: 'key-points' | 'tl-dr' | 'headline' | 'teaser';
                format: 'markdown' | 'plain-text';
                length: 'short' | 'medium' | 'long';
                sharedContext?: string;
            };
            context?: string;
        },
        { ok: boolean; summary?: string; error?: string }
    >;

    // -------------------------------------------------------------------------
    // Geolocation Messages
    // -------------------------------------------------------------------------

    /** Request geolocation from offscreen document */
    'geolocation/request': MessageDefinition<
        undefined,
        | { success: true; position: GeolocationPosition }
        | { success: false; errorType: 'denied' | 'timeout' | 'unavailable' | 'unknown'; error: string }
    >;

    // -------------------------------------------------------------------------
    // File Messages
    // -------------------------------------------------------------------------

    /** Read a local PDF file */
    READ_LOCAL_PDF: MessageDefinition<
        { filePath: string },
        { success: boolean; content?: string; filename?: string; error?: string }
    >;

    // -------------------------------------------------------------------------
    // Offscreen Document Messages
    // -------------------------------------------------------------------------

    /** Check offscreen summarizer availability */
    'offscreen/summarize/availability': MessageDefinition<undefined, { available: boolean }>;

    /** Run summarization in offscreen document */
    'offscreen/summarize/request': MessageDefinition<
        {
            text: string;
            type: 'key-points' | 'tl-dr' | 'headline' | 'teaser';
            format: 'markdown' | 'plain-text';
            length: 'short' | 'medium' | 'long';
        },
        { success: boolean; result?: string; error?: string }
    >;

    /** Request geolocation from offscreen document */
    'offscreen/geolocation/request': MessageDefinition<
        undefined,
        { position: GeolocationPosition } | { error: string; errorType: string }
    >;

    // -------------------------------------------------------------------------
    // WebMCP Messages
    // -------------------------------------------------------------------------

    /** Register WebMCP tools from content script */
    'webmcp/tools/register': MessageDefinition<
        {
            tools: Array<{
                name: string;
                originalName: string;
                description?: string;
                domain: string;
                tabId: number;
                url: string;
                favicon?: string;
                inputSchema: Record<string, unknown>;
            }>;
            tabId: number;
            domain: string;
            url: string;
        },
        { success: boolean; error?: string }
    >;

    /** List available WebMCP tools */
    'webmcp/tools/list': MessageDefinition<
        undefined,
        { success: boolean; data?: { tools: unknown[] }; error?: string }
    >;

    /** Get full WebMCP state */
    'webmcp/tools/state': MessageDefinition<
        undefined,
        {
            success: boolean;
            data?: {
                tools: unknown[];
                activeTabId: number | null;
                activeDomain: string | null;
                isDiscovering: boolean;
                lastUpdated: number;
            };
            error?: string;
        }
    >;

    /** Call a WebMCP tool */
    'webmcp/tool/call': MessageDefinition<
        { toolName: string; args: Record<string, unknown> },
        { success: boolean; result?: unknown; error?: string }
    >;

    /** Refresh WebMCP tools */
    'webmcp/tools/refresh': MessageDefinition<undefined, { success: boolean; error?: string }>;

    /** Notification that WebMCP tools have been updated */
    'webmcp/tools/updated': MessageDefinition<{ tools: unknown[] }, void>;

}

// =============================================================================
// TYPE UTILITIES
// =============================================================================

/** All available message types */
export type MessageType = keyof MessageRegistry;

/** Extract payload type for a message */
export type MessagePayload<T extends MessageType> = MessageRegistry[T]['payload'];

/** Extract response type for a message */
export type MessageResponse<T extends MessageType> = MessageRegistry[T]['response'];

/**
 * Runtime message structure with type and optional payload
 */
export interface TypedMessage<T extends MessageType = MessageType> {
    type: T;
    payload?: MessagePayload<T>;
}

/**
 * Type guard to check if a value is a typed message
 */
export function isTypedMessage(value: unknown): value is TypedMessage {
    return (
        typeof value === 'object' &&
        value !== null &&
        'type' in value &&
        typeof (value as { type: unknown }).type === 'string'
    );
}

/**
 * Type guard to check if a message is of a specific type
 */
export function isMessageType<T extends MessageType>(
    message: unknown,
    type: T
): message is TypedMessage<T> {
    return isTypedMessage(message) && message.type === type;
}

/**
 * Message types that don't require a payload
 */
export type NoPayloadMessageType = {
    [K in MessageType]: MessagePayload<K> extends undefined ? K : never;
}[MessageType];

/**
 * Message types that require a payload
 */
export type PayloadMessageType = Exclude<MessageType, NoPayloadMessageType>;
