import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../logger";
import { useActionHelpers } from "./useActionHelpers";
import { shouldProcess } from "./useActionDeduper";
import { ToolCard, Badge } from "../components/ui/ToolCard";

export function registerPrimitiveActions() {
  const log = createLogger("Actions-Primitives");
  const { urlsEqual, focusTab } = useActionHelpers();

  useFrontendTool({
    name: "navigateTo",
    description: "Navigate to a URL. If already on it, reload. If another tab has it, switch to it.",
    parameters: [
      { name: "url", type: "string", description: "Absolute URL", required: true }
    ],
    handler: async ({ url }) => {
      if (!shouldProcess("navigateTo", { url })) {
        return { skipped: true, reason: "duplicate" };
      }

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
        log.error('[FrontendTool] Error navigating:', error);
        return { error: "Failed to navigate" };
      }
    },
    render: ({ args, status, result }) => {
      if (status === "inProgress") {
        return <ToolCard title="Navigating" subtitle={args.url} state="loading" icon="🧭" />;
      }
      if (status === "complete" && result) {
        if (result.error) {
          return <ToolCard title="Navigation Failed" subtitle={result.error} state="error" icon="🧭" />;
        }
        const action = result.reloaded ? "reloaded" : result.switched ? "switched" : "navigated";
        return (
          <ToolCard title="Navigation Complete" subtitle={result.url} state="success" icon="🧭">
            <Badge label={action} variant="success" />
          </ToolCard>
        );
      }
      return null;
    },
  });

  useFrontendTool({
    name: "waitForPageLoad",
    description: "Wait until document.readyState is 'complete' or timeout",
    parameters: [
      { name: "timeoutMs", type: "number", description: "Timeout in milliseconds (default 10000)", required: false }
    ],
    handler: async ({ timeoutMs }) => {
      if (!shouldProcess("waitForPageLoad", { timeoutMs })) {
        return { skipped: true, reason: "duplicate" };
      }

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
        log.error('[FrontendTool] Error waiting for page load:', error);
        return { error: "Failed waiting for page load" };
      }
    },
    render: ({ args, status, result }) => {
      if (status === "inProgress") {
        const timeoutSec = ((args.timeoutMs || 10000) / 1000).toFixed(1);
        return <ToolCard title="Waiting for Page Load" subtitle={`Timeout: ${timeoutSec}s`} state="loading" icon="⏳" />;
      }
      if (status === "complete" && result) {
        if (result.error) {
          return <ToolCard title="Wait Failed" subtitle={result.error} state="error" icon="⏳" />;
        }
        if (result.timeout) {
          return <ToolCard title="Page Load Timeout" subtitle={`State: ${result.state}`} state="error" icon="⏳" />;
        }
        return <ToolCard title="Page Loaded" subtitle="Document is ready" state="success" icon="⏳" />;
      }
      return null;
    },
  });

  useFrontendTool({
    name: "waitForSelector",
    description: "Wait for an element matching selector to exist (optionally visible)",
    parameters: [
      { name: "selector", type: "string", description: "CSS selector", required: true },
      { name: "timeoutMs", type: "number", description: "Timeout in milliseconds (default 10000)", required: false },
      { name: "visibleOnly", type: "boolean", description: "If true, require element to be visible", required: false }
    ],
    handler: async ({ selector, timeoutMs, visibleOnly }) => {
      if (!shouldProcess("waitForSelector", { selector, timeoutMs, visibleOnly })) {
        return { skipped: true, reason: "duplicate" };
      }

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
        log.error('[FrontendTool] Error waiting for selector:', error);
        return { error: "Failed waiting for selector" };
      }
    },
    render: ({ args, status, result }) => {
      if (status === "inProgress") {
        const timeoutSec = ((args.timeoutMs || 10000) / 1000).toFixed(1);
        return (
          <ToolCard title="Waiting for Element" subtitle={args.selector} state="loading" icon="🎯">
            {args.visibleOnly && <Badge label="visible only" variant="default" />}
            <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>Timeout: {timeoutSec}s</div>
          </ToolCard>
        );
      }
      if (status === "complete" && result) {
        if (result.error) {
          return <ToolCard title="Wait Failed" subtitle={result.error} state="error" icon="🎯" />;
        }
        if (result.timeout) {
          return <ToolCard title="Element Not Found" subtitle={`Selector: ${args.selector}`} state="error" icon="🎯" />;
        }
        return <ToolCard title="Element Found" subtitle={args.selector} state="success" icon="🎯" />;
      }
      return null;
    },
  });
}
