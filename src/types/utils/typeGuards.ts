/**
 * Type guard utilities
 */

import type { JSONValue } from './helpers';

export function isError(value: unknown): value is Error {
    return value instanceof Error;
}

export function isString(value: unknown): value is string {
    return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
}

export function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isArray<T = unknown>(value: unknown): value is T[] {
    return Array.isArray(value);
}

export function isNull(value: unknown): value is null {
    return value === null;
}

export function isUndefined(value: unknown): value is undefined {
    return value === undefined;
}

export function isNullish(value: unknown): value is null | undefined {
    return value === null || value === undefined;
}

export function isFunction(value: unknown): value is Function {
    return typeof value === 'function';
}

export function isDate(value: unknown): value is Date {
    return value instanceof Date && !isNaN(value.getTime());
}

export function isRegExp(value: unknown): value is RegExp {
    return value instanceof RegExp;
}

export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
    return value instanceof Promise || (
        isObject(value) &&
        hasProperty(value, 'then') &&
        isFunction(value.then) &&
        hasProperty(value, 'catch') &&
        isFunction(value.catch)
    );
}

export function isJSONValue(value: unknown): value is JSONValue {
    if (value === null) return true;
    if (typeof value === 'string') return true;
    if (typeof value === 'number') return true;
    if (typeof value === 'boolean') return true;
    if (Array.isArray(value)) return value.every(isJSONValue);
    if (typeof value === 'object') {
        return Object.values(value as object).every(isJSONValue);
    }
    return false;
}

export function hasProperty<K extends string>(
    obj: unknown,
    key: K
): obj is Record<K, unknown> {
    return isObject(obj) && key in obj;
}

export function hasProperties<K extends string>(
    obj: unknown,
    keys: K[]
): obj is Record<K, unknown> {
    return isObject(obj) && keys.every(key => key in obj);
}

/**
 * Type guard to check if a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard to check if a value is a non-empty array
 */
export function isNonEmptyArray<T = unknown>(value: unknown): value is [T, ...T[]] {
    return Array.isArray(value) && value.length > 0;
}

/**
 * Type guard to check if a value is a valid URL string
 */
export function isURLString(value: unknown): value is string {
    if (!isString(value)) return false;
    try {
        new URL(value);
        return true;
    } catch {
        return false;
    }
}

/**
 * Type guard to check if a value is a valid email string
 */
export function isEmailString(value: unknown): value is string {
    if (!isString(value)) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
}

export function assertNever(value: never): never {
    throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}

// Type narrowing helpers
export function isDefined<T>(value: T | undefined): value is T {
    return value !== undefined;
}

export function isNotNull<T>(value: T | null): value is T {
    return value !== null;
}

export function isPresent<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined;
}

/**
 * Type guard to check if an error has a message property
 */
export function isErrorWithMessage(error: unknown): error is { message: string } {
    return (
        isObject(error) &&
        hasProperty(error, 'message') &&
        isString(error.message)
    );
}

/**
 * Type guard to check if an error has a code property
 */
export function isErrorWithCode(error: unknown): error is { code: string } {
    return (
        isObject(error) &&
        hasProperty(error, 'code') &&
        isString(error.code)
    );
}

/**
 * Get error message from unknown error value
 */
export function getErrorMessage(error: unknown): string {
    if (isError(error)) return error.message;
    if (isErrorWithMessage(error)) return error.message;
    if (isString(error)) return error;
    return 'An unknown error occurred';
}

/**
 * Type guard for Chrome runtime message
 */
export function isChromeMessage(value: unknown): value is { type: string; payload?: unknown } {
    return (
        isObject(value) &&
        hasProperty(value, 'type') &&
        isString(value.type)
    );
}

// Specific type guards
export function isAbortSignal(value: unknown): value is AbortSignal {
    return value instanceof AbortSignal;
}

export function isReadableStream(value: unknown): value is ReadableStream {
    return value instanceof ReadableStream;
}
