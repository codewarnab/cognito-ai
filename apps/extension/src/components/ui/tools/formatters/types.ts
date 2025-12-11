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
    customIcon?: 'upload' | string; // Optional custom icon identifier
}

export type ActionFormatter = (ctx: ActionFormatterContext) => FormattedAction;
