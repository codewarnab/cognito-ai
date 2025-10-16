import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../logger";
import { shouldProcess } from "./useActionDeduper";
import { ToolCard, ResultList } from "../components/ui/ToolCard";

export function registerHistoryActions() {
  const log = createLogger("Actions-History");

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

  useFrontendTool({
    name: "getUrlVisits",
    description: "Get detailed visit information for a specific URL including all visit timestamps and how the user navigated to the page.",
    parameters: [
      { 
        name: "url", 
        type: "string", 
        description: "The URL to get visit details for", 
        required: true 
      }
    ],
    handler: async ({ url }) => {
      if (!shouldProcess("getUrlVisits", { url })) {
        return { skipped: true, reason: "duplicate" };
      }

      try {
        log.info("getUrlVisits", { url });

        const visits = await chrome.history.getVisits({ url: String(url) });

        const formattedVisits = visits.map(visit => ({
          visitId: visit.visitId,
          visitTime: visit.visitTime,
          referringVisitId: visit.referringVisitId,
          transition: visit.transition
        }));

        return {
          success: true,
          url,
          visitCount: formattedVisits.length,
          visits: formattedVisits
        };
      } catch (error) {
        log.error('[FrontendTool] Error getting URL visits:', error);
        return { error: "Failed to get URL visits", details: String(error) };
      }
    },
    render: ({ args, status, result }) => {
      if (status === "inProgress") {
        return <ToolCard title="Getting Visit Details" subtitle={args.url} state="loading" icon="📊" />;
      }
      if (status === "complete" && result) {
        if (result.error) {
          return <ToolCard title="Failed to Get Visits" subtitle={result.error} state="error" icon="📊" />;
        }
        return (
          <ToolCard 
            title="Visit Details" 
            subtitle={`${result.visitCount} visit(s) to this URL`} 
            state="success" 
            icon="📊"
          >
            <div style={{ 
              fontSize: '11px', 
              marginTop: '8px',
              marginBottom: '8px',
              opacity: 0.7,
              wordBreak: 'break-all'
            }}>
              {result.url}
            </div>
            {result.visits && result.visits.length > 0 && (
              <div style={{ fontSize: '12px' }}>
                {result.visits.slice(0, 10).map((visit: any, idx: number) => (
                  <div key={idx} style={{
                    padding: '6px 8px',
                    marginBottom: '4px',
                    background: 'rgba(0,0,0,0.03)',
                    borderRadius: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '11px'
                  }}>
                    <span>{new Date(visit.visitTime || 0).toLocaleString()}</span>
                    <span style={{ 
                      opacity: 0.6,
                      fontSize: '10px',
                      textTransform: 'lowercase'
                    }}>
                      {visit.transition || 'unknown'}
                    </span>
                  </div>
                ))}
                {result.visits.length > 10 && (
                  <div style={{ fontSize: '10px', opacity: 0.5, marginTop: '4px' }}>
                    Showing 10 of {result.visits.length} visits
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

