/**
 * Extension Tools MCP Helpers
 *
 * Provides helper functions for treating the extension-registered tools as
 * MCP tools (used by Claude Code via createSdkMcpServer).
 */

import { executeToolOnExtension, getRegisteredTools } from './toolStore.js';

export interface McpServerLogger {
    debug?: (message: string, meta?: unknown) => void;
    info?: (message: string, meta?: unknown) => void;
    warn?: (message: string, meta?: unknown) => void;
    error?: (message: string, meta?: unknown) => void;
}

const MCP_EXTENSION_TOOL_PREFIX = 'mcp__extension__';

/**
 * Base (un-prefixed) tool names as registered by the extension.
 */
export function getExtensionToolNamesBase(): string[] {
    return getRegisteredTools().map((t) => t.name);
}

/**
 * Tool names as exposed through the MCP server namespace (Claude Code format).
 */
export function getExtensionToolNames(): string[] {
    return getExtensionToolNamesBase().map((name) => `${MCP_EXTENSION_TOOL_PREFIX}${name}`);
}

export function isExtensionTool(toolName: string): boolean {
    return toolName.startsWith(MCP_EXTENSION_TOOL_PREFIX);
}

export function extractOriginalToolName(toolName: string): string {
    return isExtensionTool(toolName) ? toolName.slice(MCP_EXTENSION_TOOL_PREFIX.length) : toolName;
}

/**
 * Create a lightweight tool map that can be passed to MCP server builders.
 * This is currently not used by the core bridge flow, but is kept for reuse.
 */
export function createExtensionMcpTools(options?: { logger?: McpServerLogger }): Record<string, unknown> {
    const logger = options?.logger;
    const tools = getRegisteredTools();

    const mcpTools: Record<string, unknown> = {};

    for (const t of tools) {
        mcpTools[t.name] = {
            description: t.description || `Extension tool: ${t.name}`,
            parameters: t.parameters,
            execute: async (args: unknown) => {
                const result = await executeToolOnExtension(t.name, args, { interactive: true });
                if (!result.success) {
                    const err = result.error || 'Tool execution failed';
                    logger?.warn?.('[extension-mcp] tool failed', { tool: t.name, err });
                    throw new Error(err);
                }
                return result.result;
            },
        };
    }

    return mcpTools;
}

