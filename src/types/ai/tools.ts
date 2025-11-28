/**
 * Tool system types
 * 
 * AI SDK v5 Changes:
 * - `parameters` → `inputSchema` for tool definitions
 * - `args` → `input` for tool execute function
 * - Added `outputSchema` for output validation
 */

import type { z } from 'zod';

export interface ToolDefinition<
    TName extends string = string,
    TInput extends z.ZodType = z.ZodType,
    TOutput = unknown
> {
    name: TName;
    description: string;
    /** AI SDK v5: inputSchema replaces parameters */
    inputSchema: TInput;
    /** AI SDK v5: Optional output schema for validation */
    outputSchema?: z.ZodType<TOutput>;
    /** AI SDK v5: input replaces args */
    execute: (input: z.infer<TInput>, abortSignal?: AbortSignal) => Promise<TOutput> | TOutput;
    category?: ToolCategory;
    requiresPermission?: string[];
    experimental?: boolean;
}

/**
 * Legacy tool definition for backward compatibility
 * @deprecated Use ToolDefinition with inputSchema instead
 */
export interface LegacyToolDefinition<
    TName extends string = string,
    TParams extends z.ZodType = z.ZodType,
    TResult = unknown
> {
    name: TName;
    description: string;
    /** @deprecated Use inputSchema instead */
    parameters: TParams;
    execute: (args: z.infer<TParams>, abortSignal?: AbortSignal) => Promise<TResult> | TResult;
    category?: ToolCategory;
    requiresPermission?: string[];
    experimental?: boolean;
}

export type ToolCategory =
    | 'browser'
    | 'tabs'
    | 'search'
    | 'memory'
    | 'interaction'
    | 'mcp'
    | 'agent'
    | 'utility';

export interface ToolExecutionContext {
    abortSignal?: AbortSignal;
    userId?: string;
    threadId?: string;
    messageId?: string;
}

export interface ToolExecutionResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: ToolExecutionError;
    metadata?: {
        executionTime?: number;
        retryCount?: number;
        [key: string]: unknown;
    };
}

export interface ToolExecutionError {
    code: string;
    message: string;
    details?: unknown;
    retryable?: boolean;
}

// Tool registry types
export type ToolRegistry = Map<string, ToolDefinition>;

export interface ToolCapabilities {
    extensionTools: boolean;
    mcpTools: boolean;
    agentTools: boolean;
    interactionTools: boolean;
}
