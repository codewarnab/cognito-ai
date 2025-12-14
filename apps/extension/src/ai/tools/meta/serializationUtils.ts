/**
 * Serialization Utilities for Sandbox Communication
 * 
 * Handles edge cases in JSON serialization:
 * - Circular references
 * - Functions
 * - undefined values
 * - Error objects
 * - DOM nodes
 * - Symbols
 * - BigInt
 * - Map/Set
 */

import { createLogger } from '~logger';

const log = createLogger('SerializationUtils');

// ============================================================================
// Types
// ============================================================================

interface SerializationOptions {
    /** Maximum depth to traverse objects (prevents stack overflow) */
    maxDepth?: number;
    /** Maximum string length for truncation */
    maxStringLength?: number;
    /** Whether to include function placeholders */
    includeFunctions?: boolean;
}

const DEFAULT_OPTIONS: Required<SerializationOptions> = {
    maxDepth: 10,
    maxStringLength: 10000,
    includeFunctions: true,
};

// ============================================================================
// Safe Serialization
// ============================================================================

/**
 * Safely serialize a value to JSON-compatible format.
 * Handles circular references, functions, and other non-serializable values.
 */
export function safeSerialize(
    value: unknown,
    options: SerializationOptions = {}
): unknown {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const seen = new WeakSet<object>();

    function serialize(val: unknown, depth: number, path: string): unknown {
        // Check depth limit
        if (depth > opts.maxDepth) {
            return '[Max depth exceeded]';
        }

        // Handle primitives
        if (val === null) return null;
        if (val === undefined) return '[undefined]';
        if (typeof val === 'boolean') return val;
        if (typeof val === 'number') {
            if (Number.isNaN(val)) return '[NaN]';
            if (!Number.isFinite(val)) return val > 0 ? '[Infinity]' : '[-Infinity]';
            return val;
        }
        if (typeof val === 'string') {
            return val.length > opts.maxStringLength
                ? val.slice(0, opts.maxStringLength) + '...[truncated]'
                : val;
        }
        if (typeof val === 'bigint') {
            return `[BigInt: ${val.toString()}]`;
        }
        if (typeof val === 'symbol') {
            return `[Symbol: ${val.description || 'anonymous'}]`;
        }
        if (typeof val === 'function') {
            return opts.includeFunctions
                ? `[Function: ${val.name || 'anonymous'}]`
                : undefined;
        }

        // Handle objects
        if (typeof val === 'object') {
            // Check for circular references
            if (seen.has(val)) {
                return '[Circular Reference]';
            }
            seen.add(val);

            try {
                // Handle Error objects specially
                if (val instanceof Error) {
                    return {
                        __type: 'Error',
                        name: val.name,
                        message: val.message,
                        stack: val.stack,
                    };
                }

                // Handle Date
                if (val instanceof Date) {
                    return {
                        __type: 'Date',
                        value: val.toISOString(),
                    };
                }

                // Handle RegExp
                if (val instanceof RegExp) {
                    return {
                        __type: 'RegExp',
                        source: val.source,
                        flags: val.flags,
                    };
                }

                // Handle Map
                if (val instanceof Map) {
                    const entries: [unknown, unknown][] = [];
                    for (const [k, v] of val) {
                        entries.push([
                            serialize(k, depth + 1, `${path}.Map.key`),
                            serialize(v, depth + 1, `${path}.Map.value`),
                        ]);
                    }
                    return {
                        __type: 'Map',
                        entries,
                    };
                }

                // Handle Set
                if (val instanceof Set) {
                    const values: unknown[] = [];
                    for (const v of val) {
                        values.push(serialize(v, depth + 1, `${path}.Set.value`));
                    }
                    return {
                        __type: 'Set',
                        values,
                    };
                }

                // Handle ArrayBuffer and TypedArrays
                if (val instanceof ArrayBuffer) {
                    return {
                        __type: 'ArrayBuffer',
                        byteLength: val.byteLength,
                    };
                }
                if (ArrayBuffer.isView(val)) {
                    return {
                        __type: val.constructor.name,
                        byteLength: val.byteLength,
                    };
                }

                // Handle DOM nodes
                if (typeof Node !== 'undefined' && val instanceof Node) {
                    return {
                        __type: 'DOMNode',
                        nodeName: val.nodeName,
                        nodeType: val.nodeType,
                    };
                }

                // Handle Promise (can't serialize, just mark it)
                if (val instanceof Promise) {
                    return '[Promise]';
                }

                // Handle Array
                if (Array.isArray(val)) {
                    return val.map((item, index) =>
                        serialize(item, depth + 1, `${path}[${index}]`)
                    );
                }

                // Handle plain objects
                const result: Record<string, unknown> = {};
                for (const key of Object.keys(val)) {
                    try {
                        result[key] = serialize(
                            (val as Record<string, unknown>)[key],
                            depth + 1,
                            `${path}.${key}`
                        );
                    } catch (keyError) {
                        result[key] = `[Error accessing property: ${keyError instanceof Error ? keyError.message : String(keyError)}]`;
                    }
                }
                return result;
            } finally {
                // Remove from seen set to allow the same object in different paths
                // (only circular refs in the same path should be marked)
                // Note: WeakSet doesn't support delete in all cases, so we keep items
            }
        }

        return '[Unknown type]';
    }

    try {
        return serialize(value, 0, 'root');
    } catch (error) {
        log.error('Serialization failed:', error);
        return {
            __type: 'SerializationError',
            message: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Safely deserialize a value, reconstructing special types.
 */
export function safeDeserialize(value: unknown): unknown {
    if (value === null || typeof value !== 'object') {
        return value;
    }

    // Check for special type markers
    const obj = value as Record<string, unknown>;
    if (obj.__type) {
        switch (obj.__type) {
            case 'Error': {
                const error = new Error(obj.message as string);
                error.name = obj.name as string;
                if (obj.stack) {
                    error.stack = obj.stack as string;
                }
                return error;
            }
            case 'Date':
                return new Date(obj.value as string);
            case 'RegExp':
                return new RegExp(obj.source as string, obj.flags as string);
            case 'Map': {
                const map = new Map();
                for (const [k, v] of obj.entries as [unknown, unknown][]) {
                    map.set(safeDeserialize(k), safeDeserialize(v));
                }
                return map;
            }
            case 'Set': {
                const set = new Set();
                for (const v of obj.values as unknown[]) {
                    set.add(safeDeserialize(v));
                }
                return set;
            }
            // For ArrayBuffer, TypedArrays, DOMNodes - return as-is (can't reconstruct)
            default:
                return obj;
        }
    }

    // Handle arrays
    if (Array.isArray(value)) {
        return value.map(safeDeserialize);
    }

    // Handle plain objects
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
        result[key] = safeDeserialize(obj[key]);
    }
    return result;
}

/**
 * Safely stringify a value to JSON.
 * Returns the JSON string or an error message if serialization fails.
 */
export function safeStringify(value: unknown): string {
    try {
        const serialized = safeSerialize(value);
        return JSON.stringify(serialized, null, 2);
    } catch (error) {
        log.error('Failed to stringify:', error);
        return JSON.stringify({
            __type: 'StringifyError',
            message: error instanceof Error ? error.message : String(error),
        });
    }
}

/**
 * Format an error for display with detailed information.
 */
export function formatError(error: unknown): {
    message: string;
    type: string;
    stack?: string;
    details?: Record<string, unknown>;
} {
    if (error instanceof Error) {
        // Get any custom properties on the error object
        const customProps: Record<string, unknown> = {};
        for (const key of Object.keys(error)) {
            if (key !== 'message' && key !== 'name' && key !== 'stack') {
                customProps[key] = (error as unknown as Record<string, unknown>)[key];
            }
        }

        return {
            message: error.message,
            type: error.name || 'Error',
            stack: error.stack,
            details: Object.keys(customProps).length > 0 ? customProps : undefined,
        };
    }

    if (typeof error === 'string') {
        return {
            message: error,
            type: 'StringError',
        };
    }

    return {
        message: String(error),
        type: 'UnknownError',
        details: typeof error === 'object' ? safeSerialize(error) as Record<string, unknown> : undefined,
    };
}
