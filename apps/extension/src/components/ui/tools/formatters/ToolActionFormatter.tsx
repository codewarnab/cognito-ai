/**
 * ToolActionFormatter - Transforms technical tool names into human-readable action descriptions
 * Shows contextual information from tool input/output instead of raw function names
 */

export type { ActionFormatterContext, FormattedAction, ActionFormatter } from './types';
export { formatters } from './registry';
export { defaultFormatter } from './formatters/default';

import type { ActionFormatterContext, FormattedAction } from './types';
import { formatters } from './registry';
import { defaultFormatter } from './formatters/default';
import { isWebMCPTool, webmcpFormatter } from './formatters/webmcp';
import { getToolServerId } from '@/utils/mcp/toolMetadataStore';

/**
 * Format a tool action into a human-readable description
 * @param ctx - Action context with tool name, state, input, and output
 * @returns Formatted action with optional description
 */
export function formatToolAction(ctx: ActionFormatterContext): FormattedAction {
    // Check for WebMCP tools first (dynamic tool names like webmcp_domain_toolname)
    if (isWebMCPTool(ctx.toolName)) {
        try {
            return webmcpFormatter(ctx);
        } catch (error) {
            console.error(`Error formatting WebMCP tool action for ${ctx.toolName}:`, error);
            return defaultFormatter(ctx);
        }
    }

    const formatter = formatters[ctx.toolName] || defaultFormatter;
    try {
        const result = formatter(ctx);

        // Check if this is an MCP tool and add server ID
        const mcpServerId = getToolServerId(ctx.toolName);
        if (mcpServerId) {
            result.mcpServerId = mcpServerId;
        }

        return result;
    } catch (error) {
        console.error(`Error formatting tool action for ${ctx.toolName}:`, error);
        return defaultFormatter(ctx);
    }
}
