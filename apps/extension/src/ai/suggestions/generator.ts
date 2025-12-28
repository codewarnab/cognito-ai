/**
 * Suggestion Generator Service
 * Uses Vercel AI SDK's generateObject (remote) or Chrome's Prompt API (local)
 * to create context-aware suggestions
 * 
 * Includes caching to avoid regenerating suggestions for the same page
 */

import { generateText, Output } from 'ai';
import { z } from 'zod';
import { createLogger } from '~logger';
import type { PageContext } from '@/utils/tabs';
import { generateLocalContextualSuggestions } from './local';
import { getActiveProvider } from '@/utils/credentials';
import { getLightweightModel } from '@/ai/core/lightweightModels';
import { generateBackendSuggestions } from './backendSuggestions';
import { initializeModel } from '../core/modelFactory';
import { ENV } from '@/utils/env';
import { LRUCache } from '~/utils/cache/LRUCache';
import { useSettingsStore } from '@/stores/settings/settingsStore';

const log = createLogger('SuggestionGenerator', 'AI_PROMPTS_SUGGESTIONS');

// ============================================================================
// Suggestions Cache - 10-minute TTL, max 20 pages
// ============================================================================

const suggestionsCache = new LRUCache<string, Suggestion[]>({
    maxSize: 20,
    ttlMs: 10 * 60 * 1000, // 10 minutes
    onEvict: (key) => {
        log.debug('Suggestions cache entry evicted', { key });
    },
});

/**
 * Create cache key from page context
 * Uses URL + title hash for uniqueness
 */
function createCacheKey(pageContext: PageContext | null): string {
    if (!pageContext) return 'no-context';
    // Use URL and title for cache key
    return `${pageContext.url}::${pageContext.title}`;
}

// Zod schema for suggestion array
const suggestionSchema = z.object({
    suggestions: z.array(
        z.object({
            title: z.string().describe('Action title - progressively longer (first: 2-3 words, second: 3-4 words, third: 4-6 words)'),
            action: z.string().describe('Full action text for user to send'),
        })
    ).length(3).describe('Exactly 3 contextual action suggestions with progressively longer titles'),
});

export type Suggestion = {
    title: string;
    action: string;
};

/**
 * Generate contextual suggestions using AI (remote, local, or backend)
 * Uses LRU cache to avoid regenerating for the same page
 * @param pageContext - Current page context
 * @param mode - AI mode ('remote' or 'local'). If 'remote', uses active provider (Vertex or Google AI)
 */
export async function generateContextualSuggestions(
    pageContext: PageContext | null,
    mode: 'remote' | 'local' = 'remote'
): Promise<Suggestion[] | null> {
    // Check cache first
    const cacheKey = createCacheKey(pageContext);
    const cached = suggestionsCache.get(cacheKey);
    if (cached) {
        log.info('📦 Suggestions cache hit', { url: pageContext?.url });
        return cached;
    }

    try {
        // Check if we should use backend mode
        const { useBackendMode } = useSettingsStore.getState();

        if (useBackendMode) {
            log.info('🌐 Using backend mode for suggestions');
            const backendResult = await generateBackendSuggestions(pageContext);

            if (backendResult) {
                suggestionsCache.set(cacheKey, backendResult);
                log.debug('📦 Cached backend suggestions', { url: pageContext?.url });
                return backendResult;
            }

            // If backend fails, we can't fall back to local (no API key)
            log.warn('Backend suggestion generation failed, no fallback available');
            return null;
        }

        // If local mode requested, use local AI (but skip if HIDE_LOCAL_MODE is enabled)
        if (mode === 'local') {
            if (ENV.HIDE_LOCAL_MODE) {
                log.info('Local mode requested but HIDE_LOCAL_MODE is enabled, skipping local AI');
                return null;
            }
            log.info('Using local AI for suggestions');
            const localResult = await generateLocalContextualSuggestions(pageContext);
            if (localResult) {
                suggestionsCache.set(cacheKey, localResult);
                log.debug('📦 Cached local suggestions', { url: pageContext?.url });
            }
            return localResult;
        }

        // Remote mode: Use active provider (respects user's provider selection)
        try {
            // Determine active provider and its corresponding "cheap" model
            const activeProvider = await getActiveProvider();
            const modelConfig = getLightweightModel(activeProvider);

            if (!modelConfig) {
                throw new Error(`No lightweight model configuration for provider: ${activeProvider}`);
            }

            // Initialize model using modelFactory
            // We pass the provider-specific model name (e.g., 'gpt-5-mini' or 'gemini-2.5-flash-lite')
            const { model, provider, modelName } = await initializeModel(modelConfig.model, 'remote');

            log.info('Generating remote suggestions with provider:', provider, 'model:', modelName);

            // Build prompt with page context
            const prompt = buildSuggestionPrompt(pageContext);

            log.info('Generating remote suggestions for:', pageContext?.url || 'unknown page');

            // Generate suggestions with retry logic
            const result = await generateWithRetry(model, prompt);

            if (!result?.suggestions || result.suggestions.length !== 3) {
                log.warn('Invalid suggestions result:', result);
                // Fallback to local if remote fails (but skip if HIDE_LOCAL_MODE is enabled)
                if (!ENV.HIDE_LOCAL_MODE) {
                    log.info('Falling back to local AI');
                    return await generateLocalContextualSuggestions(pageContext);
                }
                log.info('Remote failed but HIDE_LOCAL_MODE is enabled, returning null');
                return null;
            }

            log.info('Generated remote suggestions successfully');
            // Cache successful result
            suggestionsCache.set(cacheKey, result.suggestions);
            log.debug('📦 Cached remote suggestions', { url: pageContext?.url });
            return result.suggestions;

        } catch (error) {
            log.error('Remote suggestion generation failed:', error);
            // Fallback to local AI if remote fails (but skip if HIDE_LOCAL_MODE is enabled)
            if (!ENV.HIDE_LOCAL_MODE) {
                log.info('Falling back to local AI');
                return await generateLocalContextualSuggestions(pageContext);
            }
            log.info('Remote failed but HIDE_LOCAL_MODE is enabled, returning null');
            return null;
        }

    } catch (error) {
        log.error('Failed to generate suggestions:', error);
        return null;
    }
}

/**
 * Build prompt for suggestion generation
 */
function buildSuggestionPrompt(pageContext: PageContext | null): string {
    const capabilities = [
        'navigate to websites and search the web',
        'manage and organize browser tabs into groups',
        'search browser history and find previously visited pages',
        'set reminders for tasks and deadlines',
        'save and retrieve information to/from memory',
        'interact with pages (click buttons, fill forms, read content)',
        'send emails using web-based email services',
        'analyze YouTube videos and provide insights',
    ];

    let prompt = `You are a browser AI assistant. Generate 2 contextual action suggestions based on the current page.

Your capabilities include:
${capabilities.map(c => `- ${c}`).join('\n')}

`;

    if (pageContext) {
        prompt += `Current Page Context:
- URL: ${pageContext.url}
- Title: ${pageContext.title}
`;

        if (pageContext.metadata.description) {
            prompt += `- Description: ${pageContext.metadata.description}\n`;
        }

        if (pageContext.headings.length > 0) {
            prompt += `\nKey Headings:\n`;
            pageContext.headings.slice(0, 5).forEach(h => {
                prompt += `  ${'#'.repeat(h.level)} ${h.text}\n`;
            });
        }

        if (pageContext.buttons.length > 0) {
            prompt += `\nAvailable Buttons:\n`;
            pageContext.buttons.slice(0, 8).forEach(btn => {
                prompt += `  - "${btn.text}"\n`;
            });
        }

        if (pageContext.links.length > 0) {
            prompt += `\nKey Links:\n`;
            pageContext.links.slice(0, 5).forEach(link => {
                prompt += `  - "${link.text}"\n`;
            });
        }

        if (pageContext.text) {
            const preview = pageContext.text.substring(0, 500);
            prompt += `\nPage Content Preview:\n${preview}${pageContext.text.length > 500 ? '...' : ''}\n`;
        }
    } else {
        // No page context available
        prompt += `Current Page: No specific page context available (may be on a restricted page)\n`;
    }

    prompt += `\nGenerate exactly 3 diverse, actionable suggestions that are relevant to this page and context.

CRITICAL - Title lengths must be progressively longer:
1. First suggestion: SHORTEST title (2-3 words only), e.g. "Check emails" or "Search tabs"
2. Second suggestion: MEDIUM title (3-4 words), e.g. "Find recent GitHub visits"
3. Third suggestion: LONGEST title (4-6 words), e.g. "Set reminder for tomorrow meeting"

Each suggestion should:
- Be specific and actionable
- Relate to the current page or browser context
- Use natural language (how a user would actually ask)
- Vary in type (navigation, organization, search, interaction, reminders, etc.)

Examples of good suggestions:
- "Search for React tutorials and organize my tabs"
- "Find my recent GitHub visits from this morning"
- "Set a reminder for my meeting tomorrow at 2pm"
- "Analyze this YouTube video and summarize key points"
- "Search my history for that article I read yesterday"
- "Group all my documentation tabs together"
- "Navigate to Gmail and check my inbox"

Make the suggestions contextual to the current page when possible.`;

    return prompt;
}

/**
 * Generate with exponential backoff retry
 */
async function generateWithRetry(
    model: any,
    prompt: string,
    maxRetries: number = 2
): Promise<{ suggestions: Suggestion[] } | null> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const { output } = await generateText({
                model,
                output: Output.object({ schema: suggestionSchema }),
                prompt,
                temperature: 0.8, // More creative suggestions
                maxRetries: 0, // Handle retries manually
            });

            return output;

        } catch (error: any) {
            lastError = error;

            // Don't retry on certain errors
            if (
                error?.message?.includes('API key') ||
                error?.message?.includes('invalid') ||
                error?.message?.includes('unauthorized')
            ) {
                log.error('Non-retryable error:', error?.message);
                return null;
            }

            // Exponential backoff
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
                log.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    log.error('All retry attempts failed:', lastError);
    return null;
}

