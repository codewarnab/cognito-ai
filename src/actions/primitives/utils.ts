/**
 * Utility functions for primitive actions
 */

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
    fn: () => Promise<T>,
    options: { retries?: number; backoffMs?: number } = {}
): Promise<T> {
    const { retries = 3, backoffMs = 100 } = options;
    let lastError: any;

    for (let i = 0; i <= retries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (i < retries) {
                const delay = backoffMs * Math.pow(2, i);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}

/**
 * Wrap a promise with a timeout
 */
export async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage = "Operation timed out"
): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
        ),
    ]);
}

/**
 * Inject and execute a function in the content script context
 */
export async function injectContent<T>(
    tabId: number,
    fn: (...args: any[]) => T,
    args: any[] = []
): Promise<T> {
    const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: fn,
        args,
    });

    if (!results || results.length === 0) {
        throw new Error("Script injection failed: no results");
    }

    if (results[0].result === undefined && chrome.runtime.lastError) {
        throw new Error(`Script injection error: ${chrome.runtime.lastError.message}`);
    }

    return results[0].result as T;
}
