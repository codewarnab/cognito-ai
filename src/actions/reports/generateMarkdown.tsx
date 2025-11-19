/**
 * Generate Markdown Report Action
 * Creates and downloads a markdown (.md) file with the provided content
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/tools';
import { useToolUI } from '../../ai/tools/components';
import { createLogger } from '@logger';

const log = createLogger('Tool-GenerateMarkdown');

export function useGenerateMarkdownTool() {
    const { unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering generateMarkdown tool...');

        registerTool({
            name: 'generateMarkdown',
            description: 'Generate a markdown (.md) file and display it as an interactive attachment in chat with Open/Download buttons.',
            parameters: z.object({
                content: z.string().describe('The markdown content to save in the file'),
                filename: z.string()
                    .describe('The filename for the markdown file (without extension). Example: "research-report-2024"')
                    .optional()
                    .default('report'),
            }),
            execute: async ({ content, filename = 'report' }) => {
                try {
                    log.info('TOOL CALL: generateMarkdown', {
                        filenameLength: filename.length,
                        contentLength: content.length
                    });

                    // Ensure filename doesn't have extension
                    const cleanFilename = filename.replace(/\.md$/i, '');
                    const fullFilename = `${cleanFilename}.md`;

                    // Create blob for file data (no auto-download)
                    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
                    const chatUrl = URL.createObjectURL(blob);

                    log.info('✅ Markdown file generated as attachment', { filename: fullFilename });

                    // Return file data for chat display as interactive attachment
                    return {
                        success: true,
                        filename: fullFilename,
                        message: `✅ Markdown report "${fullFilename}" is ready!`,
                        size: blob.size,
                        // File data for chat display (will be rendered as attachment)
                        // Note: Blob URL should NOT be revoked here; chat UI manages lifecycle
                        fileData: {
                            type: 'file',
                            name: fullFilename,
                            url: chatUrl,
                            mediaType: 'text/markdown',
                            size: blob.size
                        }
                    };
                } catch (error) {
                    log.error('[Tool] Error generating markdown:', error);
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    };
                }
            },
        });

        log.info('✅ generateMarkdown tool registration complete');

        return () => {
            log.info('🧹 Cleaning up generateMarkdown tool');
            unregisterToolUI('generateMarkdown');
        };
    }, []);
}

