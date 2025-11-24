import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '@ai/tools';
import { useToolUI } from '@ai/tools/components';
import { createLogger } from '~logger';
import { CompactToolCard } from '@components/ui/tools/cards';
import type { ToolUIState } from '@ai/tools/components';

const log = createLogger('Actions-History-Search');


export function useSearchHistory() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering searchHistory tool...');

        registerTool({
            name: 'searchHistory',
            description: `Search browser history by text query with optional time range filtering. Searches titles/URLs (not page content).
USE FOR: Finding previously visited pages by topic/keyword, analyzing browsing patterns for specific periods ("this morning", "yesterday", "last week").
IMPORTANT: When user mentions time periods, MUST use startTime/endTime parameters.
RETURNS: Results with title, URL, lastVisitTime, visitCount (lifetime), sorted by relevance/recency. Empty array if no matches.
LIMITS: Searches titles/URLs only, max results default 20.
EXAMPLE: searchHistory(query="react", maxResults=20, startTime=Date.now()-86400000, endTime=Date.now())`,
            parameters: z.object({
                query: z.string().describe('Text to search for in page titles and URLs. Examples: "react hooks", "github", "documentation". Case-insensitive. Searches both title and URL fields.'),
                maxResults: z.number().describe('Maximum number of results to return. Default: 20. Use 10-20 for quick results, 50+ for comprehensive search.').default(20),
                startTime: z.number().optional().describe('Search from this timestamp (milliseconds since epoch). Use to filter by time period. Example: Date.now() - 24*60*60*1000 for last 24 hours. Required when user asks about specific time periods like "this morning" or "yesterday".'),
                endTime: z.number().optional().describe('Search until this timestamp (milliseconds since epoch). Use with startTime to define time range. Example: Date.now() for current time. Required when user asks about specific time periods.'),
            }),
            execute: async ({ query, maxResults = 20, startTime, endTime }) => {
                try {
                    log.info('searchHistory', { query, maxResults, startTime, endTime });

                    const searchQuery: chrome.history.HistoryQuery = {
                        text: String(query || ''),
                        maxResults: Number(maxResults)
                    };

                    if (startTime) {
                        searchQuery.startTime = Number(startTime);
                    }
                    if (endTime) {
                        searchQuery.endTime = Number(endTime);
                    }

                    const results = await chrome.history.search(searchQuery);

                    const formattedResults = results.map(item => ({
                        id: item.id,
                        title: item.title || 'Untitled',
                        url: item.url || '',
                        lastVisitTime: item.lastVisitTime,
                        visitCount: item.visitCount || 0,
                        typedCount: item.typedCount || 0
                    }));

                    return {
                        success: true,
                        found: formattedResults.length,
                        results: formattedResults
                    };
                } catch (error) {
                    log.error('[Tool] Error searching history:', error);
                    return { error: 'Failed to search history', details: String(error) };
                }
            },
        });

        registerToolUI('searchHistory', (state: ToolUIState) => {
            const { state: toolState, input, output, errorText } = state;

            if (toolState === 'input-streaming' || toolState === 'input-available') {
                return (
                    <CompactToolCard
                        toolName="searchHistory"
                        state="loading"
                        input={input}
                    />
                );
            }

            if (toolState === 'output-available' && output) {
                const cardState = (output as any).error ? 'error' : 'success';
                return (
                    <CompactToolCard
                        toolName="searchHistory"
                        state={cardState}
                        input={input}
                        output={output}
                        errorText={(output as any).error}
                    />
                );
            }

            if (toolState === 'output-error') {
                return (
                    <CompactToolCard
                        toolName="searchHistory"
                        state="error"
                        input={input}
                        errorText={errorText}
                    />
                );
            }

            return null;
        });

        log.info('✅ searchHistory tool registration complete');

        return () => {
            log.info('🧹 Cleaning up searchHistory tool');
            unregisterToolUI('searchHistory');
        };
    }, []);
}


