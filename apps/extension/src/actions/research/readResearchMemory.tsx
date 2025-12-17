/**
 * Read Research Memory Tool
 * Retrieves full content of a stored research source from IndexedDB
 */

import { useEffect } from 'react';
import { z } from 'zod';
import { registerTool } from '@/ai/tools';
import { readResearchMemory } from '@/db';
import { createLogger } from '~logger';

const log = createLogger('Tool-ReadResearchMemory', 'TOOLS_EXECUTION');

export function useReadResearchMemoryTool() {
    useEffect(() => {
        registerTool({
            name: 'readResearchMemory',
            description: `Read full content of a stored research source from memory.

USE: During report synthesis phase when you need specific details from a source.
REQUIRES: Valid sourceId from listResearchSources.
BEHAVIOR: Retrieves full page content from IndexedDB storage.
RETURNS: Full content + metadata.

WHEN TO USE:
- You're writing the report and need a specific quote/detail
- You need to verify information from a source
- You're extracting data for a specific section

DO NOT USE:
- During initial research phase (content already visible after readPageContent)
- To "check what you have" (use listResearchSources instead)
- To load all sources at once (load on-demand per section)

EXAMPLE: readResearchMemory({ sourceId: 'research_source_1' })`,

            parameters: z.object({
                sourceId: z.string().describe('Source ID to read (e.g., research_source_1)')
            }),

            execute: async ({ sourceId }) => {
                try {
                    const source = await readResearchMemory(sourceId);

                    if (!source) {
                        log.warn('Research source not found or expired', { sourceId });
                        return {
                            found: false,
                            sourceId,
                            message: `Source ${sourceId} not found or has expired.`
                        };
                    }

                    log.info('Retrieved research source', {
                        sourceId,
                        contentLength: source.content.length,
                        title: source.title
                    });

                    return {
                        found: true,
                        sourceId: source.sourceId,
                        url: source.url,
                        title: source.title,
                        content: source.content,
                        contentLength: source.content.length,
                        futureUseGuideline: source.futureUseGuideline,
                        savedAt: source.savedAt,
                        message: `Retrieved ${sourceId} (${source.content.length} chars). Guideline: ${source.futureUseGuideline || 'None set'}`
                    };
                } catch (err) {
                    const message = err instanceof Error ? err.message : 'Unknown error';
                    log.error('Failed to read research memory', { sourceId, error: message });
                    return {
                        found: false,
                        sourceId,
                        error: message
                    };
                }
            }
        });

        return () => {
            log.debug('Cleanup: readResearchMemory tool');
        };
    }, []);
}
