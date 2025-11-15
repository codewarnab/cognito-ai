/**
 * Abort Signal Utilities for Tool Execution
 * Helper functions to check and handle abort signals in tools
 */

import { createLogger } from '../../logger';

const log = createLogger('AbortUtils');

/**
 * Check if operation was aborted and throw if so
 * @param abortSignal - Optional abort signal to check
 * @param context - Context string for logging (e.g., tool name, operation)
 * @throws Error with message 'Operation cancelled' if aborted
 */
export function checkAborted(abortSignal?: AbortSignal, context?: string): void {
    if (abortSignal?.aborted) {
        const message = context ? `${context} cancelled` : 'Operation cancelled';
        log.info(`🛑 Abort detected: ${message}`);
        throw new Error('Operation cancelled');
    }
}

/**
 * Create an abort-aware delay
 * Returns a promise that rejects if aborted during wait
 * @param ms - Milliseconds to wait
 * @param abortSignal - Optional abort signal
 * @returns Promise that resolves after delay or rejects if aborted
 */
export function abortableDelay(ms: number, abortSignal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (abortSignal?.aborted) {
            reject(new Error('Operation cancelled'));
            return;
        }

        const timeout = setTimeout(() => {
            cleanup();
            resolve();
        }, ms);

        const onAbort = () => {
            cleanup();
            reject(new Error('Operation cancelled'));
        };

        const cleanup = () => {
            clearTimeout(timeout);
            abortSignal?.removeEventListener('abort', onAbort);
        };

        abortSignal?.addEventListener('abort', onAbort);
    });
}

/**
 * Wrap an async operation with abort signal checking
 * Checks before and after the operation
 * @param operation - Async function to execute
 * @param abortSignal - Optional abort signal
 * @param context - Context string for logging
 * @returns Result of the operation
 */
export async function withAbortCheck<T>(
    operation: () => Promise<T>,
    abortSignal?: AbortSignal,
    context?: string
): Promise<T> {
    checkAborted(abortSignal, context);
    const result = await operation();
    checkAborted(abortSignal, context);
    return result;
}

/**
 * Check if abort signal is aborted (without throwing)
 * @param abortSignal - Optional abort signal
 * @returns true if aborted, false otherwise
 */
export function isAborted(abortSignal?: AbortSignal): boolean {
    return abortSignal?.aborted ?? false;
}
