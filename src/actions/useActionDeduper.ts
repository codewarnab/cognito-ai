/**
 * Shared deduplication helper to prevent duplicate action executions
 * within a short time window
 */

import { createLogger } from "../logger";

const log = createLogger("ActionDeduper");
const seen = new Set<string>();
const DEDUP_WINDOW_MS = 3000; // 3 second window

/**
 * Check if an action should be processed or if it's a duplicate
 * @param actionName The name of the action being executed
 * @param args The arguments passed to the action
 * @returns true if the action should be processed, false if it's a duplicate
 */
export function shouldProcess(actionName: string, args: unknown): boolean {
    const key = actionName + ":" + JSON.stringify(args);

    if (seen.has(key)) {
        log.warn(`Duplicate ${actionName} blocked - already processing`, args);
        return false;
    }

    seen.add(key);

    // Clear the key after the deduplication window expires
    setTimeout(() => {
        seen.delete(key);
    }, DEDUP_WINDOW_MS);

    return true;
}
