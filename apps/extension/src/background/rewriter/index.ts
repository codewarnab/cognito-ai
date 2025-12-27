/**
 * Rewriter Module
 * Exports all rewriter-related functionality
 */

// Primary exports (new names)
export { rewriter, Rewriter } from './rewriter';
export type { RewriterOptions } from './rewriter';

// Backward compatibility aliases
export { geminiRewriter, GeminiRewriter } from './rewriter';

export { handleRewriteRequest } from './handler';

// Backend rewriter exports
export { rewriteWithBackend } from './backendRewriter';
export type { BackendRewriteOptions, BackendRewriteResult } from './backendRewriter';
