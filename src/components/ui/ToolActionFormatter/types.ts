/**
 * Type definitions for Tool Action Formatter
 */

export interface ActionFormatterContext {
    toolName: string;
    state: 'loading' | 'success' | 'error';
    input?: any;
    output?: any;
}

export interface FormattedAction {
    action: string;
    description?: string;
}

export type ActionFormatter = (ctx: ActionFormatterContext) => FormattedAction;
