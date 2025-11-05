/**
 * Type assertion utilities
 */

export function assertExists<T>(
    value: T | null | undefined,
    message?: string
): asserts value is T {
    if (value === null || value === undefined) {
        throw new Error(message || 'Value does not exist');
    }
}

export function assertIsString(
    value: unknown,
    message?: string
): asserts value is string {
    if (typeof value !== 'string') {
        throw new TypeError(message || 'Value is not a string');
    }
}

export function assertIsNumber(
    value: unknown,
    message?: string
): asserts value is number {
    if (typeof value !== 'number' || isNaN(value)) {
        throw new TypeError(message || 'Value is not a number');
    }
}

export function assertIsBoolean(
    value: unknown,
    message?: string
): asserts value is boolean {
    if (typeof value !== 'boolean') {
        throw new TypeError(message || 'Value is not a boolean');
    }
}

export function assertIsArray<T = unknown>(
    value: unknown,
    message?: string
): asserts value is T[] {
    if (!Array.isArray(value)) {
        throw new TypeError(message || 'Value is not an array');
    }
}

export function assertIsObject(
    value: unknown,
    message?: string
): asserts value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new TypeError(message || 'Value is not an object');
    }
}

export function assertIsFunction(
    value: unknown,
    message?: string
): asserts value is Function {
    if (typeof value !== 'function') {
        throw new TypeError(message || 'Value is not a function');
    }
}

export function assertHasProperty<K extends string>(
    obj: unknown,
    key: K,
    message?: string
): asserts obj is Record<K, unknown> {
    if (typeof obj !== 'object' || obj === null || !(key in obj)) {
        throw new TypeError(message || `Object does not have property: ${key}`);
    }
}

export function assertIsError(
    value: unknown,
    message?: string
): asserts value is Error {
    if (!(value instanceof Error)) {
        throw new TypeError(message || 'Value is not an Error');
    }
}

export function assertInRange(
    value: number,
    min: number,
    max: number,
    message?: string
): asserts value is number {
    if (value < min || value > max) {
        throw new RangeError(message || `Value ${value} is not in range [${min}, ${max}]`);
    }
}

export function assertIsOneOf<T extends readonly unknown[]>(
    value: unknown,
    allowedValues: T,
    message?: string
): asserts value is T[number] {
    if (!allowedValues.includes(value)) {
        throw new TypeError(
            message || `Value must be one of: ${allowedValues.join(', ')}`
        );
    }
}

/**
 * Assert that a value is not null or undefined
 */
export function assertDefined<T>(
    value: T | null | undefined,
    message?: string
): asserts value is T {
    if (value === null || value === undefined) {
        throw new Error(message || 'Value is null or undefined');
    }
}

/**
 * Assert that a value is a non-empty string
 */
export function assertNonEmptyString(
    value: unknown,
    message?: string
): asserts value is string {
    if (typeof value !== 'string' || value.length === 0) {
        throw new TypeError(message || 'Value is not a non-empty string');
    }
}

/**
 * Assert that a value is a non-empty array
 */
export function assertNonEmptyArray<T = unknown>(
    value: unknown,
    message?: string
): asserts value is [T, ...T[]] {
    if (!Array.isArray(value) || value.length === 0) {
        throw new TypeError(message || 'Value is not a non-empty array');
    }
}
