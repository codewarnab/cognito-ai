/**
 * Type-safe event system for extension messaging
 * Provides strongly-typed Chrome runtime messaging
 */

/**
 * Event type definitions
 * Add new events here to maintain type safety across the extension
 */
export interface EventMap {
    // Model download events
    'MODEL_DOWNLOAD_PROGRESS': {
        modelId: string;
        loaded: number;
        total: number;
        progress: number;
    };
    'MODEL_DOWNLOAD_COMPLETE': {
        modelId: string;
        timestamp: number;
    };
    'MODEL_DOWNLOAD_ERROR': {
        modelId: string;
        error: string;
        retryable: boolean;
    };

    // Chat events
    'CONVERSATION_UPDATED': {
        threadId: string;
        lastMessageId?: string;
        timestamp: number;
    };
    'CONVERSATION_DELETED': {
        threadId: string;
    };
    'MESSAGE_SENT': {
        threadId: string;
        messageId: string;
        content: string;
    };
    'MESSAGE_RECEIVED': {
        threadId: string;
        messageId: string;
        content: string;
    };

    // Settings events
    'SETTINGS_CHANGED': {
        key: string;
        value: unknown;
        previousValue?: unknown;
    };
    'THEME_CHANGED': {
        theme: 'light' | 'dark' | 'system';
    };

    // MCP events
    'MCP_MESSAGE': {
        type: string;
        payload: unknown;
    };
    'MCP_CONNECTED': {
        serverId: string;
        serverName: string;
    };
    'MCP_DISCONNECTED': {
        serverId: string;
        reason?: string;
    };

    // Extension lifecycle events
    'EXTENSION_READY': {
        timestamp: number;
    };
    'EXTENSION_ERROR': {
        error: string;
        context?: string;
    };

    // Tab events
    'TAB_ACTIVATED': {
        tabId: number;
        url?: string;
    };
    'TAB_CONTEXT_CHANGED': {
        tabId: number;
        context: {
            url?: string;
            title?: string;
            favicon?: string;
        };
    };

    // Memory events
    'MEMORY_SAVED': {
        key: string;
        timestamp: number;
    };
    'MEMORY_RETRIEVED': {
        key: string;
        found: boolean;
    };
    'MEMORY_DELETED': {
        key: string;
    };

    // Tool execution events
    'TOOL_EXECUTION_START': {
        toolName: string;
        requestId: string;
    };
    'TOOL_EXECUTION_COMPLETE': {
        toolName: string;
        requestId: string;
        success: boolean;
    };
    'TOOL_EXECUTION_ERROR': {
        toolName: string;
        requestId: string;
        error: string;
    };

    // Voice events
    'VOICE_RECORDING_START': {
        timestamp: number;
    };
    'VOICE_RECORDING_STOP': {
        duration: number;
        timestamp: number;
    };
    'VOICE_TRANSCRIPTION_COMPLETE': {
        text: string;
        confidence?: number;
    };
}

/**
 * Get event type names
 */
export type EventType = keyof EventMap;

/**
 * Get payload type for a specific event
 */
export type EventPayload<T extends EventType> = EventMap[T];

/**
 * Type-safe event listener function
 */
export interface TypedEventListener<T extends EventType> {
    (payload: EventPayload<T>): void | Promise<void>;
}

/**
 * Chrome runtime message with type safety
 */
export interface TypedRuntimeMessage<T extends EventType = EventType> {
    type: T;
    payload: EventPayload<T>;
    timestamp?: number;
    source?: string;
}

/**
 * Type guard to check if a value is a typed runtime message
 */
export function isTypedMessage(value: unknown): value is TypedRuntimeMessage {
    return (
        typeof value === 'object' &&
        value !== null &&
        'type' in value &&
        typeof (value as { type: unknown }).type === 'string' &&
        'payload' in value
    );
}

/**
 * Type guard to check if a message is of a specific type
 */
export function isMessageOfType<T extends EventType>(
    message: unknown,
    type: T
): message is TypedRuntimeMessage<T> {
    return (
        isTypedMessage(message) &&
        message.type === type
    );
}

/**
 * Type-safe message sender
 * Sends a message to the Chrome runtime
 */
export function sendTypedMessage<T extends EventType>(
    type: T,
    payload: EventPayload<T>,
    options?: {
        timestamp?: number;
        source?: string;
    }
): Promise<void> {
    const message: TypedRuntimeMessage<T> = {
        type,
        payload,
        timestamp: options?.timestamp ?? Date.now(),
        source: options?.source,
    };

    return new Promise((resolve, reject) => {
        if (typeof chrome === 'undefined' || !chrome.runtime) {
            reject(new Error('Chrome runtime is not available'));
            return;
        }

        chrome.runtime.sendMessage(message, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve();
            }
        });
    });
}

/**
 * Type-safe message listener
 * Listens for messages of a specific type
 */
export function addTypedMessageListener<T extends EventType>(
    type: T,
    listener: TypedEventListener<T>
): () => void {
    const wrappedListener = (
        message: unknown,
        _sender: chrome.runtime.MessageSender,
        sendResponse: (response?: unknown) => void
    ): void => {
        if (isMessageOfType(message, type)) {
            Promise.resolve(listener(message.payload))
                .then(() => sendResponse({ success: true }))
                .catch((error) => {
                    console.error(`Error in event listener for ${type}:`, error);
                    sendResponse({ success: false, error: String(error) });
                });
        }
    };

    chrome.runtime.onMessage.addListener(wrappedListener);

    // Return cleanup function
    return () => {
        chrome.runtime.onMessage.removeListener(wrappedListener);
    };
}

/**
 * Type-safe message broadcaster
 * Broadcasts a message to all tabs
 */
export async function broadcastTypedMessage<T extends EventType>(
    type: T,
    payload: EventPayload<T>,
    options?: {
        timestamp?: number;
        source?: string;
    }
): Promise<void> {
    const message: TypedRuntimeMessage<T> = {
        type,
        payload,
        timestamp: options?.timestamp ?? Date.now(),
        source: options?.source,
    };

    if (typeof chrome === 'undefined' || !chrome.tabs) {
        throw new Error('Chrome tabs API is not available');
    }

    const tabs = await chrome.tabs.query({});

    await Promise.allSettled(
        tabs.map((tab) => {
            if (tab.id !== undefined) {
                return chrome.tabs.sendMessage(tab.id, message);
            }
            return Promise.resolve();
        })
    );
}

/**
 * Event emitter class for type-safe local events
 * Useful for in-memory event handling within a single context
 */
export class TypedEventEmitter {
    private listeners = new Map<EventType, Set<TypedEventListener<any>>>();

    /**
     * Add an event listener
     */
    on<T extends EventType>(
        type: T,
        listener: TypedEventListener<T>
    ): () => void {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }

        this.listeners.get(type)!.add(listener);

        // Return cleanup function
        return () => this.off(type, listener);
    }

    /**
     * Remove an event listener
     */
    off<T extends EventType>(
        type: T,
        listener: TypedEventListener<T>
    ): void {
        const typeListeners = this.listeners.get(type);
        if (typeListeners) {
            typeListeners.delete(listener);
            if (typeListeners.size === 0) {
                this.listeners.delete(type);
            }
        }
    }

    /**
     * Emit an event
     */
    emit<T extends EventType>(
        type: T,
        payload: EventPayload<T>
    ): void {
        const typeListeners = this.listeners.get(type);
        if (typeListeners) {
            typeListeners.forEach((listener) => {
                try {
                    listener(payload);
                } catch (error) {
                    console.error(`Error in event listener for ${type}:`, error);
                }
            });
        }
    }

    /**
     * Add a one-time event listener
     */
    once<T extends EventType>(
        type: T,
        listener: TypedEventListener<T>
    ): () => void {
        const wrappedListener: TypedEventListener<T> = (payload) => {
            this.off(type, wrappedListener);
            return listener(payload);
        };

        return this.on(type, wrappedListener);
    }

    /**
     * Remove all listeners for a specific event type
     */
    removeAllListeners(type?: EventType): void {
        if (type) {
            this.listeners.delete(type);
        } else {
            this.listeners.clear();
        }
    }

    /**
     * Get listener count for an event type
     */
    listenerCount(type: EventType): number {
        return this.listeners.get(type)?.size ?? 0;
    }
}

/**
 * Global event emitter instance
 * Can be used for in-memory event handling
 */
export const eventEmitter = new TypedEventEmitter();
