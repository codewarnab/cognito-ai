/**
 * Web Streams Polyfill for Browser Environment
 * 
 * Node.js's node:stream/web module provides web-compatible streams.
 * In browsers, these are already available globally, so we just re-export them.
 */

// Re-export browser's native Web Streams API
export const ReadableStream = globalThis.ReadableStream;
export const WritableStream = globalThis.WritableStream;
export const TransformStream = globalThis.TransformStream;
export const ReadableStreamDefaultReader = globalThis.ReadableStreamDefaultReader;
export const WritableStreamDefaultWriter = globalThis.WritableStreamDefaultWriter;

// Common stream types that might be imported
export const ByteLengthQueuingStrategy = globalThis.ByteLengthQueuingStrategy;
export const CountQueuingStrategy = globalThis.CountQueuingStrategy;

// For compatibility with imports that expect a default export
export default {
    ReadableStream: globalThis.ReadableStream,
    WritableStream: globalThis.WritableStream,
    TransformStream: globalThis.TransformStream,
};
