/**
 * Rewriter Feature Types
 * Shared types for the text rewrite feature (select text → rewrite)
 */

/**
 * Preset rewrite options
 */
export type RewritePreset =
    | 'shorter'
    | 'longer'
    | 'professional'
    | 'casual'
    | 'improve'
    | 'simplify'
    | 'enthusiastic'
    | 'conversational';

/**
 * Page context for rewrite operations
 */
export interface RewritePageContext {
    title: string;
    url: string;
    domain: string;
}
