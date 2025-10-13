import { useCopilotAction } from "@copilotkit/react-core";
import { createLogger } from "../logger";
import { useActionHelpers } from "./useActionHelpers";

export function registerPrimitiveActions() {
  const log = createLogger("Actions-Primitives");
  const { urlsEqual, focusTab } = useActionHelpers();

  useCopilotAction({
    name: "navigateTo",
    description: "Navigate to a URL. If already on it, reload. If another tab has it, switch to it.",
    parameters: [ { name: "url", type: "string", description: "Absolute URL", required: true } ],
    handler: async ({ url }) => {
      try {
        log.info("navigateTo", { url });
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab?.id) return { error: "No active tab" };
        if (urlsEqual(activeTab.url || '', url)) {
          await chrome.tabs.reload(activeTab.id);
          return { success: true, reloaded: true, tabId: activeTab.id, url: activeTab.url };
        }
        const allTabs = await chrome.tabs.query({});
        const existing = allTabs.find(t => t.id !== activeTab.id && urlsEqual(t.url || '', url));
        if (existing) {
          await focusTab(existing);
          return { success: true, switched: true, tabId: existing.id, url: existing.url };
        }
        await chrome.tabs.update(activeTab.id, { url });
        return { success: true, navigated: true, tabId: activeTab.id, url };
      } catch (error) {
        log.error('[CopilotAction] Error navigating:', error);
        return { error: "Failed to navigate" };
      }
    }
  });

  useCopilotAction({
    name: "waitForPageLoad",
    description: "Wait until document.readyState is 'complete' or timeout",
    parameters: [ { name: "timeoutMs", type: "number", description: "Timeout (default 10000)", required: false } ],
    handler: async ({ timeoutMs }) => {
      const timeout = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : 10000;
      try {
        log.debug("waitForPageLoad", { timeout });
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return { error: "No active tab" };
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          args: [timeout],
          func: async (to: number) => {
            if (document.readyState === 'complete') {
              return { success: true, state: document.readyState };
            }
            return await new Promise((resolve) => {
              const timer = setTimeout(() => { resolve({ success: false, timeout: true, state: document.readyState }); }, to);
              const onLoad = () => { clearTimeout(timer); resolve({ success: true, state: 'complete' }); };
              window.addEventListener('load', onLoad, { once: true });
            });
          }
        });
        return results[0]?.result || { error: "No result" };
      } catch (error) {
        log.error('[CopilotAction] Error waiting for page load:', error);
        return { error: "Failed waiting for page load" };
      }
    }
  });

  useCopilotAction({
    name: "waitForSelector",
    description: "Wait for an element matching selector to exist (optionally visible)",
    parameters: [
      { name: "selector", type: "string", description: "CSS selector", required: true },
      { name: "timeoutMs", type: "number", description: "Timeout (default 10000)", required: false },
      { name: "visibleOnly", type: "boolean", description: "If true, require visibility", required: false }
    ],
    handler: async ({ selector, timeoutMs, visibleOnly }) => {
      const timeout = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : 10000;
      const requireVisible = Boolean(visibleOnly);
      try {
        log.debug("waitForSelector", { selector, timeout, requireVisible });
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return { error: "No active tab" };
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          args: [selector, timeout, requireVisible],
          func: async (sel: string, to: number, visOnly: boolean) => {
            const isVisible = (el: Element) => {
              const rect = (el as HTMLElement).getBoundingClientRect();
              const style = window.getComputedStyle(el as HTMLElement);
              return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
            };
            const found = document.querySelector(sel);
            if (found && (!visOnly || isVisible(found))) {
              return { success: true };
            }
            return await new Promise((resolve) => {
              const timer = setTimeout(() => { observer.disconnect(); resolve({ success: false, timeout: true }); }, to);
              const observer = new MutationObserver(() => {
                const el = document.querySelector(sel);
                if (el && (!visOnly || isVisible(el))) {
                  clearTimeout(timer);
                  observer.disconnect();
                  resolve({ success: true });
                }
              });
              observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
            });
          }
        });
        return results[0]?.result || { error: "No result" };
      } catch (error) {
        log.error('[CopilotAction] Error waiting for selector:', error);
        return { error: "Failed waiting for selector" };
      }
    }
  });
}
