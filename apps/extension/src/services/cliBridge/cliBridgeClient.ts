import { createLogger } from '~logger';
import type { CliBridgeChatParams, BridgeEvent, BridgeSSEEvent } from './types';

const log = createLogger('cliBridgeClient', 'CLI_MODE_BRIDGE');

/**
 * Retry configuration for transient network failures
 */
interface RetryConfig {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 500,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
};

/**
 * Check if an error is retryable (transient network failures)
 */
function isRetryableError(error: unknown): boolean {
    if (error instanceof TypeError) {
        // Network errors (fetch failures, CORS issues when offline, etc.)
        return true;
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
        // User-initiated abort - don't retry
        return false;
    }
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        // Retry on network-related errors
        if (
            message.includes('network') ||
            message.includes('failed to fetch') ||
            message.includes('timeout') ||
            message.includes('connection') ||
            message.includes('econnrefused') ||
            message.includes('econnreset')
        ) {
            return true;
        }
    }
    return false;
}

/**
 * Delay execution for a given number of milliseconds
 */
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with automatic retries and exponential backoff
 */
async function withRetry<T>(
    fn: () => Promise<T>,
    config: RetryConfig = DEFAULT_RETRY_CONFIG,
    context: string = 'operation'
): Promise<T> {
    let lastError: unknown;
    let delayMs = config.initialDelayMs;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Don't retry if error is not retryable or we've exhausted retries
            if (!isRetryableError(error) || attempt === config.maxRetries) {
                throw error;
            }

            log.warn(`${context} failed, retrying in ${delayMs}ms`, {
                attempt: attempt + 1,
                maxRetries: config.maxRetries,
                error: error instanceof Error ? error.message : String(error),
            });

            await delay(delayMs);
            delayMs = Math.min(delayMs * config.backoffMultiplier, config.maxDelayMs);
        }
    }

    throw lastError;
}

/**
 * Parse SSE event data
 */
function parseSSEEvent(eventType: string, data: string): BridgeEvent | null {
    try {
        const parsed = JSON.parse(data);

        switch (eventType) {
            case 'text':
                return { type: 'text', content: parsed.content };
            case 'tool_call':
                return {
                    type: 'tool_call',
                    toolName: parsed.toolName,
                    toolCallId: parsed.toolCallId,
                    args: parsed.args,
                };
            case 'tool_result':
                return {
                    type: 'tool_result',
                    toolCallId: parsed.toolCallId,
                    result: parsed.result,
                };
            case 'error':
                return { type: 'error', error: parsed.error };
            case 'status':
                return { type: 'status', message: parsed.message };
            case 'done':
                return { type: 'done' };
            default:
                log.warn('Unknown SSE event type', { eventType });
                return null;
        }
    } catch (err) {
        log.error('Failed to parse SSE event', err);
        return null;
    }
}

/**
 * Stream chat with the CLI bridge
 */
export async function* streamCliBridgeChat(
    baseUrl: string,
    token: string,
    params: CliBridgeChatParams,
    abortSignal?: AbortSignal
): AsyncGenerator<BridgeEvent> {
    log.info('Starting cli bridge chat stream', { agent: params.agent.name });

    const response = await fetch(`${baseUrl}/cli/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(params),
        signal: abortSignal,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    if (!response.body) {
        throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEventType = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Parse SSE format
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('event: ')) {
                    currentEventType = line.slice(7).trim();
                } else if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    const event = parseSSEEvent(currentEventType, data);
                    if (event) {
                        yield event;
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}

/**
 * Check bridge health (with automatic retries for transient failures)
 */
export async function checkBridgeHealth(
    baseUrl: string,
    options?: { retryOnFailure?: boolean }
): Promise<{
    ok: boolean;
    version?: string;
    cwd?: string;
    error?: string;
}> {
    const doCheck = async () => {
        const response = await fetch(`${baseUrl}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return { ok: true, version: data.version, cwd: data.cwd };
    };

    try {
        if (options?.retryOnFailure) {
            return await withRetry(doCheck, DEFAULT_RETRY_CONFIG, 'checkBridgeHealth');
        }
        return await doCheck();
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
}

/**
 * Connect to bridge SSE event stream for real-time status updates.
 * Returns a cleanup function to close the connection.
 */
export function connectToEventStream(
    baseUrl: string,
    callbacks: {
        onConnected?: (event: BridgeSSEEvent & { type: 'connected' }) => void;
        onHeartbeat?: (event: BridgeSSEEvent & { type: 'heartbeat' }) => void;
        onClosing?: (event: BridgeSSEEvent & { type: 'bridge:closing' }) => void;
        onError?: (error: Error) => void;
    }
): () => void {
    log.info('Connecting to bridge SSE event stream', { baseUrl });

    const eventSource = new EventSource(`${baseUrl}/events`);

    // Log when connection opens
    eventSource.onopen = () => {
        log.info('SSE: EventSource connection opened');
    };

    eventSource.addEventListener('connected', (e: MessageEvent) => {
        try {
            const data = JSON.parse(e.data);
            log.info('SSE: Connected to bridge', { version: data.version, cwd: data.cwd });
            callbacks.onConnected?.({ type: 'connected', version: data.version, cwd: data.cwd });
        } catch (err) {
            log.error('SSE: Failed to parse connected event', err);
        }
    });

    eventSource.addEventListener('heartbeat', (e: MessageEvent) => {
        try {
            const data = JSON.parse(e.data);
            log.debug('SSE: Heartbeat received', { timestamp: data.timestamp });
            callbacks.onHeartbeat?.({ type: 'heartbeat', timestamp: data.timestamp });
        } catch (err) {
            log.error('SSE: Failed to parse heartbeat event', err);
        }
    });

    eventSource.addEventListener('bridge:closing', (e: MessageEvent) => {
        try {
            const data = JSON.parse(e.data);
            log.warn('SSE: Bridge closing', { reason: data.reason });
            callbacks.onClosing?.({ type: 'bridge:closing', reason: data.reason });
        } catch (err) {
            log.error('SSE: Failed to parse closing event', err);
        }
    });

    eventSource.onerror = () => {
        log.warn('SSE: Connection error or closed');
        callbacks.onError?.(new Error('SSE connection failed'));
    };

    // Return cleanup function
    return () => {
        log.info('SSE: Closing connection');
        eventSource.close();
    };
}
