/**
 * Normalize Error Utility
 * Standardizes error handling across the codebase by ensuring
 * consistent Error object conversion from unknown catch values.
 */

/**
 * Normalizes an unknown error value to an Error object.
 * Use this in catch blocks to ensure type-safe error handling.
 *
 * @param err - The unknown error value from a catch block
 * @returns A proper Error object with a message
 *
 * @example
 * ```typescript
 * try {
 *   await someOperation();
 * } catch (err) {
 *   const error = normalizeError(err);
 *   log.error('Operation failed:', error.message);
 * }
 * ```
 */
export function normalizeError(err: unknown): Error {
    if (err instanceof Error) {
        return err;
    }
    return new Error(typeof err === 'string' ? err : 'Unknown error');
}

/**
 * Extracts an error message from an unknown error value.
 * Convenience function when only the message is needed.
 *
 * @param err - The unknown error value from a catch block
 * @returns The error message string
 *
 * @example
 * ```typescript
 * try {
 *   await someOperation();
 * } catch (err) {
 *   setError(getErrorMessage(err));
 * }
 * ```
 */
export function getErrorMessage(err: unknown): string {
    if (err instanceof Error) {
        return err.message;
    }
    return typeof err === 'string' ? err : 'Unknown error';
}
