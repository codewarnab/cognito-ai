/**
 * Related Questions Generator
 * Generates follow-up questions based on conversation context
 */

import { createLogger } from '~logger';
import type { ModelMessage } from 'ai';

const log = createLogger('GenerateRelatedQuestions', 'SEARCH');

export interface RelatedQuestion {
    /** The follow-up question text */
    query: string;
    /** Optional unique identifier */
    id?: string;
}

export interface RelatedQuestionsResult {
    questions: RelatedQuestion[];
}

/**
 * System prompt for generating related questions.
 * Instructs the AI to create follow-up questions based on the conversation.
 */
const RELATED_QUESTIONS_PROMPT = `You are a helpful assistant that generates follow-up questions.
Based on the conversation, generate exactly 3 related questions that the user might want to ask next.

Requirements:
- Questions should explore the topic deeper or cover related aspects
- Keep questions concise (under 60 characters when possible)
- Questions should be naturally phrased, as if a user would ask them
- Match the language of the conversation

Respond with a JSON object in this exact format:
{
  "questions": [
    { "query": "First follow-up question?" },
    { "query": "Second follow-up question?" },
    { "query": "Third follow-up question?" }
  ]
}`;

/**
 * Generates related follow-up questions based on conversation context.
 * Uses a simple prompt-based approach that works with any model.
 * 
 * @param messages - Recent conversation messages
 * @param generateResponse - Function to generate AI response
 * @returns Array of related questions
 */
export async function generateRelatedQuestions(
    messages: ModelMessage[],
    generateResponse: (prompt: string) => Promise<string>
): Promise<RelatedQuestionsResult> {
    try {
        // Take last 3 messages for context
        const recentMessages = messages.slice(-3);
        const context = recentMessages
            .map((m) => {
                const content = typeof m.content === 'string'
                    ? m.content
                    : JSON.stringify(m.content);
                return `${m.role}: ${content}`;
            })
            .join('\n');

        const prompt = `${RELATED_QUESTIONS_PROMPT}\n\nConversation:\n${context}`;

        const response = await generateResponse(prompt);

        // Parse JSON response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            log.warn('No JSON found in response');
            return { questions: [] };
        }

        const parsed = JSON.parse(jsonMatch[0]) as RelatedQuestionsResult;

        // Validate structure
        if (!Array.isArray(parsed.questions)) {
            log.warn('Invalid questions format');
            return { questions: [] };
        }

        // Filter out invalid questions and add IDs
        const validQuestions = parsed.questions
            .filter((q): q is RelatedQuestion =>
                typeof q === 'object' &&
                typeof q.query === 'string' &&
                q.query.trim().length > 0
            )
            .map((q, index) => ({
                ...q,
                id: q.id ?? `related-${index}-${Date.now()}`,
            }));

        log.debug('Generated related questions', { count: validQuestions.length });
        return { questions: validQuestions };
    } catch (error) {
        log.error('Failed to generate related questions', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return { questions: [] };
    }
}

/**
 * Extracts potential follow-up topics from search results.
 * Can be used as a fallback when AI generation is not available.
 * 
 * @param searchQuery - Original search query
 * @param resultTitles - Titles from search results
 * @returns Array of suggested follow-up questions
 */
export function extractFollowUpTopics(
    searchQuery: string,
    resultTitles: string[]
): RelatedQuestion[] {
    if (resultTitles.length === 0) {
        return [];
    }

    // Extract unique keywords from titles that aren't in the original query
    const queryWords = new Set(searchQuery.toLowerCase().split(/\s+/));
    const suggestions: RelatedQuestion[] = [];

    for (const title of resultTitles.slice(0, 5)) {
        // Find new terms in the title
        const titleWords = title.toLowerCase().split(/\s+/);
        const newTerms = titleWords.filter(
            (word) => word.length > 3 && !queryWords.has(word)
        );

        if (newTerms.length > 0 && suggestions.length < 3) {
            const term = newTerms[0];
            suggestions.push({
                query: `What is ${term}?`,
                id: `followup-${suggestions.length}-${Date.now()}`,
            });
        }
    }

    return suggestions;
}
