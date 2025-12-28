/**
 * Frontend AI Logic
 * Re-exports from modular structure for backward compatibility
 * 
 * @see ./aiLogic/ for the modularized implementation
 */

// Re-export from the folder (./aiLogic/index.ts)
export { streamAIResponse } from './aiLogic/index';
export type { StreamAIParams, AIProvider, StreamState } from './aiLogic/index';
