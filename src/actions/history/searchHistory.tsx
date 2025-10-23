import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/toolRegistryUtils';
import { useToolUI } from '../../ai/ToolUIContext';
import { createLogger } from '../../logger';
import { CompactToolCard } from '../../components/ui/CompactToolCard';
import type { ToolUIState } from '../../ai/ToolUIContext';

const log = createLogger('Actions-History-Search');

interface HistorySearchResult {
    id: string;
    title: string;
    url: string;
    lastVisitTime?: number;
    visitCount: number;
    typedCount: number;
}

export function useSearchHistory() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering searchHistory tool...');

        registerTool({
            name: 'searchHistory',
            description: "Search browser history by text query within a specific time range. Searches through page titles and URLs. IMPORTANT: When user asks about specific time periods (like 'this morning', 'yesterday', 'last week'), use startTime/endTime parameters to filter results to that time period only. Do NOT include lifetime visit counts when user asks about specific time periods.",
            parameters: z.object({
                query: z.string().describe('Text to search for in page titles and URLs'),
                maxResults: z.number().describe('Maximum number of results to return (default: 20)').default(20),
                startTime: z.number().optional().describe('Search from this timestamp in milliseconds since epoch.'),
                endTime: z.number().optional().describe('Search until this timestamp in milliseconds since epoch.'),
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
