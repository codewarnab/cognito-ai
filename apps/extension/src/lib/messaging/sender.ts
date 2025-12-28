/**
 * Type-Safe Message Sender
 *
 * Replaces direct chrome.runtime.sendMessage calls with typed versions.
 * Provides compile-time type checking for message payloads and responses.
 *
 * @see /docs/TYPE_SAFE_MESSAGING.md for API reference
 */

import type { MessageType, MessagePayload, MessageResponse, TypedMessage } from '@/types/messaging';

/**
 * Custom error class for messaging errors
 */
export class MessagingError extends Error {
    constructor(
        message: string,
        public readonly messageType?: string,
        public readonly originalError?: Error
    ) {
        super(message);
        this.name = 'MessagingError';
    }
}

/**
 * Send a message to the background script with full type safety.
 *
 * @example
 * // Message without payload
 * const response = await sendMessage('CHECK_SUPERMEMORY_READY');
 * // response is typed as { ready: boolean }
 *
 * @example
 * // Message with payload
 * const response = await sendMessage('QUEUE_MEMORY_EXTRACTION', {
 *   threadId: '123',
 *   messageCount: 5
 * });
 * // response is typed as { success: boolean; error?: string }
 *
 * @example
 * // Error handling
 * try {
 *   const response = await sendMessage('OPEN_SIDEBAR');
 * } catch (error) {
 *   if (error instanceof MessagingError) {
 *     console.error('Failed to send message:', error.message);
 *   }
 * }
 */
export async function sendMessage<T extends MessageType>(
    type: T,
    ...args: MessagePayload<T> extends undefined ? [] : [payload: MessagePayload<T>]
): Promise<MessageResponse<T>> {
    const [payload] = args;

    const message: TypedMessage<T> =
        payload !== undefined ? ({ type, payload } as TypedMessage<T>) : ({ type } as TypedMessage<T>);

    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                reject(new MessagingError(chrome.runtime.lastError.message ?? 'Unknown messaging error', type));
                return;
            }
            resolve(response as MessageResponse<T>);
        });
    });
}

/**
 * Send a message to a specific tab's content script.
 *
 * @example
 * const response = await sendMessageToTab(tabId, 'SIDEBAR_OPENED');
 *
 * @example
 * const response = await sendMessageToTab(tabId, 'MODEL_DOWNLOAD_PROGRESS_UPDATE', {
 *   modelId: 'gemini-nano',
 *   loaded: 500,
 *   total: 1000,
 *   progress: 50
 * });
 */
export async function sendMessageToTab<T extends MessageType>(
    tabId: number,
    type: T,
    ...args: MessagePayload<T> extends undefined ? [] : [payload: MessagePayload<T>]
): Promise<MessageResponse<T>> {
    const [payload] = args;

    const message: TypedMessage<T> =
        payload !== undefined ? ({ type, payload } as TypedMessage<T>) : ({ type } as TypedMessage<T>);

    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, message, (response) => {
            if (chrome.runtime.lastError) {
                reject(
                    new MessagingError(
                        chrome.runtime.lastError.message ?? 'Unknown messaging error',
                        type,
                        new Error(`Tab ${tabId}`)
                    )
                );
                return;
            }
            resolve(response as MessageResponse<T>);
        });
    });
}

/**
 * Broadcast a message to all tabs.
 * Errors from individual tabs are silently ignored.
 *
 * @example
 * // Notify all tabs that the model download progress has updated
 * await broadcastMessage('MODEL_DOWNLOAD_PROGRESS_UPDATE', {
 *   modelId: 'gemini-nano',
 *   loaded: 500,
 *   total: 1000,
 *   progress: 50
 * });
 */
export async function broadcastMessage<T extends MessageType>(
    type: T,
    ...args: MessagePayload<T> extends undefined ? [] : [payload: MessagePayload<T>]
): Promise<void> {
    const [payload] = args;

    const message: TypedMessage<T> =
        payload !== undefined ? ({ type, payload } as TypedMessage<T>) : ({ type } as TypedMessage<T>);

    const tabs = await chrome.tabs.query({});

    await Promise.allSettled(
        tabs.map((tab) => {
            if (tab.id !== undefined) {
                return chrome.tabs.sendMessage(tab.id, message).catch(() => {
                    // Silently ignore errors for individual tabs
                    // (e.g., tabs that don't have content scripts)
                });
            }
            return Promise.resolve();
        })
    );
}

/**
 * Send a message with a timeout.
 * Useful for messages that should have a response within a certain time.
 *
 * @example
 * try {
 *   const response = await sendMessageWithTimeout('CHECK_SUPERMEMORY_READY', undefined, 5000);
 * } catch (error) {
 *   if (error.message.includes('timeout')) {
 *     console.error('Message timed out');
 *   }
 * }
 */
export async function sendMessageWithTimeout<T extends MessageType>(
    type: T,
    payload: MessagePayload<T> | undefined,
    timeoutMs: number
): Promise<MessageResponse<T>> {
    const messagePromise = (async () => {
        if (payload !== undefined) {
            // For messages with payloads, we need to cast to satisfy the conditional type
            return sendMessage(
                type,
                ...[payload] as MessagePayload<T> extends undefined ? [] : [payload: MessagePayload<T>]
            );
        }
        // For messages without payloads
        return sendMessage(
            type,
            ...[] as MessagePayload<T> extends undefined ? [] : [payload: MessagePayload<T>]
        );
    })();

    // Use timeout with proper cleanup to prevent memory leaks
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
        const result = await Promise.race([
            messagePromise,
            new Promise<never>((_, reject) => {
                timeoutId = setTimeout(
                    () => reject(new MessagingError(`Message ${type} timed out after ${timeoutMs}ms`, type)),
                    timeoutMs
                );
            }),
        ]);
        clearTimeout(timeoutId);
        return result;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

/**
 * Try to send a message, returning null on error instead of throwing.
 * Useful when you don't care about errors.
 *
 * @example
 * const response = await trySendMessage('CHECK_SUPERMEMORY_READY');
 * if (response?.ready) {
 *   // Supermemory is ready
 * }
 */
export async function trySendMessage<T extends MessageType>(
    type: T,
    ...args: MessagePayload<T> extends undefined ? [] : [payload: MessagePayload<T>]
): Promise<MessageResponse<T> | null> {
    try {
        return await sendMessage(type, ...args);
    } catch {
        return null;
    }
}
