/**
 * Type definitions for Side Panel components
 */

export type ChatMode = 'text' | 'voice';

export interface TabContext {
    url?: string;
    title?: string;
}

export interface ContextWarningState {
    percent: number;
}
