/**
 * Debounce utility function
 * Creates a debounced version of a function that delays invoking until after 
 * wait milliseconds have elapsed since the last time it was invoked.
 */

export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return function debounced(...args: Parameters<T>) {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            func(...args);
            timeoutId = null;
        }, wait);
    };
}

/**
 * Throttle utility function
 * Creates a throttled version of a function that only invokes at most once per 
 * every wait milliseconds.
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let lastTime = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return function throttled(...args: Parameters<T>) {
        const now = Date.now();
        const remaining = wait - (now - lastTime);

        if (remaining <= 0) {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            lastTime = now;
            func(...args);
        } else if (timeoutId === null) {
            timeoutId = setTimeout(() => {
                lastTime = Date.now();
                timeoutId = null;
                func(...args);
            }, remaining);
        }
    };
}
