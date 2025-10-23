/**
 * Generate Markdown Report Action
 * Creates and downloads a markdown (.md) file with the provided content
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/toolRegistryUtils';
import { useToolUI } from '../../ai/ToolUIContext';
import { createLogger } from '../../logger';

const log = createLogger('Tool-GenerateMarkdown');

/**
 * Download markdown content as a .md file
 */
function downloadMarkdown(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export function useGenerateMarkdownTool() {
    const {  unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering generateMarkdown tool...');

        registerTool({
            name: 'generateMarkdown',
            description: 'Generate and download a markdown (.md) file with the provided content. Use this when the user asks for a markdown report or .md file.',
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

                    // Trigger download
                    downloadMarkdown(content, fullFilename);

                    // Create a blob URL for chat display
                    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
                    const chatUrl = URL.createObjectURL(blob);

                    log.info('✅ Markdown file downloaded successfully', { filename: fullFilename });

                    // Return both success message AND file data for chat display
                    return {
                        success: true,
                        filename: fullFilename,
                        message: `✅ Markdown report "${fullFilename}" has been downloaded!`,
                        // File data for chat display (will be rendered as attachment)
                        fileData: {
                            type: 'file',
                            name: fullFilename,
                            url: chatUrl,
                            mediaType: 'text/markdown',
                            size: new Blob([content]).size
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
