/**
 * YouTube to Notion Agent Tool for Main Workflow
 * 
 * This file provides the YouTube to Notion agent in Gemini's native function calling format
 * so it can be used by the main workflow agent.
 */

import { createLogger } from '@logger';
import { executeYouTubeToNotionAgent } from './youtubeToNotionAgent';
import type { YouTubeToNotionInput, YouTubeToNotionOutput } from './types';
import type { FunctionDeclaration } from '@google/genai';

const log = createLogger('YouTubeToNotionAgentTool');

/**
 * YouTube to Notion Agent Tool Declaration for Gemini
 * This is the function declaration in Gemini's native format
 */
export const youtubeToNotionAgentDeclaration: FunctionDeclaration = {
    name: 'youtubeToNotionAgent',
    description: `Convert YouTube videos into beautifully structured Notion notes.

This specialized agent orchestrates the entire video-to-notes conversion:
- Fetches and analyzes video transcript (handles 50k+ character transcripts)
- Detects video type (tutorial, lecture, podcast, etc.)
- Generates structured notes with 4-10 nested pages
- Creates hierarchical pages in Notion
- Returns success status with page URLs

The agent automatically:
1. Gets video transcript from YouTube
2. Analyzes content and detects video type
3. Selects appropriate note template
4. Generates detailed, structured notes
5. Creates main page + nested pages in Notion
6. Returns compact success response

Video types supported:
- **Tutorial**: Step-by-step guides
- **Lecture**: Q&A format for academic content
- **Podcast**: Key insights and takeaways
- **Documentary**: Narrative structure
- **Presentation**: Conference talk format
- **Webinar**: Professional training format
- **Course**: Structured learning content
- **Review**: Product/service evaluation
- **Generic**: Flexible fallback format

Use this when users want to:
- Save YouTube video content to Notion
- Create structured notes from videos
- Build a knowledge base from educational content
- Convert tutorials into step-by-step guides

AUTOMATIC RETRY BEHAVIOR:
- This agent has built-in retry logic for transient failures
- Automatically retries failed operations with exponential backoff
- If the agent fails, YOU SHOULD RETRY calling it - it may succeed on retry
- Handles API rate limits, overloads, and network issues gracefully

IMPORTANT:
- Handles all processing internally (transcript, analysis, creation)
- Returns compact response (no large transcripts passed back)
- Requires Notion MCP server to be connected
- Creates 4-10 nested pages automatically
- Main page includes video URL reference
- If this tool fails, RETRY it at least once - complex operations can have transient issues`,

    parametersJsonSchema: {
        type: 'object',
        properties: {
            youtubeUrl: {
                type: 'string',
                description: 'YouTube video URL to convert into notes. Must be a valid youtube.com/watch URL.'
            },
            videoTitle: {
                type: 'string',
                description: 'Title of the YouTube video. Used for naming the main Notion page.'
            },
            parentPageId: {
                type: 'string',
                description: 'Optional Notion page ID to nest the notes under. If not provided, creates in workspace root.',
                nullable: true
            }
        },
        required: ['youtubeUrl', 'videoTitle']
    }
};

/**
 * YouTube to Notion Agent Executor
 * This function executes the YouTube to Notion agent with the given parameters
 */
export async function executeYouTubeToNotion(args: YouTubeToNotionInput): Promise<YouTubeToNotionOutput> {
    log.info('🎬 YouTube to Notion Agent Tool called', {
        youtubeUrl: args.youtubeUrl,
        videoTitle: args.videoTitle,
        hasParentPageId: !!args.parentPageId
    });

    try {
        // Validate input
        if (!args.youtubeUrl || !args.videoTitle) {
            return {
                success: false,
                message: 'Invalid input: youtubeUrl and videoTitle are required',
                error: 'INVALID_INPUT'
            };
        }

        // Validate YouTube URL format
        if (!args.youtubeUrl.includes('youtube.com/watch') && !args.youtubeUrl.includes('youtu.be/')) {
            return {
                success: false,
                message: 'Invalid YouTube URL. Must be a youtube.com/watch or youtu.be URL.',
                error: 'INVALID_URL'
            };
        }

        // Execute the agent
        const result = await executeYouTubeToNotionAgent(args);

        log.info('✅ YouTube to Notion Agent completed', {
            success: result.success,
            pageCount: result.pageCount,
            videoType: result.videoType,
            mainPageUrl: result.mainPageUrl
        });

        return result;

    } catch (error) {
        log.error('❌ YouTube to Notion Agent Tool error', error);

        return {
            success: false,
            message: 'Failed to convert video to Notion notes',
            error: error instanceof Error ? error.message : String(error)
        };
    }
}
