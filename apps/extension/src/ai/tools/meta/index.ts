/**
 * Meta Tools - Adaptive Mode
 * 
 * These tools enable on-demand tool discovery and orchestrated execution,
 * allowing the AI to find and use tools without loading all definitions in context.
 */

export { discoverTools, getToolIndex } from './discoverTools';
export { executeTools } from './executeTools';
export { validateCode } from './validateCode';
export type { TrackedToolCall, ExecuteToolsResult } from './types';
