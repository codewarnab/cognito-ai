/**
 * Type definitions for History Search Page
 */

// Search result types
export interface HistoryResultItem {
    id: string;
    url: string;
    title: string;
    snippet: string;
    visitedAt: number;
    favicon?: string;
    score?: number;
}

export interface HistoryResultGroup {
    domain: string;
    favicon?: string;
    items: HistoryResultItem[];
    totalItems: number;
    isExpanded?: boolean;
}

// Search filter types
export interface DateRange {
    start: number | null;
    end: number | null;
}

export interface SearchFilters {
    query: string;
    dateRange: DateRange;
    domains: string[];
    limit?: number;
    offset?: number;
}

// Settings types
export interface HistorySettings {
    modelReady: boolean;
    paused: boolean;
    domainAllowlist: string[];
    domainDenylist: string[];
}

// Message types
export type HistoryMessage =
    | { type: 'GET_SETTINGS' }
    | { type: 'SET_PAUSED'; paused: boolean }
    | { type: 'CLEAR_INDEX' }
    | { type: 'UPDATE_FILTERS'; allowlist?: string[]; denylist?: string[] };

export type HistoryResponse =
    | { type: 'SETTINGS'; data: HistorySettings }
    | { type: 'CLEAR_OK' }
    | { type: 'ERROR'; code: string; message: string };

export type SearchPortMessage =
    | { type: 'SEARCH'; payload: SearchFilters }
    | { type: 'SEARCH_RESULT'; chunk: HistoryResultGroup[]; total: number; final?: boolean }
    | { type: 'SEARCH_DONE' }
    | { type: 'SEARCH_ERROR'; message: string };

// Date filter presets
export enum DatePreset {
    TODAY = 'today',
    WEEK = '7d',
    MONTH = '30d',
    ALL = 'all',
    CUSTOM = 'custom',
}

// Toast notification types
export interface Toast {
    id: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
    duration?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
}
