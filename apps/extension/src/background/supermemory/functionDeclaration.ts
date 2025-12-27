/**
 * Supermemory Function Declaration for Gemini
 * Enables AI-driven memory search via function calling
 */

/**
 * Function declaration for Gemini to search user memories
 * The AI will call this function when it determines context from
 * the user's knowledge base would be helpful.
 */
export const MEMORY_SEARCH_FUNCTION = {
    name: 'search_memories',
    description: `Search the user's personal knowledge base for relevant information, past conversations, notes, and saved content. 
Use this when:
- even if the user does not explicitly mention any of this if you think it would help provide a better, more personalized response based on their history.
- The user refers to something they mentioned before or their past preferences
- The user asks about their own notes, bookmarks, or saved content
- Context from the user's personal history would help provide a better response
- The user uses phrases like "remember when", "my notes on", "what I saved about"
- Writing content that should align with the user's established preferences or style`,
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'The search query to find relevant memories. Be specific and include key terms the user might have used.',
            },
            limit: {
                type: 'number',
                description: 'Maximum number of memory results to return (1-10). Default is 5.',
            },
        },
        required: ['query'],
    },
} as const;

/**
 * Type for the search_memories function parameters
 */
export interface MemorySearchFunctionParams {
    query: string;
    limit?: number;
}

/**
 * Validate and extract parameters from a function call
 */
export function parseMemorySearchParams(args: unknown): MemorySearchFunctionParams | null {
    if (!args || typeof args !== 'object') {
        return null;
    }

    const params = args as Record<string, unknown>;

    if (typeof params.query !== 'string' || !params.query.trim()) {
        return null;
    }

    return {
        query: params.query.trim(),
        limit: typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 10) : 5,
    };
}

// ============================================================================
// OpenAI Tool Format
// ============================================================================

/**
 * Memory search function in OpenAI's tool format
 * @see https://platform.openai.com/docs/guides/function-calling
 */
export const MEMORY_SEARCH_OPENAI_TOOL = {
    type: 'function' as const,
    function: {
        name: MEMORY_SEARCH_FUNCTION.name,
        description: MEMORY_SEARCH_FUNCTION.description,
        strict: true,
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: MEMORY_SEARCH_FUNCTION.parameters.properties.query.description,
                },
                limit: {
                    type: ['number', 'null'],
                    description: MEMORY_SEARCH_FUNCTION.parameters.properties.limit.description,
                },
            },
            required: ['query', 'limit'],
            additionalProperties: false,
        },
    },
};

/**
 * Get memory search tool in OpenAI format
 */
export function getMemorySearchToolOpenAI(): typeof MEMORY_SEARCH_OPENAI_TOOL {
    return MEMORY_SEARCH_OPENAI_TOOL;
}

// ============================================================================
// Claude/Anthropic Tool Format
// ============================================================================

/**
 * Memory search function in Claude's tool format
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
 */
export const MEMORY_SEARCH_CLAUDE_TOOL = {
    name: MEMORY_SEARCH_FUNCTION.name,
    description: MEMORY_SEARCH_FUNCTION.description,
    input_schema: {
        type: 'object' as const,
        properties: {
            query: {
                type: 'string',
                description: MEMORY_SEARCH_FUNCTION.parameters.properties.query.description,
            },
            limit: {
                type: 'number',
                description: MEMORY_SEARCH_FUNCTION.parameters.properties.limit.description,
            },
        },
        required: ['query'],
    },
};

/**
 * Get memory search tool in Claude format
 */
export function getMemorySearchToolClaude(): typeof MEMORY_SEARCH_CLAUDE_TOOL {
    return MEMORY_SEARCH_CLAUDE_TOOL;
}
