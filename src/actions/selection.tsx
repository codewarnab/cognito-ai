import React from "react";
import { useFrontendTool } from "@copilotkit/react-core";
import { createLogger } from "../logger";
import { shouldProcess } from "./useActionDeduper";
import { ToolCard, CodeBlock } from "../components/ui/ToolCard";

export function registerSelectionActions() {
  const log = createLogger("Actions-Selection");

  useFrontendTool({
    name: "getSelectedText",
    description: "Get the currently selected text from the active browser tab",
    parameters: [],
    handler: async () => {
      if (!shouldProcess("getSelectedText", {})) {
        return { skipped: true, reason: "duplicate" };
      }

      try {
        log.debug("getSelectedText");
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab.id) return { error: "No active tab" };
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => window.getSelection()?.toString() || ""
        });
        const selectedText = results[0]?.result || "";
        return { success: true, selectedText, length: selectedText.length };
      } catch (error) {
        log.error('[FrontendTool] Error getting selected text:', error);
        return { error: "Failed to get selected text. Make sure you have permission." };
      }
    },
    render: ({ status, result }) => {
      if (status === "inProgress") {
        return <ToolCard title="Getting Selected Text" state="loading" icon="✏️" />;
      }
      if (status === "complete" && result) {
        if (result.error) {
          return <ToolCard title="Failed to Get Selection" subtitle={result.error} state="error" icon="✏️" />;
        }
        const preview = result.selectedText ? result.selectedText.substring(0, 100) : "No text selected";
        return (
          <ToolCard title="Selected Text" subtitle={`${result.length} characters`} state="success" icon="✏️">
            {result.selectedText && (
              <CodeBlock code={result.selectedText.length > 200 ? result.selectedText.substring(0, 200) + '...' : result.selectedText} />
            )}
          </ToolCard>
        );
      }
      return null;
    },
  });

  useFrontendTool({
    name: "readPageContent",
    description: "Read text content from active tab; extracts main text content.",
    parameters: [
      { name: "limit", type: "number", description: "Maximum characters to extract (optional)", required: false }
    ],
    handler: async ({ limit }) => {
      if (!shouldProcess("readPageContent", { limit })) {
        return { skipped: true, reason: "duplicate" };
      }

      try {
        log.debug("readPageContent");
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab.id) return { error: "No active tab" };
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const body = document.body;
            const title = document.title;
            const clonedBody = body.cloneNode(true) as HTMLElement;
            clonedBody.querySelectorAll('script, style, noscript').forEach(el => el.remove());
            const textContent = clonedBody.innerText || clonedBody.textContent || "";
            return { title, content: textContent.trim(), url: window.location.href };
          }
        });
        const pageData = results[0]?.result;
        if (!pageData) return { error: "Failed to extract page content" };
        return { success: true, title: pageData.title, url: pageData.url, content: pageData.content, contentLength: pageData.content.length };
      } catch (error) {
        log.error('[FrontendTool] Error reading page content:', error);
        return { error: "Failed to read page content. Make sure you have permission to access this page." };
      }
    },
    render: ({ status, result }) => {
      if (status === "inProgress") {
        return <ToolCard title="Reading Page Content" state="loading" icon="📄" />;
      }
      if (status === "complete" && result) {
        if (result.error) {
          return <ToolCard title="Failed to Read Page" subtitle={result.error} state="error" icon="📄" />;
        }
        return (
          <ToolCard title="Page Content" subtitle={`${result.contentLength} characters from ${result.title}`} state="success" icon="📄">
            <details className="tool-details">
              <summary>View excerpt</summary>
              <CodeBlock code={result.content.substring(0, 300) + (result.content.length > 300 ? '...' : '')} />
            </details>
          </ToolCard>
        );
      }
      return null;
    },
  });
}
