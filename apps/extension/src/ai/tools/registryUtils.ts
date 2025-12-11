/**
 * Tool Registry for AI SDK v5
 * Manages tool definitions and execution for Chrome Extension actions
 * 
 * AI SDK v5 Changes:
 * - `parameters` → `inputSchema` for tool definitions
 * - `args` → `input` for tool call arguments
 * - `result` → `output` for tool call results
 * - Added `outputSchema` for validating tool outputs
 */

import { z } from 'zod';
import { createLogger } from '~logger';

const log = createLogger('ToolRegistry');

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  /** Unique tool name */
  name: string;
  /** Description for the AI model to understand tool usage */
  description: string;
  /** Input schema (AI SDK v5 - replaces 'parameters') */
  inputSchema: z.ZodSchema<TInput>;
  /** Optional output schema for validation (AI SDK v5) */
  outputSchema?: z.ZodSchema<TOutput>;
  /** Execute function - receives validated input */
  execute: (input: TInput, abortSignal?: AbortSignal) => Promise<TOutput>;
  /** Optional: Validate execution context before running the tool */
  validateContext?: () => Promise<{ valid: boolean; error?: string }>;
}

/**
 * Legacy tool definition for backward compatibility.
 * @deprecated Use ToolDefinition with inputSchema instead.
 */
export interface LegacyToolDefinition {
  name: string;
  description: string;
  /** @deprecated Use inputSchema instead */
  parameters: z.ZodSchema;
  execute: (args: any, abortSignal?: AbortSignal) => Promise<any>;
  validateContext?: () => Promise<{ valid: boolean; error?: string }>;
}

/**
 * Global tool registry - stores tools in AI SDK v5 format
 */
const tools = new Map<string, ToolDefinition<any, any>>();

/**
 * Normalize tool definition to AI SDK v5 format.
 * Accepts either the new inputSchema or legacy parameters property.
 */
function normalizeToolDefinition(
  definition: ToolDefinition<any, any> | LegacyToolDefinition
): ToolDefinition<any, any> {
  // Check if using legacy 'parameters' property
  if ('parameters' in definition && !('inputSchema' in definition)) {
    log.debug('Converting legacy tool definition to v5 format:', definition.name);
    return {
      name: definition.name,
      description: definition.description,
      inputSchema: definition.parameters,
      execute: definition.execute,
      validateContext: definition.validateContext,
    };
  }
  return definition as ToolDefinition<any, any>;
}

/**
 * Register a tool with the AI SDK v5
 * Accepts both AI SDK v5 format (inputSchema) and legacy format (parameters)
 */
export function registerTool(definition: ToolDefinition<any, any> | LegacyToolDefinition) {
  if (tools.has(definition.name)) {
    log.warn('⚠️ Tool already registered, skipping duplicate registration:', definition.name);
    return; // Don't re-register
  }

  const normalizedDef = normalizeToolDefinition(definition);
  tools.set(definition.name, normalizedDef);
  log.info('✅ Registered tool:', { name: definition.name, description: definition.description });
  log.info('📊 Total tools registered:', tools.size);
}

/**
 * AI SDK v5 tool format returned by getAllTools
 */
export interface AISDKv5Tool {
  description: string;
  inputSchema: z.ZodSchema;
  outputSchema?: z.ZodSchema;
  execute: (input: any) => Promise<any>;
}

/**
 * Get all registered tools in AI SDK v5 format
 * Tools are already stored with inputSchema, this wraps execute with abort handling
 */
export function getAllTools(abortSignal?: AbortSignal): Record<string, AISDKv5Tool> {
  const toolsObject: Record<string, AISDKv5Tool> = {};

  tools.forEach((tool, name) => {
    toolsObject[name] = {
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      execute: async (input: any) => {
        // Check if operation was aborted before starting
        if (abortSignal?.aborted) {
          log.warn(`⛔ TOOL ABORTED BEFORE EXECUTION: ${name}`);
          throw new Error('Operation cancelled');
        }

        log.info(`🔧 EXECUTING TOOL: ${name}`, { input });

        // Run pre-execution validation if defined
        if (tool.validateContext) {
          const validation = await tool.validateContext();
          if (!validation.valid) {
            log.warn(`⛔ TOOL VALIDATION FAILED: ${name}`, { error: validation.error });
            return { error: validation.error, validationFailed: true };
          }
        }

        try {
          // Pass abort signal to tool execution if it accepts it
          const output = await tool.execute(input, abortSignal);

          // Check if aborted after execution
          if (abortSignal?.aborted) {
            log.warn(`⛔ TOOL ABORTED AFTER EXECUTION: ${name}`);
            throw new Error('Operation cancelled');
          }

          log.info(`✅ TOOL COMPLETED: ${name}`, { output });
          return output;
        } catch (error) {
          // Don't log as error if it was cancelled
          if (abortSignal?.aborted || (error instanceof Error && error.message === 'Operation cancelled')) {
            log.info(`🛑 TOOL CANCELLED: ${name}`);
          } else {
            log.error(`❌ TOOL FAILED: ${name}`, error);
          }
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
export function getTool(name: string): ToolDefinition<any, any> | undefined {
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

