/**
 * Rewriter Types
 * Type definitions for the rewriter module
 */

import type { RewritePreset } from '@/types';

/**
 * Options for text rewriting
 */
export interface RewriterOptions {
    /** Preset rewrite style (e.g., 'formal', 'casual', 'shorter', 'longer') */
    preset?: RewritePreset;
    /** Custom rewrite instruction (used if no preset is provided) */
    instruction?: string;
    /** Enable URL context fetching (Gemini/Claude only) */
    enableUrlContext?: boolean;
    /** Enable web search for additional context */
    enableGoogleSearch?: boolean;
    /** Enable AI-driven memory search via function calling */
    enableSupermemorySearch?: boolean;
}

/**
 * Configuration returned by AI providers
 */
export interface ProviderConfig {
    url: string;
    headers: HeadersInit;
    modelName: string;
    type: string;
}

/**
 * Result from a memory search operation
 */
export interface MemorySearchResult {
    success: boolean;
    formattedResult: string;
}

/**
 * Common constants for all providers
 */
export const REWRITER_CONSTANTS = {
    /** Maximum number of function calls allowed in a conversation loop */
    MAX_FUNCTION_CALLS: 3,
    /** Default temperature for generation */
    DEFAULT_TEMPERATURE: 0.7,
    /** Default top_p for generation */
    DEFAULT_TOP_P: 0.95,
} as const;
