/**
 * Writer Module Re-export
 * 
 * This file re-exports the Writer class and related utilities from
 * the core module for backward compatibility.
 * 
 * @module writer/writer
 * @deprecated Import from './core/writer' or './index' instead
 */

export { writer, Writer, geminiWriter, GeminiWriter } from './core/writer';
export type { WriterOptions } from './core/types';
