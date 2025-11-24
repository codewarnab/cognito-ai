import { useEffect } from "react";
import { z } from "zod";
import { registerTool } from "@/ai/tools";
import { useToolUI } from "@/ai/tools/components";
import type { ToolUIState } from "@/ai/tools/components";
import { CompactToolRenderer } from "@/ai/tools/components";
import { createLogger } from '~logger';

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

export function useSelectionActions() {
  const log = createLogger("Actions-Selection");
  const { registerToolUI, unregisterToolUI } = useToolUI();

  useEffect(() => {
    log.info('🔧 Registering getSelectedText tool...');

    // Register getSelectedText tool
    registerTool({
      name: "getSelectedText",
      description: `Gets currently selected/highlighted text from active tab. Use when user asks to analyze/summarize/translate selected text or extract quotes. Requires text selection on page (not chrome:// pages). Returns plain text only, no HTML/formatting. Returns empty if nothing selected. Example: {success: true, selectedText: "React is a JavaScript library", length: 28}`,
      parameters: z.object({}),
      execute: async () => {
        try {
          log.info("TOOL CALL: getSelectedText");
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab || !tab.id) return { error: "No active tab" };

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

    // Register UI with custom renderers
    registerToolUI('getSelectedText', (state: ToolUIState) => {
      return <CompactToolRenderer state={state} />;
    }, {
      renderOutput: (output: any) => (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          fontSize: '13px',
          color: 'var(--text-secondary)'
        }}>
          {output.success && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', opacity: 0.7 }}>Length:</span>
                <span style={{ fontSize: '11px', padding: '2px 6px', opacity: 0.9 }}>
                  {output.length} characters
                </span>
              </div>
              {output.selectedText && (
                <div style={{
                  marginTop: '4px',
                  padding: '8px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {output.selectedText}
                </div>
              )}
            </>
          )}
          {output.error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', opacity: 0.7, color: 'var(--error-color)' }}>
                {output.error}
              </span>
            </div>
          )}
        </div>
      )
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
      description: `Extracts main text from active tab, removing ads/nav/scripts. Use after takeScreenshot or when user asks to read/summarize page content. Waits for page load, cleans content, returns title/URL/text. Default 5000 char limit (smart truncation at sentence boundary). Set limit param for more (10000-30000 for articles, 100000+ for full content). Cannot read chrome://, chrome-extension://, about://, or Web Store pages. Text only, no images/videos/forms. Example: {title: "React Docs", content: "...", contentLength: 10000, truncated: true}`,
      parameters: z.object({
        limit: z.number().optional().describe("Maximum characters to extract. Default: 5000 (smart truncation). Use 10000-30000 for large pages/articles. Higher values may overwhelm context. Set to very high number (100000+) to get full content."),
      }),
      validateContext: async () => {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          const url = tab?.url || '';

          // Check for restricted protocols that don't allow content scripts
          const restrictedProtocols = ['chrome:', 'chrome-extension:', 'about:', 'edge:', 'devtools:', 'view-source:'];
          const isRestricted = restrictedProtocols.some(protocol => url.startsWith(protocol));

          if (isRestricted) {
            return {
              valid: false,
              error: `Cannot read content from restricted pages. Current URL: ${url}. This tool only works on regular web pages (http/https). Try navigating to a web page first.`
            };
          }

          // Check for chrome web store
          if (url.includes('chrome.google.com/webstore')) {
            return {
              valid: false,
              error: `Cannot read content from Chrome Web Store pages. Current URL: ${url}. Chrome restricts extensions from accessing Web Store pages.`
            };
          }

          return { valid: true };
        } catch (error) {
          return { valid: false, error: `Failed to validate context: ${(error as Error).message}` };
        }
      },
      execute: async ({ limit }, abortSignal) => {
        // Check if aborted before starting
        if (abortSignal?.aborted) {
          log.info('🛑 readPageContent aborted before execution');
          throw new Error('Operation cancelled');
        }
        try {
          log.info("TOOL CALL: readPageContent", { limit });
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab || !tab.id) return { error: "No active tab" };

          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              return new Promise((resolve) => {
                // Wait for page to be fully loaded
                const waitForLoad = () => {
                  if (document.readyState === 'complete') {
                    performRead();
                  } else {
                    window.addEventListener('load', performRead, { once: true });
                    // Fallback timeout in case load event doesn't fire
                    setTimeout(performRead, 5000);
                  }
                };

                const performRead = () => {
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

                  resolve({
                    title,
                    content: textContent,
                    url: window.location.href,
                    originalLength: textContent.length
                  });
                };

                waitForLoad();
              });
            }
          });

          // Check if aborted after script execution
          if (abortSignal?.aborted) {
            log.info('🛑 readPageContent aborted after script execution');
            throw new Error('Operation cancelled');
          }

          const pageData = results[0]?.result as {
            title: string;
            content: string;
            url: string;
            originalLength: number;
          } | undefined;

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

              if (lastSentenceMatch && lastSentenceMatch.length > 0) {
                const lastMatch = lastSentenceMatch[lastSentenceMatch.length - 1];
                if (lastMatch) {
                  const lastSentenceIndex = lastChunk.lastIndexOf(lastMatch);
                  if (lastSentenceIndex > 0) {
                    truncated = truncated.slice(0, truncated.length - 200 + lastSentenceIndex + 2);
                  }
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

    // Register UI with custom renderers
    registerToolUI('readPageContent', (state: ToolUIState) => {
      return <CompactToolRenderer state={state} />;
    }, {
      renderInput: (input: any) => (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          fontSize: '13px',
          color: 'var(--text-secondary)'
        }}>
          {input.limit !== undefined && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', opacity: 0.7 }}>Limit:</span>
              <span style={{ fontSize: '11px', padding: '2px 6px', opacity: 0.9 }}>
                {input.limit.toLocaleString()} characters
              </span>
            </div>
          )}
        </div>
      ),
      renderOutput: (output: any) => (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          fontSize: '13px',
          color: 'var(--text-secondary)'
        }}>
          {output.success && (
            <>
              {output.title && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', opacity: 0.7 }}>Page:</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-primary)', opacity: 0.9 }}>
                    {output.title}
                  </span>
                </div>
              )}
              {output.url && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', opacity: 0.7 }}>URL:</span>
                  <a href={output.url} target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--text-primary)', fontSize: '12px', textDecoration: 'none' }}>
                    {output.url.length > 50 ? output.url.slice(0, 47) + '...' : output.url}
                  </a>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', opacity: 0.7 }}>Extracted:</span>
                <span style={{ fontSize: '11px', padding: '2px 6px', opacity: 0.9 }}>
                  {output.contentLength.toLocaleString()} characters
                </span>
              </div>
              {output.truncated && output.originalLength && (
                <div style={{
                  fontSize: '11px',
                  opacity: 0.6,
                  padding: '4px 6px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '3px',
                  border: '1px solid var(--border-color)'
                }}>
                  Content truncated from {output.originalLength.toLocaleString()} chars
                </div>
              )}
            </>
          )}
          {output.error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', opacity: 0.7, color: 'var(--error-color)' }}>
                {output.error}
              </span>
            </div>
          )}
        </div>
      )
    });

    log.info('✅ readPageContent tool registration complete');

    return () => {
      log.info('🧹 Cleaning up readPageContent tool');
      unregisterToolUI('readPageContent');
    };
  }, [registerToolUI, unregisterToolUI]);
}


