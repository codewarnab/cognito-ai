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

/**
 * Format a tool action into a human-readable description
 * @param ctx - Action context with tool name, state, input, and output
 * @returns Formatted action with optional description
 */
export function formatToolAction(ctx: ActionFormatterContext): FormattedAction {
    const formatter = formatters[ctx.toolName] || defaultFormatter;
    try {
        return formatter(ctx);
    } catch (error) {
        console.error(`Error formatting tool action for ${ctx.toolName}:`, error);
        return defaultFormatter(ctx);
    }
}
