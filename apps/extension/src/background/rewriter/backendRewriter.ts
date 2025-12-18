/**
 * Backend Rewriter Client
 * Routes rewrite requests to Vercel backend instead of direct Gemini API
 * Supports Gemini built-in tools (URL context, Google Search grounding)
 */

import { createLogger } from '~logger';
import type { RewriterOptions } from './geminiRewriter';

const log = createLogger('BackendRewriter', 'BACKGROUND');

const BACKEND_URL =
    import.meta.env.WXT_BACKEND_API_URL ||
    'https://youtube-transcript-generator-five.vercel.app';

export interface BackendRewriteOptions extends Pick<RewriterOptions, 'preset' | 'instruction'> {
    // Gemini built-in tools (Phase 6)
    enableUrlContext?: boolean;
    enableGoogleSearch?: boolean;
}

export interface GroundingMetadata {
    webSearchQueries?: string[];
    searchEntryPoint?: { renderedContent?: string };
    groundingChunks?: Array<{ web?: { uri: string; title?: string } }>;
    groundingSupports?: Array<{
        segment: { text: string };
        groundingChunkIndices: number[];
    }>;
}

export interface BackendRewriteResult {
    text: string;
    preset?: string;
    groundingMetadata?: GroundingMetadata;
}

/**
 * Rewrite text using backend (non-streaming)
 * Supports Gemini built-in tools for URL context and Google Search grounding
 */
export async function rewriteWithBackend(
    text: string,
    options: BackendRewriteOptions = {}
): Promise<BackendRewriteResult> {
    const { enableUrlContext, enableGoogleSearch } = options;
    const hasTools = enableUrlContext || enableGoogleSearch;

    log.info('Rewriting with backend:', {
        textLength: text.length,
        preset: options.preset,
        hasTools,
        enableUrlContext,
        enableGoogleSearch,
    });

    const response = await fetch(`${BACKEND_URL}/api/ai/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text,
            preset: options.preset,
            instruction: options.instruction,
            enableUrlContext,
            enableGoogleSearch,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Backend error: ${response.status}`);
    }

    const result = await response.json();
    log.info('Backend rewrite complete:', {
        resultLength: result.text?.length,
        hasGroundingMetadata: !!result.groundingMetadata,
    });

    return result;
}
