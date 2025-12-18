/**
 * Backend Suggestions Client
 * Generates contextual suggestions via Vercel backend API
 */

import { createLogger } from '~logger';
import { ENV } from '@/utils/env';
import type { PageContext } from '@/utils/tabs';
import type { Suggestion } from './generator';

const log = createLogger('BackendSuggestions', 'AI_PROMPTS');

// Use centralized ENV for backend URL
const BACKEND_URL = ENV.BACKEND_API_URL;

interface SimplifiedPageContext {
    url: string;
    title: string;
    description?: string;
    headings?: Array<{ level: number; text: string }>;
    buttons?: Array<{ text: string }>;
    links?: Array<{ text: string }>;
    textPreview?: string;
}

/**
 * Convert full PageContext to simplified version for API
 * Reduces payload size by limiting arrays and text length
 */
function simplifyPageContext(context: PageContext | null): SimplifiedPageContext | null {
    if (!context) return null;

    return {
        url: context.url,
        title: context.title,
        description: context.metadata.description,
        headings: context.headings.slice(0, 5).map(h => ({
            level: h.level,
            text: h.text.substring(0, 100),
        })),
        buttons: context.buttons.slice(0, 8).map(b => ({
            text: b.text.substring(0, 50),
        })),
        links: context.links.slice(0, 5).map(l => ({
            text: l.text.substring(0, 100),
        })),
        textPreview: context.text?.substring(0, 500),
    };
}

export interface BackendSuggestionsResult {
    suggestions: Suggestion[];
    cached: boolean;
}

/**
 * Generate suggestions using backend API
 */
export async function generateBackendSuggestions(
    pageContext: PageContext | null
): Promise<Suggestion[] | null> {
    log.info('Generating suggestions via backend:', {
        url: pageContext?.url?.substring(0, 50)
    });

    try {
        const simplifiedContext = simplifyPageContext(pageContext);

        const response = await fetch(`${BACKEND_URL}/api/ai/suggestions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pageContext: simplifiedContext,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Backend error: ${response.status}`);
        }

        const result: BackendSuggestionsResult = await response.json();

        log.info('Backend suggestions generated:', {
            count: result.suggestions.length,
            cached: result.cached,
        });

        return result.suggestions;

    } catch (error) {
        log.error('Backend suggestion generation failed:', error);
        return null;
    }
}
