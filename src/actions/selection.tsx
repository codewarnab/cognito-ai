import React, { useEffect } from "react";
import { z } from "zod";
import { registerTool } from "../ai/toolRegistryUtils";
import { useToolUI } from "../ai/ToolUIContext";
import { createLogger } from "../logger";
import { ToolCard, CodeBlock } from "../components/ui/ToolCard";
import type { ToolUIState } from "../ai/ToolUIContext";

// ===========================
// Query Utilities
// ===========================

/**
 * Query element by text content (case-insensitive)
 */
export function queryByText(text: string, container: Document | Element = document): Element | null {
  const normalizedText = text.toLowerCase().trim();
  const walker = 'createTreeWalker' in container
    ? (container as Document).createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    )
    : document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );

  let node: Node | null;
  while ((node = walker.nextNode())) {
    const textContent = node.textContent?.toLowerCase().trim() || '';
    if (textContent.includes(normalizedText)) {
      return node.parentElement;
    }
  }

  return null;
}

/**
 * Query element by ARIA role and optional accessible name
 */
export function queryByRole(
  role: string,
  options: { name?: string } = {}
): Element | null {
  const elements = document.querySelectorAll(`[role="${role}"]`);

  for (const el of Array.from(elements)) {
    if (!options.name) {
      return el;
    }

    // Check aria-label
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel?.toLowerCase().includes(options.name.toLowerCase())) {
      return el;
    }

    // Check aria-labelledby
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl?.textContent?.toLowerCase().includes(options.name.toLowerCase())) {
        return el;
      }
    }

    // Check text content
    if (el.textContent?.toLowerCase().includes(options.name.toLowerCase())) {
      return el;
    }
  }

  // Fallback: check implicit roles
  const implicitSelectors: Record<string, string> = {
    button: 'button, input[type="button"], input[type="submit"]',
    link: 'a[href]',
    textbox: 'input[type="text"], input:not([type]), textarea',
    checkbox: 'input[type="checkbox"]',
    radio: 'input[type="radio"]',
    heading: 'h1, h2, h3, h4, h5, h6',
  };

  const selector = implicitSelectors[role.toLowerCase()];
  if (selector) {
    const implicitElements = document.querySelectorAll(selector);
    for (const el of Array.from(implicitElements)) {
      if (!options.name) {
        return el;
      }
      if (el.textContent?.toLowerCase().includes(options.name.toLowerCase())) {
        return el;
      }
    }
  }

  return null;
}

export function registerSelectionActions() {
  const log = createLogger("Actions-Selection");
  const { registerToolUI, unregisterToolUI } = useToolUI();

  useEffect(() => {
    log.info('🔧 Registering getSelectedText tool...');

    // Register getSelectedText tool
    registerTool({
      name: "getSelectedText",
      description: "Get the currently selected text from the active browser tab",
      parameters: z.object({}),
      execute: async () => {
        try {
          log.info("TOOL CALL: getSelectedText");
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab.id) return { error: "No active tab" };

          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => window.getSelection()?.toString() || ""
          });

          const selectedText = results[0]?.result || "";
          return {
            success: true,
            selectedText,
            length: selectedText.length
          };
        } catch (error) {
          log.error('[Tool] Error getting selected text:', error);
          return { error: "Failed to get selected text. Make sure you have permission." };
        }
      },
    });

    registerToolUI('getSelectedText', (state: ToolUIState) => {
      const { state: toolState, output } = state;

      if (toolState === 'input-streaming' || toolState === 'input-available') {
        return <ToolCard title="Getting Selected Text" state="loading" icon="✏️" />;
      }

      if (toolState === 'output-available' && output) {
        if (output.error) {
          return <ToolCard title="Failed to Get Selection" subtitle={output.error} state="error" icon="✏️" />;
        }
        return (
          <ToolCard title="Selected Text" subtitle={`${output.length} characters`} state="success" icon="✏️">
            {output.selectedText && (
              <CodeBlock code={output.selectedText.length > 200 ? output.selectedText.substring(0, 200) + '...' : output.selectedText} />
            )}
          </ToolCard>
        );
      }

      if (toolState === 'output-error') {
        return <ToolCard title="Selection Error" subtitle={state.errorText || 'Unknown error'} state="error" icon="✏️" />;
      }

      return null;
    });

    log.info('✅ getSelectedText tool registration complete');

    return () => {
      log.info('🧹 Cleaning up getSelectedText tool');
      unregisterToolUI('getSelectedText');
    };
  }, [registerToolUI, unregisterToolUI]);

  useEffect(() => {
    log.info('🔧 Registering readPageContent tool...');

    // Register readPageContent tool
    registerTool({
      name: "readPageContent",
      description: "Read text content from active tab; extracts main text content.",
      parameters: z.object({
        limit: z.number().optional().describe("Maximum characters to extract (optional)"),
      }),
      execute: async ({ limit }) => {
        try {
          log.info("TOOL CALL: readPageContent", { limit });
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

          // Normalize and validate the limit parameter
          const numericLimit = Number(limit);
          const normalizedLimit = Number.isFinite(numericLimit) ? Math.max(0, Math.floor(numericLimit)) : undefined;

          // Apply truncation when limit is a positive number; otherwise keep original content
          const truncatedContent = normalizedLimit && normalizedLimit > 0
            ? pageData.content.slice(0, normalizedLimit)
            : pageData.content;

          return {
            success: true,
            title: pageData.title,
            url: pageData.url,
            content: truncatedContent,
            contentLength: truncatedContent.length
          };
        } catch (error) {
          log.error('[Tool] Error reading page content:', error);
          return { error: "Failed to read page content. Make sure you have permission to access this page." };
        }
      },
    });

    registerToolUI('readPageContent', (state: ToolUIState) => {
      const { state: toolState, output } = state;

      if (toolState === 'input-streaming' || toolState === 'input-available') {
        return <ToolCard title="Reading Page Content" state="loading" icon="📄" />;
      }

      if (toolState === 'output-available' && output) {
        if (output.error) {
          return <ToolCard title="Failed to Read Page" subtitle={output.error} state="error" icon="📄" />;
        }
        return (
          <ToolCard title="Page Content" subtitle={`${output.contentLength} characters from ${output.title}`} state="success" icon="📄">
            <details className="tool-details">
              <summary>View excerpt</summary>
              <CodeBlock code={output.content.substring(0, 300) + (output.content.length > 300 ? '...' : '')} />
            </details>
          </ToolCard>
        );
      }

      if (toolState === 'output-error') {
        return <ToolCard title="Read Page Error" subtitle={state.errorText || 'Unknown error'} state="error" icon="📄" />;
      }

      return null;
    });

    log.info('✅ readPageContent tool registration complete');

    return () => {
      log.info('🧹 Cleaning up readPageContent tool');
      unregisterToolUI('readPageContent');
    };
  }, [registerToolUI, unregisterToolUI]);
}
