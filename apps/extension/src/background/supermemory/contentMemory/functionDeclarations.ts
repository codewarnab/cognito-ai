/**
 * Function declarations for extracting insights from content interactions
 * Uses Gemini function calling for structured output
 */

import type { ContentMemorySource, ContentInsight } from './types';

/**
 * Function for extracting insights from summarizer usage
 */
export const SUMMARIZER_INSIGHTS_FUNCTION = {
  name: 'save_reading_insights',
  description: `Save insights about what the user is reading/researching based on their summarization activity.
Extract useful information about their interests, topics they care about, and research areas.`,
  parameters: {
    type: 'object',
    properties: {
      insights: {
        type: 'array',
        description: "Insights about user's reading interests",
        items: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description:
                'The insight, written in third person (e.g., "User is interested in...")',
            },
            confidence: {
              type: 'string',
              enum: ['high', 'medium'],
            },
            category: {
              type: 'string',
              enum: ['interest', 'topic', 'context'],
              description: 'Type of insight',
            },
          },
          required: ['content', 'confidence', 'category'],
        },
      },
    },
    required: ['insights'],
  },
} as const;

/**
 * Function for extracting insights from writer usage
 */
export const WRITER_INSIGHTS_FUNCTION = {
  name: 'save_writing_insights',
  description: `Save insights about what the user writes about and their writing contexts.
Extract information about topics they create content for, platforms they use, and writing patterns.`,
  parameters: {
    type: 'object',
    properties: {
      insights: {
        type: 'array',
        description: "Insights about user's writing activities",
        items: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The insight, written in third person',
            },
            confidence: {
              type: 'string',
              enum: ['high', 'medium'],
            },
            category: {
              type: 'string',
              enum: ['topic', 'preference', 'context'],
            },
          },
          required: ['content', 'confidence', 'category'],
        },
      },
    },
    required: ['insights'],
  },
} as const;

/**
 * Function for extracting insights from rewriter usage
 */
export const REWRITER_INSIGHTS_FUNCTION = {
  name: 'save_style_insights',
  description: `Save insights about the user's writing style preferences based on their rewrite choices.
Extract information about their preferred tone, length, and style transformations.`,
  parameters: {
    type: 'object',
    properties: {
      insights: {
        type: 'array',
        description: "Insights about user's style preferences",
        items: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The insight, written in third person',
            },
            confidence: {
              type: 'string',
              enum: ['high', 'medium'],
            },
            category: {
              type: 'string',
              enum: ['writing_style', 'preference'],
            },
          },
          required: ['content', 'confidence', 'category'],
        },
      },
    },
    required: ['insights'],
  },
} as const;

/**
 * Get the appropriate function declaration for a content source
 */
export function getContentInsightFunction(source: ContentMemorySource) {
  switch (source) {
    case 'summarizer':
      return { functionDeclarations: [SUMMARIZER_INSIGHTS_FUNCTION] };
    case 'writer':
      return { functionDeclarations: [WRITER_INSIGHTS_FUNCTION] };
    case 'rewriter':
      return { functionDeclarations: [REWRITER_INSIGHTS_FUNCTION] };
  }
}

/**
 * Parse insights from function call response
 */
export function parseContentInsights(
  args: unknown,
  source: ContentMemorySource
): ContentInsight[] | null {
  if (!args || typeof args !== 'object') return null;

  const params = args as Record<string, unknown>;
  if (!Array.isArray(params.insights)) return null;

  return params.insights
    .filter((insight: unknown) => {
      if (!insight || typeof insight !== 'object') return false;
      const i = insight as Record<string, unknown>;
      return (
        typeof i.content === 'string' &&
        i.content.trim().length > 0 &&
        ['high', 'medium'].includes(i.confidence as string)
      );
    })
    .map((insight: Record<string, unknown>) => ({
      content: insight.content as string,
      confidence: insight.confidence as 'high' | 'medium',
      category: insight.category as ContentInsight['category'],
      source,
    }));
}
