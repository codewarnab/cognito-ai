import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/toolRegistryUtils';
import { useToolUI } from '../../ai/ToolUIContext';
import { createLogger } from '../../logger';
import { ToolCard } from '../../components/ui/ToolCard';
import type { ToolUIState } from '../../ai/ToolUIContext';

const log = createLogger('Actions-History-Recent');

export function useGetRecentHistory() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering getRecentHistory tool...');

        registerTool({
            name: 'getRecentHistory',
            description: "Get recent browsing history within a specific time window. Perfect for queries like 'what did I browse this morning' or 'recent activity'. IMPORTANT: This tool filters by time period and shows only visits within that timeframe. Do NOT mention lifetime visit counts when user asks about specific time periods.",
            parameters: z.object({
                hours: z.number().describe('Look back this many hours (default: 24). For "this morning" use 12 hours, for "yesterday" use 24-48 hours, for "today" use 12-24 hours').default(24),
                maxResults: z.number().describe('Maximum number of results to return (default: 50)').default(50),
            }),
            execute: async ({ hours = 24, maxResults = 50 }) => {
                try {
                    log.info('getRecentHistory', { hours, maxResults });

                    const now = Date.now();
                    const startTime = now - (Number(hours) * 60 * 60 * 1000);

                    // Feature-detect Chrome History API to avoid runtime exceptions in unsupported contexts
                    const hasHistorySearch = typeof window !== 'undefined'
                        && (window as any).chrome
                        && chrome.history
                        && typeof chrome.history.search === 'function';

                    if (!hasHistorySearch) {
                        log.warn('chrome.history.search API unavailable');
                        return { error: 'Chrome history API is unavailable', details: 'window.chrome.history.search not available in this context' };
                    }

                    const results = await chrome.history.search({
                        text: '',
                        startTime,
                        maxResults: Number(maxResults)
                    });

                    const formattedResults = results.map(item => ({
                        id: item.id,
                        title: item.title || 'Untitled',
                        url: item.url || '',
                        lastVisitTime: item.lastVisitTime,
                        visitCount: item.visitCount || 0
                    }));

                    // Sort by last visit time (most recent first)
                    formattedResults.sort((a, b) => (b.lastVisitTime || 0) - (a.lastVisitTime || 0));

                    return {
                        success: true,
                        found: formattedResults.length,
                        hours,
                        results: formattedResults
                    };
                } catch (error) {
                    log.error('[Tool] Error getting recent history:', error);
                    return { error: 'Failed to get recent history', details: String(error) };
                }
            },
        });

        registerToolUI('getRecentHistory', (state: ToolUIState) => {
            const { state: toolState, input, output } = state;

            if (toolState === 'input-streaming' || toolState === 'input-available') {
                return (
                    <ToolCard
                        title="Getting Recent History"
                        subtitle={`Last ${input?.hours || 24} hours`}
                        state="loading"
                        icon="⏰"
                    />
                );
            }

            if (toolState === 'output-available' && output) {
                if ((output as any).error) {
                    return <ToolCard title="Failed to Get History" subtitle={(output as any).error} state="error" icon="⏰" />;
                }

                const res: any = output;
                return (
                    <ToolCard
                        title="Recent History"
                        subtitle={`${res.found} page(s) in last ${res.hours}h`}
                        state="success"
                        icon="⏰"
                    >
                        {res.results && res.results.length > 0 && (
                            <div style={{ marginTop: '8px' }}>
                                {res.results.slice(0, 15).map((item: any) => (
                                    <div key={item.id} style={{
                                        padding: '8px',
                                        marginBottom: '6px',
                                        background: 'rgba(0,0,0,0.03)',
                                        borderRadius: '4px',
                                        fontSize: '12px'
                                    }}>
                                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>{item.title}</div>
                                        <div style={{
                                            opacity: 0.7,
                                            wordBreak: 'break-all',
                                            fontSize: '11px',
                                            marginBottom: '4px'
                                        }}>
                                            {item.url}
                                        </div>
                                        <div style={{ fontSize: '10px', opacity: 0.6 }}>
                                            {item.lastVisitTime && new Date(item.lastVisitTime).toLocaleString()}
                                        </div>
                                    </div>
                                ))}
                                {res.results.length > 15 && (
                                    <div style={{ fontSize: '10px', opacity: 0.5, marginTop: '4px' }}>
                                        Showing 15 of {res.results.length} results
                                    </div>
                                )}
                            </div>
                        )}
                    </ToolCard>
                );
            }

            if (toolState === 'output-error') {
                return (
                    <ToolCard
                        title="Failed to Get History"
                        subtitle={state.errorText}
                        state="error"
                        icon="⏰"
                    />
                );
            }

            return null;
        });

        log.info('✅ getRecentHistory tool registration complete');

        return () => {
            log.info('🧹 Cleaning up getRecentHistory tool');
            unregisterToolUI('getRecentHistory');
        };
    }, []);
}
