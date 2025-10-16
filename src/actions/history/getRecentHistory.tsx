import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../../logger";
import { shouldProcess } from "../useActionDeduper";
import { ToolCard } from "../../components/ui/ToolCard";

const log = createLogger("Actions-History-Recent");

export function useGetRecentHistory() {
    useFrontendTool({
        name: "getRecentHistory",
        description: "Get recent browsing history within a specific time window. Perfect for queries like 'what did I browse this morning' or 'recent activity'. IMPORTANT: This tool filters by time period and shows only visits within that timeframe. Do NOT mention lifetime visit counts when user asks about specific time periods.",
        parameters: [
            {
                name: "hours",
                type: "number",
                description: "Look back this many hours (default: 24). For 'this morning' use 12 hours, for 'yesterday' use 24-48 hours, for 'today' use 12-24 hours",
                required: false
            },
            {
                name: "maxResults",
                type: "number",
                description: "Maximum number of results to return (default: 50)",
                required: false
            }
        ],
        handler: async ({ hours = 24, maxResults = 50 }) => {
            if (!shouldProcess("getRecentHistory", { hours })) {
                return { skipped: true, reason: "duplicate" };
            }

            try {
                log.info("getRecentHistory", { hours, maxResults });

                const now = Date.now();
                const startTime = now - (Number(hours) * 60 * 60 * 1000);

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
                log.error('[FrontendTool] Error getting recent history:', error);
                return { error: "Failed to get recent history", details: String(error) };
            }
        },
        render: ({ args, status, result }) => {
            if (status === "inProgress") {
                return <ToolCard
                    title="Getting Recent History"
                    subtitle={`Last ${args.hours || 24} hours`}
                    state="loading"
                    icon="⏰"
                />;
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return <ToolCard title="Failed to Get History" subtitle={result.error} state="error" icon="⏰" />;
                }
                return (
                    <ToolCard
                        title="Recent History"
                        subtitle={`${result.found} page(s) in last ${result.hours}h`}
                        state="success"
                        icon="⏰"
                    >
                        {result.results && result.results.length > 0 && (
                            <div style={{ marginTop: '8px' }}>
                                {result.results.slice(0, 15).map((item: any, idx: number) => (
                                    <div key={idx} style={{
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
                                {result.results.length > 15 && (
                                    <div style={{ fontSize: '10px', opacity: 0.5, marginTop: '4px' }}>
                                        Showing 15 of {result.results.length} results
                                    </div>
                                )}
                            </div>
                        )}
                    </ToolCard>
                );
            }
            return null;
        },
    });
}
