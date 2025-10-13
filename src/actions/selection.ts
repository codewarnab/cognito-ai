import { useCopilotAction } from "@copilotkit/react-core";
import { createLogger } from "../logger";

export function registerSelectionActions() {
  const log = createLogger("Actions-Selection");

  useCopilotAction({
    name: "getSelectedText",
    description: "Get the currently selected text from the active browser tab",
    parameters: [],
    handler: async () => {
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
        log.error('[CopilotAction] Error getting selected text:', error);
        return { error: "Failed to get selected text. Make sure you have permission." };
      }
    }
  });

  useCopilotAction({
    name: "readPageContent",
    description: "Read text content from active tab; extracts main text content.",
    parameters: [],
    handler: async () => {
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
        log.error('[CopilotAction] Error reading page content:', error);
        return { error: "Failed to read page content. Make sure you have permission to access this page." };
      }
    }
  });
}
