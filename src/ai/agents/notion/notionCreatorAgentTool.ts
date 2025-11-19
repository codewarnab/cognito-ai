/**
 * Notion Creator Agent Tool for Browser Action Agent
 * 
 * This file provides the Notion Creator agent in Gemini's native function calling format
 * so it can be used by other agents (like YouTube to Notion workflow agent).
 */

import { createLogger } from '@logger';
import { executeNotionCreatorAgent } from './notionCreatorAgent';
import type { NotionCreatorInput, NotionCreatorOutput } from './types';
import type { FunctionDeclaration } from '@google/genai';

const log = createLogger('NotionCreatorAgentTool');

/**
 * Notion Creator Agent Tool Declaration for Gemini
 * This is the function declaration in Gemini's native format
 */
export const notionCreatorAgentDeclaration: FunctionDeclaration = {
    name: 'notionCreatorAgent',
    description: `Create hierarchical Notion pages with a main page and nested child pages.

This specialized agent handles all Notion page creation using MCP tools:
- Creates a main page with video URL property
- Creates nested child pages under the main page
- Handles Notion API errors gracefully with automatic retries
- Returns URLs of all created pages

Use this when you need to:
- Create structured notes in Notion from video content
- Build hierarchical page structures (main page + nested pages)
- Organize information into separate Notion pages

The agent will:
1. Create a main page with the specified title
2. Add video URL as a page property
3. Create each nested page as a child of the main page
4. Return success status with all page URLs

AUTOMATIC RETRY BEHAVIOR:
- The agent automatically retries up to 3 times on failures
- Uses exponential backoff (1s, 2s, 4s delays)
- Handles transient errors, API rate limits, and network issues
- If the agent fails, YOU SHOULD RETRY calling it again (it may succeed on retry)

IMPORTANT:
- Notion MCP server must be connected and enabled
- Each nested page should have a clear title and content
- Content will be split into paragraphs automatically
- Parent page ID is optional (defaults to workspace root)
- If this tool fails, RETRY it at least once - transient errors are common`,

    parametersJsonSchema: {
        type: 'object',
        properties: {
            mainPageTitle: {
                type: 'string',
                description: 'Title for the main Notion page. Should be descriptive and include "[Cognito AI]" suffix.'
            },
            videoUrl: {
                type: 'string',
                description: 'YouTube video URL to be added as a page property for reference.'
            },
            nestedPages: {
                type: 'array',
                description: 'Array of nested pages to create under the main page. Each page should have a title and content.',
                items: {
                    type: 'object',
                    properties: {
                        title: {
                            type: 'string',
                            description: 'Title of the nested page (e.g., a question or topic name)'
                        },
                        content: {
                            type: 'string',
                            description: 'Content/body of the nested page. Can be multiple paragraphs separated by double newlines.'
                        }
                    },
                    required: ['title', 'content']
                }
            },
            parentPageId: {
                type: 'string',
                description: 'Optional parent page ID to nest the main page under. If not provided, page is created in workspace root.',
                nullable: true
            }
        },
        required: ['mainPageTitle', 'videoUrl', 'nestedPages']
    }
};

/**
 * Notion Creator Agent Executor
 * This function executes the Notion Creator agent with the given parameters
 */
export async function executeNotionCreator(args: NotionCreatorInput): Promise<NotionCreatorOutput> {
    log.info('🎨 Notion Creator Agent Tool called', {
        mainPageTitle: args.mainPageTitle,
        nestedPagesCount: args.nestedPages?.length || 0,
        hasParentPageId: !!args.parentPageId
    });

    try {
        // Validate input
        if (!args.mainPageTitle || !args.videoUrl || !args.nestedPages) {
            return {
                success: false,
                message: 'Invalid input: mainPageTitle, videoUrl, and nestedPages are required',
                error: 'INVALID_INPUT'
            };
        }

        if (!Array.isArray(args.nestedPages)) {
            return {
                success: false,
                message: 'Invalid input: nestedPages must be an array',
                error: 'INVALID_INPUT'
            };
        }

        if (args.nestedPages.length === 0) {
            return {
                success: false,
                message: 'Invalid input: at least one nested page is required',
                error: 'INVALID_INPUT'
            };
        }

        // Execute the agent
        const result = await executeNotionCreatorAgent(args);

        log.info('✅ Notion Creator Agent completed', {
            success: result.success,
            pageCount: result.pageCount,
            mainPageUrl: result.mainPageUrl
        });

        return result;

    } catch (error) {
        log.error('❌ Notion Creator Agent Tool error', error);

        return {
            success: false,
            message: 'Failed to create Notion pages',
            error: error instanceof Error ? error.message : String(error)
        };
    }
}
