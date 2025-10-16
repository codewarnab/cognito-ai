import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../../logger";
import { shouldProcess } from "../useActionDeduper";
import { ToolCard } from "../../components/ui/ToolCard";

const log = createLogger("Actions-History-Search");

export function useSearchHistory() {
    useFrontendTool({
        name: "searchHistory",
        description: "Search browser history by text query within a specific time range. Searches through page titles and URLs. IMPORTANT: When user asks about specific time periods (like 'this morning', 'yesterday', 'last week'), use startTime/endTime parameters to filter results to that time period only. Do NOT include lifetime visit counts when user asks about specific time periods.",
        parameters: [
            {
                name: "query",
                type: "string",
                description: "Text to search for in page titles and URLs",
                required: true
            },
            {
                name: "maxResults",
                type: "number",
                description: "Maximum number of results to return (default: 20)",
                required: false
            },
            {
                name: "startTime",
                type: "number",
                description: "Search from this timestamp in milliseconds since epoch. REQUIRED for time-based queries like 'this morning', 'yesterday', 'last week'. Calculate: this morning = today 6AM, yesterday = 24h ago, last week = 7 days ago",
                required: false
            },
            {
                name: "endTime",
                type: "number",
                description: "Search until this timestamp in milliseconds since epoch. REQUIRED for time-based queries. Calculate: this morning = now, yesterday = 24h ago, last week = now",
                required: false
            }
        ],
        handler: async ({ query, maxResults = 20, startTime, endTime }) => {
            if (!shouldProcess("searchHistory", { query, startTime, endTime })) {
                return { skipped: true, reason: "duplicate" };
            }

            try {
                log.info("searchHistory", { query, maxResults, startTime, endTime });

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
                log.error('[FrontendTool] Error searching history:', error);
                return { error: "Failed to search history", details: String(error) };
            }
        },
        render: ({ args, status, result }) => {
            if (status === "inProgress") {
                return <ToolCard title="Searching History" subtitle={`Query: "${args.query}"`} state="loading" icon="🔍" />;
            }
            if (status === "complete" && result) {
                if (result.error) {
                    return <ToolCard title="History Search Failed" subtitle={result.error} state="error" icon="🔍" />;
                }
                return (
                    <ToolCard
                        title="History Search Results"
                        subtitle={`Found ${result.found} page(s)`}
                        state="success"
                        icon="🔍"
                    >
                        {result.results && result.results.length > 0 && (
                            <div style={{ marginTop: '8px' }}>
                                {result.results.map((item: any, idx: number) => (
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
                                        <div style={{
                                            fontSize: '10px',
                                            opacity: 0.6,
                                            display: 'flex',
                                            gap: '12px'
                                        }}>
                                            {item.lastVisitTime && (
                                                <span>Last visit: {new Date(item.lastVisitTime).toLocaleString()}</span>
                                            )}
                                            <span>Visits: {item.visitCount}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ToolCard>
                );
            }
            return null;
        },
    });
}
