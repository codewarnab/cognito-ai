/**
 * Type-Safe Port Communication
 *
 * Provides typed wrappers for Chrome extension port-based communication.
 * Use these for streaming or long-running operations.
 *
 * @example
 * // In content script - create a summarizer port
 * const port = createTypedPort('text-summarizer');
 *
 * // Listen for incoming messages (typed!)
 * port.on('SUMMARIZE_STREAM_CHUNK', (data) => {
 *   console.log(data.text, data.done);
 * });
 *
 * port.on('SUMMARIZE_ERROR', (data) => {
 *   console.error(data.error);
 * });
 *
 * // Send outgoing message (typed!)
 * port.send('SUMMARIZE_REQUEST', {
 *   text: 'Hello world',
 *   pageContext: { title: 'Page', url: 'https://...', domain: 'example.com' },
 *   settings: { summaryType: 'tl-dr', summaryLength: 'short' }
 * });
 *
 * // Cleanup when done
 * port.disconnect();
 *
 * @see /docs/TYPE_SAFE_MESSAGING.md for API reference
 */

import type {
    PortName,
    PortOutgoingAction,
    PortIncomingAction,
    PortOutgoingPayload,
    PortIncomingPayload,
} from '@/types/messaging/ports';

// =============================================================================
// TYPED PORT CLASS
// =============================================================================

/**
 * A type-safe wrapper around Chrome extension ports.
 *
 * Provides:
 * - Type-safe sending of outgoing messages
 * - Type-safe handling of incoming messages
 * - Automatic listener cleanup on disconnect
 */
export class TypedPort<P extends PortName> {
    private port: chrome.runtime.Port;
    private listeners = new Map<string, Set<(data: unknown) => void>>();
    private disconnectListeners = new Set<() => void>();
    private isConnected = true;

    constructor(name: P) {
        this.port = chrome.runtime.connect({ name });

        // Handle incoming messages
        this.port.onMessage.addListener((message: unknown) => {
            if (
                typeof message === 'object' &&
                message !== null &&
                'action' in message
            ) {
                const action = (message as { action: string }).action;
                const handlers = this.listeners.get(action);

                if (handlers) {
                    // Extract data from message (everything except 'action')
                    const { action: _, ...data } = message as Record<string, unknown>;
                    handlers.forEach((handler) => handler(data));
                }
            }
        });

        // Handle disconnection
        this.port.onDisconnect.addListener(() => {
            this.isConnected = false;
            this.disconnectListeners.forEach((handler) => handler());
            this.cleanup();
        });
    }

    /**
     * Send a message through the port.
     *
     * @param action - The action name
     * @param data - The payload data (must match the type definition)
     *
     * @example
     * port.send('SUMMARIZE_REQUEST', {
     *   text: 'Hello world',
     *   pageContext: { title: 'Page', url: 'https://...', domain: 'example.com' }
     * });
     */
    send<A extends PortOutgoingAction<P>>(
        action: A,
        data: PortOutgoingPayload<P, A>
    ): void {
        if (!this.isConnected) {
            console.warn(`[TypedPort] Cannot send message, port is disconnected`);
            return;
        }

        const message = { action, ...data };
        this.port.postMessage(message);
    }

    /**
     * Listen for incoming messages of a specific action type.
     *
     * @param action - The action to listen for
     * @param handler - The handler function (receives typed data)
     * @returns A cleanup function to remove the listener
     *
     * @example
     * const cleanup = port.on('SUMMARIZE_STREAM_CHUNK', (data) => {
     *   console.log(data.text, data.done);
     * });
     *
     * // Later: cleanup();
     */
    on<A extends PortIncomingAction<P>>(
        action: A,
        handler: (data: PortIncomingPayload<P, A>) => void
    ): () => void {
        if (!this.listeners.has(action as string)) {
            this.listeners.set(action as string, new Set());
        }

        const handlers = this.listeners.get(action as string)!;
        const wrappedHandler = handler as (data: unknown) => void;
        handlers.add(wrappedHandler);

        return () => {
            handlers.delete(wrappedHandler);
            if (handlers.size === 0) {
                this.listeners.delete(action as string);
            }
        };
    }

    /**
     * Listen for port disconnection.
     *
     * @param handler - Called when the port disconnects
     * @returns A cleanup function to remove the listener
     *
     * @example
     * port.onDisconnect(() => {
     *   console.log('Port disconnected');
     * });
     */
    onDisconnect(handler: () => void): () => void {
        this.disconnectListeners.add(handler);
        return () => this.disconnectListeners.delete(handler);
    }

    /**
     * Check if the port is still connected.
     */
    get connected(): boolean {
        return this.isConnected;
    }

    /**
     * Disconnect the port and cleanup all listeners.
     */
    disconnect(): void {
        if (this.isConnected) {
            this.port.disconnect();
            this.isConnected = false;
        }
        this.cleanup();
    }

    /**
     * Internal cleanup of listeners.
     */
    private cleanup(): void {
        this.listeners.clear();
        this.disconnectListeners.clear();
    }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a typed port connection.
 *
 * @param name - The port name (determines available message types)
 * @returns A TypedPort instance
 *
 * @example
 * // Summarizer port
 * const summarizerPort = createTypedPort('text-summarizer');
 *
 * summarizerPort.on('SUMMARIZE_STREAM_CHUNK', (data) => {
 *   console.log(data.text); // typed as string
 *   console.log(data.done); // typed as boolean
 * });
 *
 * summarizerPort.send('SUMMARIZE_REQUEST', {
 *   text: 'Some text to summarize',
 *   pageContext: { title: 'Page', url: 'https://...', domain: 'example.com' }
 * });
 *
 * @example
 * // Writer port
 * const writerPort = createTypedPort('write-command');
 *
 * writerPort.on('WRITE_STREAM_CHUNK', (data) => {
 *   console.log(data.text, data.done);
 * });
 *
 * writerPort.send('WRITE_GENERATE', {
 *   prompt: 'Write a poem about TypeScript'
 * });
 *
 * @example
 * // Rewriter port
 * const rewriterPort = createTypedPort('text-rewriter');
 *
 * rewriterPort.on('REWRITE_COMPLETE', (data) => {
 *   console.log(data.text); // Non-streaming complete text
 * });
 *
 * rewriterPort.send('REWRITE_REQUEST', {
 *   selectedText: 'Some text',
 *   instruction: 'Make it more professional'
 * });
 */
export function createTypedPort<P extends PortName>(name: P): TypedPort<P> {
    return new TypedPort(name);
}

// =============================================================================
// BACKGROUND PORT HANDLER
// =============================================================================

/**
 * Handler function type for port messages in the background script.
 */
export type PortMessageHandler<P extends PortName, A extends PortOutgoingAction<P>> = (
    data: PortOutgoingPayload<P, A>,
    port: chrome.runtime.Port
) => void | Promise<void>;

/**
 * Handler map for all actions of a port type.
 */
export type PortHandlerMap<P extends PortName> = {
    [A in PortOutgoingAction<P>]?: PortMessageHandler<P, A>;
};

/**
 * Create a typed port handler for the background script.
 *
 * @param portName - The port name to handle
 * @param handlers - Map of action handlers
 * @returns An object with install/uninstall methods
 *
 * @example
 * const summarizerHandler = createPortHandler('text-summarizer', {
 *   SUMMARIZE_REQUEST: async (data, port) => {
 *     // data is typed as SummarizerPortOutgoing['SUMMARIZE_REQUEST']
 *     const { text, pageContext, settings } = data;
 *
 *     // Send response (use sendPortMessage for type safety)
 *     sendPortMessage(port, 'SUMMARIZE_STREAM_CHUNK', {
 *       text: 'chunk...',
 *       done: false
 *     });
 *   }
 * });
 *
 * // Install the handler
 * summarizerHandler.install();
 */
export function createPortHandler<P extends PortName>(
    portName: P,
    handlers: PortHandlerMap<P>
): { install: () => void; uninstall: () => void } {
    const listener = (port: chrome.runtime.Port) => {
        if (port.name !== portName) {
            return;
        }

        port.onMessage.addListener((message: unknown) => {
            if (
                typeof message !== 'object' ||
                message === null ||
                !('action' in message)
            ) {
                return;
            }

            const action = (message as { action: string }).action as PortOutgoingAction<P>;
            const handler = handlers[action];

            if (handler) {
                const { action: _, ...data } = message as Record<string, unknown>;
                Promise.resolve(
                    handler(data as PortOutgoingPayload<P, typeof action>, port)
                ).catch((error) => {
                    console.error(`[PortHandler] Error handling ${String(action)}:`, error);
                });
            }
        });
    };

    return {
        install: () => chrome.runtime.onConnect.addListener(listener),
        uninstall: () => chrome.runtime.onConnect.removeListener(listener),
    };
}

/**
 * Send a typed message through a Chrome port (for background script use).
 *
 * @param port - The Chrome port to send through
 * @param action - The action name
 * @param data - The payload data
 *
 * @example
 * // In background handler
 * sendPortMessage(port, 'SUMMARIZE_STREAM_CHUNK', {
 *   text: 'Summary chunk...',
 *   done: false
 * });
 */
export function sendPortMessage<P extends PortName, A extends PortIncomingAction<P>>(
    port: chrome.runtime.Port,
    action: A,
    data: PortIncomingPayload<P, A>
): void {
    port.postMessage({ action, ...data });
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Extract all possible incoming message types for a port
 */
export type IncomingMessage<P extends PortName> = {
    [A in PortIncomingAction<P>]: { action: A } & PortIncomingPayload<P, A>;
}[PortIncomingAction<P>];

/**
 * Extract all possible outgoing message types for a port
 */
export type OutgoingMessage<P extends PortName> = {
    [A in PortOutgoingAction<P>]: { action: A } & PortOutgoingPayload<P, A>;
}[PortOutgoingAction<P>];
