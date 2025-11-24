/**
 * YouTube to Notion Agent Tool Registration
 * Migrated to AI SDK v5 tool format
 * 
 * Registers the youtubeToNotionAgent tool for converting YouTube videos
 * into beautifully structured Notion notes
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '@/ai/tools';
import { useToolUI } from '@/ai/tools/components';
import { createLogger } from '~logger';
import { ChainOfThoughtToolRenderer } from '@/components/ui/tools/ChainOfThoughtToolRenderer';
import { executeYouTubeToNotion } from '@/ai/agents/youtubeToNotion/youtubeToNotionAgentTool';
import { progressStore } from '@/ai/agents/youtubeToNotion/progressStore';
import type { ToolUIState } from '@/ai/tools/components';

const log = createLogger('Tool-YouTubeToNotion');

/**
 * Hook to register the youtubeToNotionAgent tool
 */
export function useYouTubeToNotionAgent() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering youtubeToNotionAgent tool...');

        // Register the tool with AI SDK v5
        registerTool({
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
- Tutorial: Step-by-step guides
- Lecture: Q&A format for academic content
- Podcast: Key insights and takeaways
- Documentary: Narrative structure
- Presentation: Conference talk format
- Webinar: Professional training format
- Course: Structured learning content
- Review: Product/service evaluation
- Generic: Flexible fallback format

Use this when users want to:
- Save YouTube video content to Notion
- Create structured notes from videos
- Build a knowledge base from educational content
- Convert tutorials into step-by-step guides

IMPORTANT:
- Handles all processing internally (transcript, analysis, creation)
- Returns compact response (no large transcripts passed back)
- Requires Notion MCP server to be connected
- Creates 4-10 nested pages automatically
- Main page includes video URL reference`,

            parameters: z.object({
                youtubeUrl: z.string().describe('YouTube video URL to convert into notes. Must be a valid youtube.com/watch URL.'),
                videoTitle: z.string().describe('Title of the YouTube video. Used for naming the main Notion page.'),
                parentPageId: z.string().optional().describe('Optional Notion page ID to nest the notes under. If not provided, creates in workspace root.')
            }),

            execute: async ({ youtubeUrl, videoTitle, parentPageId }) => {
                try {
                    log.info('TOOL CALL: youtubeToNotionAgent', {
                        youtubeUrl,
                        videoTitle,
                        hasParentPageId: !!parentPageId
                    });

                    // Initialize progress store for this workflow
                    // Generate unique workflow ID that UI can access
                    const workflowId = `youtube-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    progressStore.startWorkflow(workflowId);

                    // Execute the YouTube to Notion agent
                    const result = await executeYouTubeToNotion({
                        youtubeUrl,
                        videoTitle,
                        parentPageId
                    });

                    if (!result.success) {
                        log.error('❌ YouTube to Notion agent failed', {
                            error: result.error,
                            message: result.message
                        });

                        return {
                            success: false,
                            error: result.error || result.message,
                            message: result.message
                        };
                    }

                    log.info('✅ YouTube to Notion agent completed successfully', {
                        pageCount: result.pageCount,
                        videoType: result.videoType,
                        mainPageUrl: result.mainPageUrl
                    });

                    return {
                        success: true,
                        mainPageUrl: result.mainPageUrl,
                        pageCount: result.pageCount,
                        videoType: result.videoType,
                        message: result.message
                    };

                } catch (error) {
                    log.error('[Tool] Error in youtubeToNotionAgent:', error);
                    return {
                        success: false,
                        error: String(error),
                        message: 'Failed to convert video to Notion notes'
                    };
                }
            },
        });

        // Register the UI renderer for this tool - uses Chain of Thought renderer
        registerToolUI('youtubeToNotionAgent', (state: ToolUIState) => {
            // UI doesn't need workflowId parameter - renderer subscribes to all updates
            return <ChainOfThoughtToolRenderer state={state} />;
        });

        log.info('✅ youtubeToNotionAgent tool registration complete');

        // Cleanup on unmount
        return () => {
            log.info('🧹 Cleaning up youtubeToNotionAgent tool');
            unregisterToolUI('youtubeToNotionAgent');
        };
    }, []); // Empty dependency array - only register once on mount
}

