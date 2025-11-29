/**
 * Function declaration for extracting facts from conversations
 * Uses Gemini function calling for structured output
 */

/**
 * Function declaration for Gemini to extract facts from a conversation
 */
export const EXTRACT_FACTS_FUNCTION = {
  name: 'save_extracted_facts',
  description: `Save facts extracted from the conversation to the user's memory. 
Call this function with all the useful information you've identified from the conversation.
Only include information that would be valuable to remember for future conversations.`,
  parameters: {
    type: 'object',
    properties: {
      facts: {
        type: 'array',
        description: 'Array of facts extracted from the conversation',
        items: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The fact content, written in third person (e.g., "User prefers TypeScript")',
            },
            confidence: {
              type: 'string',
              enum: ['high', 'medium'],
              description: 'Confidence level of the extraction',
            },
            category: {
              type: 'string',
              enum: ['preference', 'fact', 'interest', 'instruction', 'context'],
              description: 'Category of the extracted fact',
            },
          },
          required: ['content', 'confidence', 'category'],
        },
      },
    },
    required: ['facts'],
  },
} as const;

/**
 * Type for the save_extracted_facts function parameters
 */
export interface ExtractFactsFunctionParams {
  facts: Array<{
    content: string;
    confidence: 'high' | 'medium';
    category: 'preference' | 'fact' | 'interest' | 'instruction' | 'context';
  }>;
}

/**
 * Validate and extract parameters from a function call
 */
export function parseExtractFactsParams(args: unknown): ExtractFactsFunctionParams | null {
  if (!args || typeof args !== 'object') {
    return null;
  }

  const params = args as Record<string, unknown>;

  if (!Array.isArray(params.facts)) {
    return null;
  }

  const validFacts = params.facts.filter((fact: unknown) => {
    if (!fact || typeof fact !== 'object') return false;
    const f = fact as Record<string, unknown>;
    return (
      typeof f.content === 'string' &&
      f.content.trim().length > 0 &&
      ['high', 'medium'].includes(f.confidence as string) &&
      ['preference', 'fact', 'interest', 'instruction', 'context'].includes(f.category as string)
    );
  });

  return { facts: validFacts as ExtractFactsFunctionParams['facts'] };
}

/**
 * Get the extraction tool configuration for Gemini requests
 */
export function getExtractionTool(): { functionDeclarations: [typeof EXTRACT_FACTS_FUNCTION] } {
  return {
    functionDeclarations: [EXTRACT_FACTS_FUNCTION],
  };
}
