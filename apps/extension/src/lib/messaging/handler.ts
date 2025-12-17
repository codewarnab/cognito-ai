/**
 * Type-Safe Message Handler
 *
 * Provides typed message routing in background script.
 * Ensures handlers receive correctly typed payloads and return properly typed responses.
 *
 * @see /docs/TYPE_SAFE_MESSAGING.md for API reference
 */

import type { MessageType, MessagePayload, MessageResponse, TypedMessage } from '@/types/messaging';

/**
 * Handler function type for a specific message type.
 * Receives typed payload and sender, returns typed response.
 */
export type MessageHandler<T extends MessageType> = (
    payload: MessagePayload<T>,
    sender: chrome.runtime.MessageSender
) => Promise<MessageResponse<T>> | MessageResponse<T>;

/**
 * Map of message types to their handlers
 */
export type HandlerMap = {
    [K in MessageType]?: MessageHandler<K>;
};

/**
 * Options for message router
 */
export interface MessageRouterOptions {
    /** Whether to log unhandled messages (default: false) */
    logUnhandled?: boolean;
    /** Whether to log errors (default: true) */
    logErrors?: boolean;
    /** Custom error handler */
    onError?: (type: string, error: unknown) => void;
}

/**
 * Message router instance
 */
export interface MessageRouter {
    /** Install the router as a message listener */
    install: () => void;
    /** Uninstall the router */
    uninstall: () => void;
    /** The underlying listener function */
    listener: (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: unknown) => void
    ) => boolean;
    /** Add a handler for a specific message type */
    addHandler: <T extends MessageType>(type: T, handler: MessageHandler<T>) => void;
    /** Remove a handler for a specific message type */
    removeHandler: (type: MessageType) => void;
    /** Check if a handler exists for a message type */
    hasHandler: (type: MessageType) => boolean;
}

/**
 * Type guard to check if a value is a typed message
 */
function isTypedMessageGuard(value: unknown): value is TypedMessage {
    return (
        typeof value === 'object' &&
        value !== null &&
        'type' in value &&
        typeof (value as { type: unknown }).type === 'string'
    );
}

/**
 * Create a type-safe message router.
 *
 * @example
 * const router = createMessageRouter({
 *   'CHECK_SUPERMEMORY_READY': async () => {
 *     const ready = await checkSupermemory();
 *     return { ready };
 *   },
 *   'QUEUE_MEMORY_EXTRACTION': async (payload) => {
 *     // payload is typed as { threadId: string; messageCount: number }
 *     await queueExtraction(payload.threadId, payload.messageCount);
 *     return { success: true };
 *   },
 * });
 *
 * // Install the router
 * router.install();
 *
 * // Add handlers dynamically
 * router.addHandler('OPEN_SIDEBAR', async () => {
 *   await openSidebar();
 *   return { success: true };
 * });
 *
 * // Later: cleanup
 * router.uninstall();
 */
export function createMessageRouter(
    initialHandlers: HandlerMap = {},
    options: MessageRouterOptions = {}
): MessageRouter {
    const { logUnhandled = false, logErrors = true, onError } = options;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlers = new Map<string, MessageHandler<any>>(Object.entries(initialHandlers));

    const listener = (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: unknown) => void
    ): boolean => {
        if (!isTypedMessageGuard(message)) {
            return false;
        }

        const handler = handlers.get(message.type);
        if (!handler) {
            if (logUnhandled) {
                console.debug(`[MessageRouter] Unhandled message type: ${message.type}`);
            }
            return false;
        }

        // Handle async responses
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        Promise.resolve(handler(message.payload, sender))
            .then(sendResponse)
            .catch((error) => {
                if (logErrors) {
                    console.error(`[MessageRouter] Handler error for ${message.type}:`, error);
                }
                if (onError) {
                    onError(message.type, error);
                }
                sendResponse({ success: false, error: String(error) });
            });

        return true; // Will respond asynchronously
    };

    return {
        install: () => chrome.runtime.onMessage.addListener(listener),
        uninstall: () => chrome.runtime.onMessage.removeListener(listener),
        listener,
        addHandler: <T extends MessageType>(type: T, handler: MessageHandler<T>) => {
            handlers.set(type, handler);
        },
        removeHandler: (type: MessageType) => {
            handlers.delete(type);
        },
        hasHandler: (type: MessageType) => handlers.has(type),
    };
}

/**
 * Add a listener for a specific message type.
 * Useful when you need to listen for a single message type without a full router.
 *
 * @example
 * const cleanup = onMessage('MODEL_DOWNLOAD_PROGRESS', (payload) => {
 *   console.log('Progress:', payload.progress);
 * });
 *
 * // Later: cleanup();
 */
export function onMessage<T extends MessageType>(
    type: T,
    handler: (payload: MessagePayload<T>, sender: chrome.runtime.MessageSender) => void | Promise<void>
): () => void {
    const listener = (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: unknown) => void
    ): boolean => {
        if (!isTypedMessageGuard(message) || message.type !== type) {
            return false;
        }

        Promise.resolve(handler(message.payload as MessagePayload<T>, sender))
            .then(() => sendResponse({ success: true }))
            .catch((error) => {
                console.error(`[onMessage] Listener error for ${type}:`, error);
                sendResponse({ success: false, error: String(error) });
            });

        return true;
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
}

/**
 * Add a listener that receives typed messages and returns typed responses.
 * Similar to onMessage but expects a return value.
 *
 * @example
 * const cleanup = onMessageWithResponse('CHECK_SUPERMEMORY_READY', async () => {
 *   const ready = await checkSupermemory();
 *   return { ready }; // Must return { ready: boolean }
 * });
 */
export function onMessageWithResponse<T extends MessageType>(
    type: T,
    handler: MessageHandler<T>
): () => void {
    const listener = (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: unknown) => void
    ): boolean => {
        if (!isTypedMessageGuard(message) || message.type !== type) {
            return false;
        }

        Promise.resolve(handler(message.payload as MessagePayload<T>, sender))
            .then(sendResponse)
            .catch((error) => {
                console.error(`[onMessageWithResponse] Handler error for ${type}:`, error);
                sendResponse({ success: false, error: String(error) });
            });

        return true;
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
}

/**
 * Create a handler that validates payloads before processing.
 * Useful for adding runtime validation to handlers.
 *
 * @example
 * import { z } from 'zod';
 *
 * const PayloadSchema = z.object({
 *   threadId: z.string(),
 *   messageCount: z.number()
 * });
 *
 * const cleanup = onMessageWithResponse('QUEUE_MEMORY_EXTRACTION',
 *   withValidation(PayloadSchema, async (payload) => {
 *     // payload is validated and typed
 *     await queueExtraction(payload.threadId, payload.messageCount);
 *     return { success: true };
 *   })
 * );
 */
export function withValidation<T extends MessageType, TSchema extends { parse: (data: unknown) => MessagePayload<T> }>(
    schema: TSchema,
    handler: MessageHandler<T>
): MessageHandler<T> {
    return async (payload, sender) => {
        const validatedPayload = schema.parse(payload);
        return handler(validatedPayload, sender);
    };
}

/**
 * Combine multiple routers into one.
 * Useful for organizing handlers by domain.
 *
 * @example
 * const mcpRouter = createMessageRouter(mcpHandlers);
 * const uiRouter = createMessageRouter(uiHandlers);
 * const combinedRouter = combineRouters(mcpRouter, uiRouter);
 * combinedRouter.install();
 */
export function combineRouters(...routers: MessageRouter[]): {
    install: () => void;
    uninstall: () => void;
} {
    return {
        install: () => routers.forEach((r) => r.install()),
        uninstall: () => routers.forEach((r) => r.uninstall()),
    };
}
