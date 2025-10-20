/**
 * Tool Registry for AI SDK v5
 * Manages tool definitions and execution for Chrome Extension actions
 */

import { z } from 'zod';
import { createLogger } from '../logger';

const log = createLogger('ToolRegistry');

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  execute: (args: any) => Promise<any>;
}

/**
 * Global tool registry
 */
const tools = new Map<string, ToolDefinition>();

/**
 * Register a tool with the AI SDK
 */
export function registerTool(definition: ToolDefinition) {
  if (tools.has(definition.name)) {
    log.warn('⚠️ Tool already registered, skipping duplicate registration:', definition.name);
    return; // Don't re-register
  }
  
  tools.set(definition.name, definition);
  log.info('✅ Registered tool:', { name: definition.name, description: definition.description });
  log.info('📊 Total tools registered:', tools.size);
}

/**
 * Get all registered tools in AI SDK v5 format
 * Converts 'parameters' to 'inputSchema' as required by AI SDK v5
 */
export function getAllTools(): Record<string, { description: string; inputSchema: z.ZodSchema; execute: (args: any) => Promise<any> }> {
  const toolsObject: Record<string, any> = {};
  
  tools.forEach((tool, name) => {
    toolsObject[name] = {
      description: tool.description,
      inputSchema: tool.parameters, // AI SDK v5 uses inputSchema
      execute: async (args: any) => {
        log.info(`🔧 EXECUTING TOOL: ${name}`, { args });
        try {
          const result = await tool.execute(args);
          log.info(`✅ TOOL COMPLETED: ${name}`, { result });
          return result;
        } catch (error) {
          log.error(`❌ TOOL FAILED: ${name}`, error);
          throw error;
        }
      },
    };
  });
  
  log.info('🔍 getAllTools called, returning tools:', { count: Object.keys(toolsObject).length, names: Object.keys(toolsObject) });
  
  return toolsObject;
}

/**
 * Get a specific tool by name
 */
export function getTool(name: string): ToolDefinition | undefined {
  return tools.get(name);
}

/**
 * Clear all registered tools (useful for testing)
 */
export function clearAllTools() {
  tools.clear();
  log.info('Cleared all tools');
}

/**
 * Get count of registered tools
 */
export function getToolCount(): number {
  return tools.size;
}

/**
 * Get all tool names
 */
export function getToolNames(): string[] {
  return Array.from(tools.keys());
}
