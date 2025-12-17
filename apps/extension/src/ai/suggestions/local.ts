/**
 * Local Suggestion Generator Service
 * Uses Chrome's built-in Prompt API with structured output (JSON Schema)
 * Separate AI instance from the main chat to avoid interference
 */

import { createLogger } from '~logger';
import type { PageContext } from '@/utils/tabs';

const log = createLogger('LocalSuggestionGenerator', 'AI_PROMPTS');

export type Suggestion = {
    title: string;
    action: string;
};

// JSON Schema for suggestion output format - 3 pills with progressive lengths
const SUGGESTION_SCHEMA = {
    type: "object",
    properties: {
        suggestions: {
            type: "array",
            minItems: 3,
            maxItems: 3,
            items: {
                type: "object",
                properties: {
                    title: {
                        type: "string",
                        description: "Action title - progressively longer (first: 2-3 words, second: 3-4 words, third: 4-6 words)"
                    },
                    action: {
                        type: "string",
                        description: "Full action text for user to send"
                    }
                },
                required: ["title", "action"],
                additionalProperties: false
            }
        }
    },
    required: ["suggestions"],
    additionalProperties: false
};

/**
 * Check if Chrome's AI API is available
 */
async function isLocalAIAvailable(): Promise<boolean> {
    try {
        // Check if Chrome LanguageModel API exists
        if (!window.LanguageModel) {
            log.warn('Chrome LanguageModel API not available');
            return false;
        }

        const availability = await window.LanguageModel.availability();
        log.info('LanguageModel availability check:', availability);

        const isAvailable = availability === 'available' || availability === 'downloaded' || availability === undefined;

        log.info('Local AI availability:', {
            availability,
            isReady: isAvailable
        });

        return isAvailable;
    } catch (error) {
        log.warn('Local AI not available:', error);
        return false;
    }
}

/**
 * Create a new AI session specifically for suggestions
 * This is a separate instance from the main chat AI
 */
async function createSuggestionSession() {
    try {
        log.info('Creating suggestion AI session...');

        const session = await window.LanguageModel?.create({
            temperature: 0.8, // More creative for suggestions
            topK: 40,
            systemInstruction: `You are a browser AI assistant that generates contextual suggestions.
Generate exactly 3 diverse, actionable suggestions based on the current page context.
IMPORTANT: Titles must be progressively longer - first is shortest (2-3 words), second is medium (3-4 words), third is longest (4-6 words).
Return ONLY valid JSON matching the required schema.`,
        });

        log.info('Suggestion AI session created successfully');
        return session;
    } catch (error) {
        log.error('Failed to create suggestion AI session:', error);
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

    prompt += `\nGenerate exactly 3 actionable suggestions that are relevant to this page and context.

CRITICAL - Title lengths must be progressively longer:
1. First suggestion: SHORTEST title (2-3 words only), e.g. "Check emails" or "Search tabs"
2. Second suggestion: MEDIUM title (3-4 words), e.g. "Find recent GitHub visits"
3. Third suggestion: LONGEST title (4-6 words), e.g. "Set reminder for tomorrow meeting"

Each suggestion should:
- Be specific and actionable
- Relate to the current page or browser context
- Use natural language (how a user would actually ask)
- Vary in type (navigation, organization, search, interaction, reminders, etc.)

Examples:
1. "Open Gmail" (2 words)
2. "Find my bookmarks" (3 words)  
3. "Search history for yesterday's article" (5 words)

Make the suggestions contextual to the current page when possible.

Return ONLY valid JSON matching the required schema. Do not include any markdown, explanations, or extra text.`;

    return prompt;
}

/**
 * Generate contextual suggestions using local AI with structured output
 * Uses a separate AI instance from the main chat
 */
export async function generateLocalContextualSuggestions(
    pageContext: PageContext | null
): Promise<Suggestion[] | null> {
    try {
        // Check if local AI is available
        const available = await isLocalAIAvailable();
        if (!available) {
            log.warn('Local AI not available for suggestions');
            return null;
        }

        // Create a new session specifically for suggestions
        const session = await createSuggestionSession();
        if (!session) {
            log.error('Failed to create suggestion session');
            return null;
        }

        try {
            // Build prompt
            const prompt = buildSuggestionPrompt(pageContext);

            log.info('Generating local suggestions for:', pageContext?.url || 'unknown page');

            let result: string;

            // Try with responseConstraint (structured output) first
            try {
                result = await session.prompt(prompt, {
                    responseConstraint: SUGGESTION_SCHEMA,
                });
                log.info('Used structured output (responseConstraint)');
            } catch (constraintError) {
                // Fallback: Use regular prompt without constraint
                log.warn('responseConstraint not supported, using regular prompt:', constraintError);
                result = await session.prompt(prompt);
                log.info('Used regular prompt (fallback)');
            }

            // Parse the JSON response
            let parsed: any;
            try {
                // Try to parse as-is
                parsed = JSON.parse(result);
            } catch (parseError) {
                // Try to extract JSON from markdown code blocks
                log.warn('Failed to parse JSON directly, trying to extract from markdown:', parseError);
                const jsonMatch = result.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
                if (jsonMatch && jsonMatch[1]) {
                    parsed = JSON.parse(jsonMatch[1]);
                    log.info('Extracted JSON from markdown code block');
                } else {
                    // Try to find JSON object in the response
                    const objectMatch = result.match(/\{[\s\S]*"suggestions"[\s\S]*\]/);
                    if (objectMatch) {
                        parsed = JSON.parse(objectMatch[0] + '}');
                        log.info('Extracted JSON object from response');
                    } else {
                        log.error('Could not extract valid JSON from response:', result.substring(0, 200));
                        return null;
                    }
                }
            }

            if (!parsed?.suggestions || !Array.isArray(parsed.suggestions)) {
                log.warn('Invalid suggestions result - missing suggestions array:', parsed);
                return null;
            }

            // Take up to 3 suggestions
            const suggestions = parsed.suggestions.slice(0, 3);

            if (suggestions.length === 0) {
                log.warn('No suggestions in result');
                return null;
            }

            // Validate each suggestion has required fields
            const validSuggestions = suggestions.every(
                (s: any) => typeof s.title === 'string' && typeof s.action === 'string'
            );

            if (!validSuggestions) {
                log.warn('Suggestions missing required fields:', suggestions);
                return null;
            }

            log.info('Generated local suggestions successfully:', {
                count: suggestions.length,
                usedConstraint: result.includes('{') && !result.includes('```')
            });
            return suggestions;

        } finally {
            // Clean up: destroy the session when done
            try {
                if (session.destroy) {
                    await session.destroy();
                    log.debug('Suggestion session destroyed');
                }
            } catch (error) {
                log.warn('Failed to destroy suggestion session:', error);
            }
        }

    } catch (error) {
        log.error('Failed to generate local suggestions:', error);
        return null;
    }
}

