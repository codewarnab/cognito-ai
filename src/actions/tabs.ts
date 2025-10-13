import { useCopilotAction } from "@copilotkit/react-core";
import { createLogger } from "../logger";
import { useActionHelpers } from "./useActionHelpers";

export function registerTabActions() {
  const log = createLogger("Actions-Tabs");
  const { normalizeUrl, urlsEqual, isRecentlyOpened, markOpened, focusTab } = useActionHelpers();

  useCopilotAction({
    name: "getActiveTab",
    description: "Get information about the currently active browser tab",
    parameters: [],
    handler: async () => {
      try {
        log.debug("getActiveTab invoked");
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return { title: tab.title, url: tab.url, id: tab.id };
      } catch (error) {
        log.error('[CopilotAction] Error getting active tab:', error);
        return { error: "Failed to get active tab info" };
      }
    }
  });

  useCopilotAction({
    name: "searchTabs",
    description: "Search through all open browser tabs by title or URL",
    parameters: [
      { name: "query", type: "string", description: "Search query to match against tab titles and URLs", required: true }
    ],
    handler: async ({ query }) => {
      try {
        log.debug("searchTabs", { query });
        const tabs = await chrome.tabs.query({});
        const q = String(query || '').toLowerCase();
        const matchingTabs = tabs.filter(tab => tab.title?.toLowerCase().includes(q) || tab.url?.toLowerCase().includes(q));
        return { found: matchingTabs.length, tabs: matchingTabs.map(t => ({ id: t.id, title: t.title, url: t.url })) };
      } catch (error) {
        log.error('[CopilotAction] Error searching tabs:', error);
        return { error: "Failed to search tabs" };
      }
    }
  });

  useCopilotAction({
    name: "openTab",
    description: "Open a URL. If a tab with the same URL already exists anywhere, switch to that tab instead of opening a duplicate.",
    parameters: [ { name: "url", type: "string", description: "The URL to open in a new tab", required: true } ],
    handler: async ({ url }) => {
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
        log.error('[CopilotAction] Error opening tab:', error);
        return { error: "Failed to open tab" };
      }
    }
  });
}
