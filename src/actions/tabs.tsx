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

  // ===========================
  // Smart Navigation Actions
  // ===========================

  useFrontendTool({
    name: "ensureAtUrl",
    description: "Ensure the active tab is at a specific URL. Navigates or reuses existing tab if same origin.",
    parameters: [
      { name: "url", type: "string", description: "Target URL", required: true },
      { name: "reuse", type: "boolean", description: "Reuse existing tab with same origin", required: false },
      { name: "waitFor", type: "string", description: "Wait strategy: 'load' or 'networkidle'", required: false },
      { name: "retries", type: "number", description: "Number of retries on failure", required: false }
    ],
    handler: async ({ url, reuse = true, waitFor = 'load', retries = 2 }) => {
      if (!shouldProcess("ensureAtUrl", { url })) {
        return { skipped: true, reason: "duplicate" };
      }

      try {
        log.info("ensureAtUrl", { url, reuse, waitFor, retries });

        const targetUrl = new URL(url);
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!activeTab?.id) {
          return { error: "No active tab" };
        }

        // Check if already at URL
        if (urlsEqual(activeTab.url || '', url)) {
          return {
            success: true,
            navigated: false,
            tabId: activeTab.id,
            finalUrl: activeTab.url
          };
        }

        // Check if we should reuse existing tab with same origin
        if (reuse && activeTab.url) {
          try {
            const currentUrl = new URL(activeTab.url);
            if (currentUrl.origin === targetUrl.origin) {
              // Same origin, update URL
              await chrome.tabs.update(activeTab.id, { url });

              // Wait for navigation
              await waitForNavigation(activeTab.id, waitFor as 'load' | 'networkidle');

              return {
                success: true,
                navigated: true,
                reused: true,
                tabId: activeTab.id,
                finalUrl: url
              };
            }
          } catch (e) {
            // Invalid URL, proceed with normal navigation
          }
        }

        // Check for existing tab with this URL
        const allTabs = await chrome.tabs.query({});
        const existing = allTabs.find(t => t.id !== activeTab.id && urlsEqual(t.url || '', url));

        if (existing) {
          await focusTab(existing);
          return {
            success: true,
            navigated: false,
            reused: true,
            tabId: existing.id,
            finalUrl: existing.url
          };
        }

        // Navigate active tab
        await chrome.tabs.update(activeTab.id, { url });
        await waitForNavigation(activeTab.id, waitFor as 'load' | 'networkidle');

        const updatedTab = await chrome.tabs.get(activeTab.id);

        return {
          success: true,
          navigated: true,
          tabId: activeTab.id,
          finalUrl: updatedTab.url
        };
      } catch (error) {
        log.error('[FrontendTool] Error ensuring at URL:', error);
        return { error: `Failed to ensure at URL: ${(error as Error).message}` };
      }
    },
    render: ({ args, status, result }) => {
      if (status === "inProgress") {
        return <ToolCard title="Navigating to URL" subtitle={args.url} state="loading" icon="🧭" />;
      }
      if (status === "complete" && result) {
        if (result.error) {
          return <ToolCard title="Navigation Failed" subtitle={result.error} state="error" icon="🧭" />;
        }
        const action = result.navigated ? "Navigated" : result.reused ? "Reused existing tab" : "Already at URL";
        return <ToolCard title={action} subtitle={result.finalUrl} state="success" icon="🧭" />;
      }
      return null;
    },
  });

  useFrontendTool({
    name: "goAndWait",
    description: "Navigate to URL (or pattern) and wait for page load/network idle",
    parameters: [
      { name: "url", type: "string", description: "URL to navigate to", required: true },
      { name: "waitFor", type: "string", description: "Wait strategy: 'load' or 'networkidle'", required: false },
      { name: "timeoutMs", type: "number", description: "Timeout in milliseconds", required: false }
    ],
    handler: async ({ url, waitFor = 'load', timeoutMs = 30000 }) => {
      if (!shouldProcess("goAndWait", { url })) {
        return { skipped: true, reason: "duplicate" };
      }

      try {
        log.info("goAndWait", { url, waitFor, timeoutMs });

        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!activeTab?.id) {
          return { error: "No active tab" };
        }

        // Navigate
        await chrome.tabs.update(activeTab.id, { url });

        // Wait with timeout
        const waitPromise = waitForNavigation(activeTab.id, waitFor as 'load' | 'networkidle');
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Navigation timeout')), timeoutMs)
        );

        await Promise.race([waitPromise, timeoutPromise]);

        // Get final URL
        const updatedTab = await chrome.tabs.get(activeTab.id);

        return {
          success: true,
          finalUrl: updatedTab.url,
          title: updatedTab.title
        };
      } catch (error) {
        log.error('[FrontendTool] Error in goAndWait:', error);
        return { error: `Navigation failed: ${(error as Error).message}` };
      }
    },
    render: ({ args, status, result }) => {
      if (status === "inProgress") {
        return <ToolCard title="Navigating and Waiting" subtitle={args.url} state="loading" icon="⏳" />;
      }
      if (status === "complete" && result) {
        if (result.error) {
          return <ToolCard title="Navigation Failed" subtitle={result.error} state="error" icon="⏳" />;
        }
        return (
          <ToolCard title="Navigation Complete" subtitle={result.finalUrl} state="success" icon="⏳">
            {result.title && <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>{result.title}</div>}
          </ToolCard>
        );
      }
      return null;
    },
  });
}

/**
 * Wait for navigation to complete
 */
async function waitForNavigation(
  tabId: number,
  strategy: 'load' | 'networkidle'
): Promise<void> {
  if (strategy === 'load') {
    // Wait for tab to finish loading
    return new Promise((resolve) => {
      const listener = (
        updatedTabId: number,
        changeInfo: chrome.tabs.TabChangeInfo
      ) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  } else {
    // Network idle strategy - wait for no network activity for 500ms
    // This requires debugger API
    return new Promise((resolve, reject) => {
      let idleTimeout: NodeJS.Timeout;

      const cleanup = () => {
        clearTimeout(idleTimeout);
        chrome.debugger.onEvent.removeListener(listener);
        chrome.debugger.detach({ tabId }).catch(() => { });
      };

      const listener = (
        source: chrome.debugger.Debuggee,
        method: string
      ) => {
        if (source.tabId !== tabId) return;

        if (method === 'Network.loadingFinished' || method === 'Network.loadingFailed') {
          clearTimeout(idleTimeout);
          idleTimeout = setTimeout(() => {
            cleanup();
            resolve();
          }, 500);
        }
      };

      chrome.debugger.attach({ tabId }, "1.3")
        .then(() => chrome.debugger.sendCommand({ tabId }, "Network.enable"))
        .then(() => {
          chrome.debugger.onEvent.addListener(listener);
          idleTimeout = setTimeout(() => {
            cleanup();
            resolve();
          }, 500);
        })
        .catch((error) => {
          cleanup();
          reject(error);
        });
    });
  }
}
