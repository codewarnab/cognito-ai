import { z } from 'zod';

/**
 * Zod schema for web search tool parameters.
 * Used by the AI to understand how to call the search tool.
 */
export const searchSchema = z.object({
    query: z
        .string()
        .min(1)
        .describe('The search query to look up on the web'),
    max_results: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .default(10)
        .describe('Maximum number of results to return (1-20, default: 10)'),
    search_depth: z
        .enum(['basic', 'advanced'])
        .optional()
        .describe(
            'Search depth: "basic" for quick results, "advanced" for more thorough search (uses user setting if not specified)'
        ),
    include_domains: z
        .array(z.string())
        .optional()
        .default([])
        .describe(
            'Optional list of domains to include in search (e.g., ["reddit.com", "stackoverflow.com"])'
        ),
    exclude_domains: z
        .array(z.string())
        .optional()
        .default([])
        .describe(
            'Optional list of domains to exclude from search (e.g., ["pinterest.com"])'
        ),
});

/** Type inferred from the search schema */
export type SearchParams = z.infer<typeof searchSchema>;

/**
 * Zod schema for URL content retrieval tool parameters.
 */
export const retrieveSchema = z.object({
    url: z
        .string()
        .url()
        .describe('The URL to retrieve and extract content from'),
});

/** Type inferred from the retrieve schema */
export type RetrieveParams = z.infer<typeof retrieveSchema>;
