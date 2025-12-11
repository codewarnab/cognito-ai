/**
 * Add Memory Metadata Tool
 * Adds future-use guideline to a stored research source
 */

import { useEffect } from 'react';
import { z } from 'zod';
import { registerTool } from '@/ai/tools';
import { addResearchMetadata } from '@/db';
import { createLogger } from '~logger';

const log = createLogger('Tool-AddMemoryMetadata');

export function useAddMemoryMetadataTool() {
    useEffect(() => {
        registerTool({
            name: 'addMemoryMetadata',
            description: `Add future-use guideline to a stored research source.

USE: IMMEDIATELY after readPageContent in research workflow.
REQUIRES: Valid sourceId from previous readPageContent call.
BEHAVIOR: Stores metadata about when/how to use this source during synthesis.
RETURNS: Confirmation message.

CRITICAL: This is NOT for storing the full content (already auto-saved by readPageContent).
This is ONLY for your note on when to read this source during report generation.

The futureUseGuideline should be specific about:
- Which section/topic needs this source
- What specific information to extract
- Why this source is relevant

EXAMPLE: addMemoryMetadata({ 
  sourceId: 'research_source_1', 
  futureUseGuideline: 'Read this when writing Section 2 (Pricing). Contains detailed pricing table and competitor comparison.' 
})`,

            parameters: z.object({
                sourceId: z.string().describe('Source ID from readPageContent (e.g., research_source_1)'),
                futureUseGuideline: z.string().describe('Short note on when to read this during report generation. Be specific about which section/topic needs this source.')
            }),

            execute: async ({ sourceId, futureUseGuideline }) => {
                try {
                    await addResearchMetadata({ sourceId, futureUseGuideline });

                    log.info('Metadata added to research source', { sourceId, guidelineLength: futureUseGuideline.length });

                    return {
                        success: true,
                        sourceId,
                        message: `Metadata saved for ${sourceId}. Guideline: "${futureUseGuideline.slice(0, 100)}${futureUseGuideline.length > 100 ? '...' : ''}"`
                    };
                } catch (err) {
                    const message = err instanceof Error ? err.message : 'Unknown error';
                    log.error('Failed to add metadata', { sourceId, error: message });
                    return {
                        success: false,
                        sourceId,
                        error: message
                    };
                }
            }
        });

        return () => {
            log.debug('Cleanup: addMemoryMetadata tool');
        };
    }, []);
}
