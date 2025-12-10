/**
 * List Research Sources Tool
 * Lists all stored research sources for the current session (metadata only)
 */

import { useEffect } from 'react';
import { z } from 'zod';
import { registerTool } from '@/ai/tools';
import { listResearchSources, getCurrentResearchSessionId, type ResearchSource } from '@/db';
import { createLogger } from '~logger';


const log = createLogger('Tool-ListResearchSources');

export function useListResearchSourcesTool() {
    useEffect(() => {
        registerTool({
            name: 'listResearchSources',
            description: `List all stored research sources for current session.

USE: During synthesis phase to see what sources you have available.
REQUIRES: Active research session (call initResearchSession first).
BEHAVIOR: Returns metadata for all sources (no full content to save context).
RETURNS: Array of { sourceId, url, title, futureUseGuideline, contentLength }.

WHEN TO USE:
- Before starting report writing (to know what you have)
- To decide which sources to read for specific sections
- To verify you've gathered enough sources
- To review futureUseGuideline notes for each source

NOTE: This returns metadata only. Use readResearchMemory to load full content
for specific sources when needed.

EXAMPLE: listResearchSources() → Returns list of all sources with metadata`,

            parameters: z.object({}),

            execute: async () => {
                try {
                    const sessionId = getCurrentResearchSessionId();

                    if (!sessionId) {
                        log.warn('No active research session');
                        return {
                            success: false,
                            sources: [],
                            count: 0,
                            message: 'No active research session. Call initResearchSession first.'
                        };
                    }

                    const sources = await listResearchSources(sessionId);

                    log.info('Listed research sources', {
                        sessionId,
                        count: sources.length
                    });

                    // Format sources for AI consumption
                    const formattedSources = sources.map((s: ResearchSource) => ({
                        sourceId: s.sourceId,

                        url: s.url,
                        title: s.title,
                        futureUseGuideline: s.futureUseGuideline || '(No guideline set)',
                        contentLength: s.contentLength,
                        savedAt: new Date(s.savedAt).toISOString()
                    }));

                    return {
                        success: true,
                        sessionId,
                        sources: formattedSources,
                        count: sources.length,
                        message: `Found ${sources.length} source${sources.length !== 1 ? 's' : ''} in current research session.`
                    };
                } catch (err) {
                    const message = err instanceof Error ? err.message : 'Unknown error';
                    log.error('Failed to list research sources', { error: message });
                    return {
                        success: false,
                        sources: [],
                        count: 0,
                        error: message
                    };
                }
            }
        });

        return () => {
            log.debug('Cleanup: listResearchSources tool');
        };
    }, []);
}
