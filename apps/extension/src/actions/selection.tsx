import { useEffect } from "react";
import { z } from "zod";
import { registerTool } from "@/ai/tools";
import { useToolUI } from "@/ai/tools/components";
import type { ToolUIState } from "@/ai/tools/components";
import { CompactToolRenderer } from "@/ai/tools/components";
import { createLogger } from '~logger';
import { useUnifiedReadPageContent } from "./selection/unified-read-page-content";

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

  // Use unified readPageContent tool (replaces old readPageContent, extractText, and analyzeDom)
  useUnifiedReadPageContent();
}

