import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../logger";
import { useActionHelpers } from "./useActionHelpers";
import { shouldProcess } from "./useActionDeduper";
import { ToolCard, ResultList } from "../components/ui/ToolCard";

export function registerTabActions() {
  const log = createLogger("Actions-Tabs");
  const { normalizeUrl, urlsEqual, isRecentlyOpened, markOpened, focusTab } = useActionHelpers();

  useFrontendTool({
    name: "getActiveTab",
    description: "Get information about the currently active browser tab",
    parameters: [],
    handler: async () => {
      if (!shouldProcess("getActiveTab", {})) {
        return { skipped: true, reason: "duplicate" };
      }

      try {
        log.debug("getActiveTab invoked");
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return { title: tab.title, url: tab.url, id: tab.id };
      } catch (error) {
        log.error('[FrontendTool] Error getting active tab:', error);
        return { error: "Failed to get active tab info" };
      }
    },
    render: ({ status, result }) => {
      if (status === "inProgress") {
        return <ToolCard title="Getting Active Tab" state="loading" icon="🔍" />;
      }
      if (status === "complete" && result) {
        if (result.error) {
          return <ToolCard title="Failed to Get Tab" subtitle={result.error} state="error" icon="🔍" />;
        }
        return (
          <ToolCard title="Active Tab" state="success" icon="🔍">
            <div style={{ fontSize: '13px' }}>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>{result.title || 'Untitled'}</div>
              <div style={{ opacity: 0.7, wordBreak: 'break-all', fontSize: '12px' }}>{result.url}</div>
            </div>
          </ToolCard>
        );
      }
      return null;
    },
  });

  useFrontendTool({
    name: "searchTabs",
    description: "Search through all open browser tabs by title or URL",
    parameters: [
      { name: "query", type: "string", description: "Search query to match against tab titles and URLs", required: true }
    ],
    handler: async ({ query }) => {
      if (!shouldProcess("searchTabs", { query })) {
        return { skipped: true, reason: "duplicate" };
      }

      try {
        log.debug("searchTabs", { query });
        const tabs = await chrome.tabs.query({});
        const q = String(query || '').toLowerCase();
        const matchingTabs = tabs.filter(tab => tab.title?.toLowerCase().includes(q) || tab.url?.toLowerCase().includes(q));
        return { found: matchingTabs.length, tabs: matchingTabs.map(t => ({ id: t.id, title: t.title, url: t.url })) };
      } catch (error) {
        log.error('[FrontendTool] Error searching tabs:', error);
        return { error: "Failed to search tabs" };
      }
    },
    render: ({ args, status, result }) => {
      if (status === "inProgress") {
        return <ToolCard title="Searching Tabs" subtitle={`Query: "${args.query}"`} state="loading" icon="🔎" />;
      }
      if (status === "complete" && result) {
        if (result.error) {
          return <ToolCard title="Search Failed" subtitle={result.error} state="error" icon="🔎" />;
        }
        return (
          <ToolCard title="Tab Search Results" subtitle={`Found ${result.found} tab(s)`} state="success" icon="🔎">
            {result.tabs && result.tabs.length > 0 && (
              <ResultList items={result.tabs} />
            )}
          </ToolCard>
        );
      }
      return null;
    },
  });

  useFrontendTool({
    name: "openTab",
    description: "Open a URL. If a tab with the same URL already exists anywhere, switch to that tab instead of opening a duplicate.",
    parameters: [
      { name: "url", type: "string", description: "The URL to open in a new tab", required: true }
    ],
    handler: async ({ url }) => {
      if (!shouldProcess("openTab", { url })) {
        return { skipped: true, reason: "duplicate" };
      }

      try {
        log.info("openTab", { url });
        const key = normalizeUrl(url);
        if (isRecentlyOpened(key)) {
          const recentTabs = await chrome.tabs.query({});
          const recentExisting = recentTabs.find(t => urlsEqual(t.url || '', url));
          if (recentExisting) {
            await focusTab(recentExisting);
            return { success: true, reused: true, tabId: recentExisting.id, url: recentExisting.url };
          }
        }
        const allTabs = await chrome.tabs.query({});
        const existing = allTabs.find(t => urlsEqual(t.url || '', url));
        if (existing) {
          await focusTab(existing);
          return { success: true, reused: true, tabId: existing.id, url: existing.url };
        }
        const tab = await chrome.tabs.create({ url });
        markOpened(key);
        return { success: true, reused: false, tabId: tab.id, url: tab.url };
      } catch (error) {
        log.error('[FrontendTool] Error opening tab:', error);
        return { error: "Failed to open tab" };
      }
    },
    render: ({ args, status, result }) => {
      if (status === "inProgress") {
        return <ToolCard title="Opening Tab" subtitle={args.url} state="loading" icon="🌐" />;
      }
      if (status === "complete" && result) {
        if (result.error) {
          return <ToolCard title="Failed to Open Tab" subtitle={result.error} state="error" icon="🌐" />;
        }
        const action = result.reused ? "Switched to existing tab" : "Opened new tab";
        return (
          <ToolCard title={action} subtitle={result.url} state="success" icon="🌐" />
        );
      }
      return null;
    },
  });
}
