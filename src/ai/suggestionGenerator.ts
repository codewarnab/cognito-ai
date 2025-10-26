/**
 * Suggestion Generator Service
 * Uses Vercel AI SDK's generateObject (remote) or Chrome's Prompt API (local)
 * to create context-aware suggestions
 */

import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { createLogger } from '../logger';
import type { PageContext } from '../utils/pageContextExtractor';
import { generateLocalContextualSuggestions } from './localSuggestionGenerator';

const log = createLogger('SuggestionGenerator');

// Zod schema for suggestion array
const suggestionSchema = z.object({
    suggestions: z.array(
        z.object({
            title: z.string().describe('Short action title (3-7 words)'),
            action: z.string().describe('Full action text for user to send'),
        })
    ).length(4).describe('Exactly 4 contextual action suggestions'),
});

export type Suggestion = {
    title: string;
    action: string;
};

/**
 * Generate contextual suggestions using AI (remote or local)
 * @param pageContext - Current page context
 * @param apiKey - Optional API key for remote mode. If not provided, uses local AI
 */
export async function generateContextualSuggestions(
    pageContext: PageContext | null,
    apiKey?: string
): Promise<Suggestion[] | null> {
    try {
        // If no API key provided, try local AI first
        if (!apiKey) {
            log.info('No API key provided, using local AI for suggestions');
            return await generateLocalContextualSuggestions(pageContext);
        }

        // Remote mode: Use Gemini API
        try {
            // Create Google AI provider
            const google = createGoogleGenerativeAI({
                apiKey,
            });

            const model = google('gemini-2.5-flash-lite');

            // Build prompt with page context
            const prompt = buildSuggestionPrompt(pageContext);

            log.info('Generating remote suggestions for:', pageContext?.url || 'unknown page');

            // Generate suggestions with retry logic
            const result = await generateWithRetry(model, prompt);

            if (!result?.suggestions || result.suggestions.length !== 4) {
                log.warn('Invalid suggestions result:', result);
                // Fallback to local if remote fails
                log.info('Falling back to local AI');
                return await generateLocalContextualSuggestions(pageContext);
            }

            log.info('Generated remote suggestions successfully');
            return result.suggestions;

        } catch (error) {
            log.error('Remote suggestion generation failed, falling back to local:', error);
            // Fallback to local AI if remote fails
            return await generateLocalContextualSuggestions(pageContext);
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

    let prompt = `You are a browser AI assistant. Generate 4 contextual action suggestions based on the current page.

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

    prompt += `\nGenerate 4 diverse, actionable suggestions that are relevant to this page and context.
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
            const result = await generateObject({
                model,
                schema: suggestionSchema,
                prompt,
                temperature: 0.8, // More creative suggestions
                maxRetries: 0, // Handle retries manually
            });

            return result.object;

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
