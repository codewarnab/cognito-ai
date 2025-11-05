/**
 * Tool system types
 */

import type { z } from 'zod';

export interface ToolDefinition<
    TName extends string = string,
    TParams extends z.ZodType = z.ZodType,
    TResult = unknown
> {
    name: TName;
    description: string;
    parameters: TParams;
    execute: (args: z.infer<TParams>) => Promise<TResult> | TResult;
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
