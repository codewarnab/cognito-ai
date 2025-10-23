import { useEffect } from "react";
import { z } from "zod";
import { registerTool } from "../ai/toolRegistryUtils";
import { useToolUI } from "../ai/ToolUIContext";
import { createLogger } from "../logger";

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
            func: () => {
              // Animation: Selection Glow (Option A)
              try {
                const css = `
                  @keyframes ai-selection-glow {
                    0%, 100% { outline: 2px solid rgba(59, 130, 246, 0); outline-offset: 2px; }
                    50% { outline: 2px solid rgba(59, 130, 246, 0.8); outline-offset: 4px; }
                  }
                `;
                const style = document.createElement('style');
                style.id = 'ai-selection-glow-style';
                style.textContent = css;
                document.head.appendChild(style);

                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                  const range = selection.getRangeAt(0);
                  const span = document.createElement('span');
                  span.style.outline = '2px solid rgba(59, 130, 246, 0.8)';
                  span.style.outlineOffset = '2px';
                  span.style.animation = 'ai-selection-glow 200ms ease-in-out';

                  try {
                    range.surroundContents(span);
                    setTimeout(() => {
                      try {
                        const parent = span.parentNode;
                        while (span.firstChild) {
                          parent?.insertBefore(span.firstChild, span);
                        }
                        span.remove();
                        document.getElementById('ai-selection-glow-style')?.remove();
                      } catch (e) { }
                    }, 200);
                  } catch (e) {
                    document.getElementById('ai-selection-glow-style')?.remove();
                  }
                }
              } catch (e) { }

              return window.getSelection()?.toString() || "";
            }
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

    // Using default CompactToolRenderer - no custom UI needed

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
      description: "Read text content from active tab; extracts main text content. For large pages (like social media feeds), specify a limit to avoid overwhelming responses. Recommended limit: 10000-30000 characters for summaries.",
      parameters: z.object({
        limit: z.number().optional().describe("Maximum characters to extract. Recommended: 10000-30000 for large pages. If not specified, intelligently cleans and limits content to ~50k chars."),
      }),
      execute: async ({ limit }) => {
        try {
          log.info("TOOL CALL: readPageContent", { limit });
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab.id) return { error: "No active tab" };

          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              // Animation: Vertical Scan (Option A)
              try {
                const css = `
                  @keyframes ai-vertical-scan-left {
                    0% { top: 0; opacity: 1; }
                    100% { top: 100%; opacity: 0.8; }
                  }
                  @keyframes ai-vertical-scan-right {
                    0% { top: 0; opacity: 1; }
                    100% { top: 100%; opacity: 0.8; }
                  }
                  .ai-vertical-scan-line {
                    position: fixed;
                    width: 3px;
                    height: 100px;
                    background: linear-gradient(to bottom, transparent, rgba(59, 130, 246, 0.8), transparent);
                    z-index: 999999;
                    pointer-events: none;
                    box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
                  }
                `;
                const style = document.createElement('style');
                style.id = 'ai-vertical-scan-style';
                style.textContent = css;
                document.head.appendChild(style);

                // Create left and right scan lines
                const leftLine = document.createElement('div');
                leftLine.className = 'ai-vertical-scan-line';
                leftLine.style.left = '0';
                leftLine.style.top = '0';
                leftLine.style.animation = 'ai-vertical-scan-left 400ms ease-in-out';

                const rightLine = document.createElement('div');
                rightLine.className = 'ai-vertical-scan-line';
                rightLine.style.right = '0';
                rightLine.style.top = '0';
                rightLine.style.animation = 'ai-vertical-scan-right 400ms ease-in-out';

                document.body.appendChild(leftLine);
                document.body.appendChild(rightLine);

                setTimeout(() => {
                  try {
                    leftLine.remove();
                    rightLine.remove();
                    document.getElementById('ai-vertical-scan-style')?.remove();
                  } catch (e) { }
                }, 400);
              } catch (e) { }

              const body = document.body;
              const title = document.title;

              // Clone the body to avoid modifying the actual page
              const clonedBody = body.cloneNode(true) as HTMLElement;

              // Remove unnecessary elements that add noise
              const tagsToRemove = [
                'script', 'style', 'noscript', 'iframe', 'embed', 'object',
                'svg', 'canvas', 'map', 'video', 'audio', 'picture',
                'nav', 'footer', 'aside', 'form', 'button', 'input', 'select', 'textarea',
                '[role="banner"]', '[role="navigation"]', '[role="complementary"]',
                '[role="contentinfo"]', '[aria-hidden="true"]',
                '.ad', '.ads', '.advertisement', '.cookie-banner', '.popup',
                '.sidebar', '.widget', '.comment', '.comments', '.social-share'
              ];

              tagsToRemove.forEach(selector => {
                clonedBody.querySelectorAll(selector).forEach(el => el.remove());
              });

              // Get the cleaned text content
              let textContent = clonedBody.innerText || clonedBody.textContent || "";

              // Clean up whitespace and extra newlines
              textContent = textContent
                .replace(/\n\s*\n\s*\n/g, '\n\n') // Reduce multiple blank lines to double newline
                .replace(/[ \t]+/g, ' ') // Normalize spaces
                .replace(/^\s+|\s+$/gm, '') // Trim lines
                .trim();

              return {
                title,
                content: textContent,
                url: window.location.href,
                originalLength: textContent.length
              };
            }
          });

          const pageData = results[0]?.result;
          if (!pageData) return { error: "Failed to extract page content" };

          let finalContent = pageData.content;
          let wasTruncated = false;

          // If limit is specified, use it directly
          if (limit !== undefined && limit !== null) {
            const numericLimit = Number(limit);
            if (Number.isFinite(numericLimit) && numericLimit > 0) {
              const normalizedLimit = Math.max(0, Math.floor(numericLimit));
              finalContent = pageData.content.slice(0, normalizedLimit);
              wasTruncated = finalContent.length < pageData.content.length;
            }
          } else {
            // No limit specified - apply smart truncation to ~5k chars
            const MAX_CONTENT_LENGTH = 5000;

            if (pageData.content.length > MAX_CONTENT_LENGTH) {
              // Truncate but try to end at a sentence boundary
              let truncated = pageData.content.slice(0, MAX_CONTENT_LENGTH);

              // Try to find last sentence ending (., !, ?) within last 200 chars
              const lastChunk = truncated.slice(-200);
              const lastSentenceMatch = lastChunk.match(/[.!?]\s/g);

              if (lastSentenceMatch) {
                const lastSentenceIndex = lastChunk.lastIndexOf(lastSentenceMatch[lastSentenceMatch.length - 1]);
                if (lastSentenceIndex > 0) {
                  truncated = truncated.slice(0, truncated.length - 200 + lastSentenceIndex + 2);
                }
              }

              finalContent = truncated;
              wasTruncated = true;
            }
          }

          return {
            success: true,
            title: pageData.title,
            url: pageData.url,
            content: finalContent,
            contentLength: finalContent.length,
            ...(wasTruncated && {
              truncated: true,
              originalLength: pageData.originalLength
            })
          };
        } catch (error) {
          log.error('[Tool] Error reading page content:', error);
          return { error: "Failed to read page content. Make sure you have permission to access this page." };
        }
      },
    });

    // Using default CompactToolRenderer - no custom UI needed

    log.info('✅ readPageContent tool registration complete');

    return () => {
      log.info('🧹 Cleaning up readPageContent tool');
      unregisterToolUI('readPageContent');
    };
  }, [registerToolUI, unregisterToolUI]);
}
