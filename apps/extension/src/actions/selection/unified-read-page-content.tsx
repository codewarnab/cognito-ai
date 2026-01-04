/**
 * Unified readPageContent Tool
 * Consolidates readPageContent, extractText, and analyzeDom functionality
 * Uses in-page DOM extraction for progressive extraction and ranked selectors
 */

import { useEffect } from "react";
import { z } from "zod";
import { createLogger } from '~logger';
import { registerTool } from "@/ai/tools";
import { useToolUI } from "@/ai/tools/components";
import { CompactToolRenderer } from "@/ai/tools/components";
import type { ToolUIState } from "@/ai/tools/components";
import { ensureBundleInjected } from "@/utils/smart-dom-reader";

const log = createLogger("Actions-Selection-ReadPageContent");

export function useUnifiedReadPageContent() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering unified readPageContent tool...');

        registerTool({
            name: "readPageContent",
            description: `Unified page content extraction and structure analysis tool. Supports progressive extraction for token efficiency, ranked CSS selectors, and comprehensive page analysis.

EXTRACTION MODES:
- 'text': Plain text extraction (removes nav/forms/ads) - default for simple reading
- 'interactive': Interactive elements only (buttons, links, inputs, forms) - for automation
- 'full': Interactive + semantic elements (headings, images, tables, lists) - for analysis
- 'structure': Page structure overview only (minimal tokens) - for progressive workflow

PROGRESSIVE EXTRACTION WORKFLOW (Token-Efficient):
1. First call: readPageContent({ mode: 'structure' }) → Get page overview (~200-500 tokens)
2. Second call: readPageContent({ mode: 'interactive', selector: 'main' }) → Extract specific region
3. Optional: readPageContent({ mode: 'text', selector: 'article' }) → Get readable content

SELECTOR SUPPORT:
- selector: CSS selector to target specific element(s) - e.g., "article", "#main", ".content"
- Returns ranked selectors for all interactive elements (ID > data-testid > ARIA > classes)

OUTPUT INCLUDES:
- Text content (cleaned and formatted)
- Structure analysis (headings, landmarks, page type)
- Interactive elements (buttons, links, inputs, forms) with ranked selectors
- Search bars detection (with selectors)
- Semantic elements (headings, images, tables) in 'full' mode
- Form associations (which inputs belong to which form)

USE CASES:
- Simple reading: readPageContent({ mode: 'text' })
- Find elements: readPageContent({ mode: 'interactive' })
- Full analysis: readPageContent({ mode: 'full' })
- Token-efficient: readPageContent({ mode: 'structure' }) then targeted extraction
- Specific section: readPageContent({ selector: 'article', mode: 'full' })

LIMITATIONS:
- Cannot read chrome://, chrome-extension://, or Web Store pages
- Text extraction limited to visible content
- Shadow DOM supported but may require includeShadowDOM: true`,

            parameters: z.object({
                mode: z.enum(['text', 'interactive', 'full', 'structure'])
                    .optional()
                    .default('text')
                    .describe('Extraction mode: "text" (plain text, removes nav/forms), "interactive" (buttons/links/inputs), "full" (interactive + semantic), "structure" (overview only, minimal tokens)'),

                selector: z.string()
                    .optional()
                    .describe('Optional CSS selector to target specific element(s). Examples: "article", "#main", ".content". If omitted, extracts from entire page body. Use for targeted extraction.'),

                limit: z.number()
                    .optional()
                    .describe('Maximum characters to extract for text content. Default: 5000 for text mode, unlimited for other modes. Use 10000-30000 for large pages/articles.'),

                delay: z.number()
                    .optional()
                    .default(0)
                    .describe('Delay in milliseconds before reading content. Essential when waiting for previous actions to complete or dynamic content to load.'),

                includeHidden: z.boolean()
                    .optional()
                    .default(false)
                    .describe('Include hidden elements (display:none, visibility:hidden). Default: false. Set true for analyzing hidden modals or collapsed content.'),

                includeShadowDOM: z.boolean()
                    .optional()
                    .default(true)
                    .describe('Traverse shadow DOM roots. Default: true. Set false for faster extraction if shadow DOM not needed.'),

                viewportOnly: z.boolean()
                    .optional()
                    .default(false)
                    .describe('Only extract elements visible in viewport. Default: false. Set true for faster extraction of visible content only.'),

                mainContentOnly: z.boolean()
                    .optional()
                    .default(false)
                    .describe('Focus on main content area (main, article, [role="main"]). Default: false. Automatically enabled in text mode.'),
            }),

            validateContext: async () => {
                try {
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    const url = tab?.url || '';

                    // Check for restricted protocols
                    const restrictedProtocols = ['chrome:', 'chrome-extension:', 'about:', 'edge:', 'devtools:', 'view-source:'];
                    const isRestricted = restrictedProtocols.some(protocol => url.startsWith(protocol));

                    if (isRestricted) {
                        return {
                            valid: false,
                            error: `Cannot read content from restricted pages. Current URL: ${url}. This tool only works on regular web pages (http/https).`
                        };
                    }

                    // Check for chrome web store
                    if (url.includes('chrome.google.com/webstore')) {
                        return {
                            valid: false,
                            error: `Cannot read content from Chrome Web Store pages. Current URL: ${url}.`
                        };
                    }

                    return { valid: true };
                } catch (error) {
                    return { valid: false, error: `Failed to validate context: ${(error as Error).message}` };
                }
            },

            execute: async ({
                mode = 'text',
                selector,
                limit,
                delay = 0,
                includeHidden = false,
                includeShadowDOM = true,
                viewportOnly = false,
                mainContentOnly = false
            }, abortSignal) => {
                // Handle abort
                if (abortSignal?.aborted) {
                    log.info('🛑 readPageContent aborted before execution');
                    throw new Error('Operation cancelled');
                }

                // Handle delay
                if (delay > 0) {
                    log.info(`⏳ readPageContent waiting for ${delay}ms...`);
                    await new Promise<void>((resolve, reject) => {
                        const timer = setTimeout(resolve, delay);
                        if (abortSignal) {
                            abortSignal.addEventListener('abort', () => {
                                clearTimeout(timer);
                                reject(new Error('Operation cancelled'));
                            });
                        }
                    });
                }

                try {
                    log.info("TOOL CALL: readPageContent", {
                        mode,
                        selector,
                        limit,
                        includeHidden,
                        includeShadowDOM,
                        viewportOnly,
                        mainContentOnly
                    });

                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab || !tab.id) return { error: "No active tab" };

                    // Ensure bundle is injected
                    const bundleInjected = await ensureBundleInjected(tab.id);
                    if (!bundleInjected) {
                        return { error: "Failed to initialize page extraction library" };
                    }

                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        args: [
                            mode,
                            selector || null,
                            limit || null,
                            Boolean(includeHidden),
                            Boolean(includeShadowDOM),
                            Boolean(viewportOnly),
                            Boolean(mainContentOnly || mode === 'text') // Auto-enable for text mode
                        ],
                        func: (
                            extractionMode: string,
                            targetSelector: string | null,
                            charLimit: number | null,
                            showHidden: boolean,
                            _includeShadow: boolean,
                            _viewport: boolean,
                            mainOnly: boolean
                        ) => {
                            // Access bundle from window
                            const bundle = (window as any).SmartDOMReaderBundle;

                            if (!bundle?.SmartDOMReader || !bundle?.ProgressiveExtractor) {
                                return {
                                    error: "Smart DOM Reader not available. Please ensure the library is properly initialized."
                                };
                            }

                            const { SmartDOMReader, ProgressiveExtractor } = bundle;

                            try {
                                // Add animation
                                try {
                                    const css = `
                    @keyframes ai-vertical-scan-left {
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

                                    const leftLine = document.createElement('div');
                                    leftLine.className = 'ai-vertical-scan-line';
                                    leftLine.style.left = '0';
                                    leftLine.style.top = '0';
                                    leftLine.style.animation = 'ai-vertical-scan-left 400ms ease-in-out';

                                    const rightLine = document.createElement('div');
                                    rightLine.className = 'ai-vertical-scan-line';
                                    rightLine.style.right = '0';
                                    rightLine.style.top = '0';
                                    rightLine.style.animation = 'ai-vertical-scan-left 400ms ease-in-out';

                                    document.body.appendChild(leftLine);
                                    document.body.appendChild(rightLine);

                                    setTimeout(() => {
                                        try {
                                            leftLine.remove();
                                            rightLine.remove();
                                            document.getElementById('ai-vertical-scan-style')?.remove();
                                        } catch { /* ignore */ }
                                    }, 400);
                                } catch { /* ignore animation errors */ }

                                // MODE: structure - Get page overview only
                                if (extractionMode === 'structure') {
                                    const rootElement = targetSelector
                                        ? document.querySelector(targetSelector)
                                        : document.body;

                                    if (!rootElement) {
                                        return {
                                            error: targetSelector
                                                ? `Element not found: ${targetSelector}`
                                                : "No body element found"
                                        };
                                    }

                                    const structure = ProgressiveExtractor.extractStructure(rootElement);

                                    return {
                                        success: true,
                                        mode: 'structure',
                                        structure: {
                                            summary: structure.summary,
                                            regions: structure.regions,
                                            forms: structure.forms,
                                            suggestions: structure.suggestions
                                        },
                                        page: {
                                            url: window.location.href,
                                            title: document.title
                                        }
                                    };
                                }

                                // MODE: text - Plain text extraction (cleaned)
                                if (extractionMode === 'text') {
                                    const rootElement = targetSelector
                                        ? document.querySelector(targetSelector)
                                        : (mainOnly
                                            ? (document.querySelector('main, article, [role="main"]') || document.body)
                                            : document.body);

                                    if (!rootElement) {
                                        return {
                                            error: targetSelector
                                                ? `Element not found: ${targetSelector}`
                                                : "No body element found"
                                        };
                                    }

                                    // Clone and clean the content
                                    const clonedRoot = rootElement.cloneNode(true) as HTMLElement;

                                    // Remove unnecessary elements
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
                                        clonedRoot.querySelectorAll(selector).forEach(el => el.remove());
                                    });

                                    // Get text content
                                    let textContent = clonedRoot.innerText || clonedRoot.textContent || '';

                                    // Clean up whitespace
                                    textContent = textContent
                                        .replace(/\n\s*\n\s*\n/g, '\n\n')
                                        .replace(/[ \t]+/g, ' ')
                                        .replace(/^\s+|\s+$/gm, '')
                                        .trim();

                                    // Apply limit
                                    const maxLength = charLimit || 5000;
                                    let finalContent = textContent;
                                    let wasTruncated = false;

                                    if (textContent.length > maxLength) {
                                        // Smart truncation at sentence boundary
                                        let truncated = textContent.slice(0, maxLength);
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

                                    return {
                                        success: true,
                                        mode: 'text',
                                        title: document.title,
                                        url: window.location.href,
                                        content: finalContent,
                                        contentLength: finalContent.length,
                                        ...(wasTruncated && {
                                            truncated: true,
                                            originalLength: textContent.length
                                        })
                                    };
                                }

                                // MODE: interactive or full - Use SmartDOMReader
                                const extractionOptions = {
                                    includeHidden: showHidden,
                                    mainContentOnly: mainOnly
                                };

                                let result;

                                if (targetSelector) {
                                    // Extract from specific selector
                                    const targetElement = document.querySelector(targetSelector);
                                    if (!targetElement) {
                                        return {
                                            error: `Element not found: ${targetSelector}`
                                        };
                                    }
                                    result = SmartDOMReader.extractFromElement(
                                        targetElement,
                                        extractionMode === 'full' ? 'full' : 'interactive',
                                        extractionOptions
                                    );
                                } else {
                                    // Extract from entire document
                                    result = extractionMode === 'full'
                                        ? SmartDOMReader.extractFull(document, extractionOptions)
                                        : SmartDOMReader.extractInteractive(document, extractionOptions);
                                }

                                return {
                                    success: true,
                                    mode: extractionMode,
                                    ...result,
                                    page: {
                                        url: window.location.href,
                                        title: document.title,
                                        ...result?.page
                                    }
                                };

                            } catch (error) {
                                return {
                                    error: `Extraction failed: ${(error as Error).message}`
                                };
                            }
                        }
                    });

                    // Check if aborted after script execution
                    if (abortSignal?.aborted) {
                        log.info('🛑 readPageContent aborted after script execution');
                        throw new Error('Operation cancelled');
                    }

                    const result = results[0]?.result;
                    if (result?.error) {
                        log.warn("readPageContent failed", result);
                        return result;
                    }

                    log.info("✅ readPageContent completed", {
                        mode: result?.mode,
                        success: result?.success
                    });

                    return result || { error: "Failed to read page content" };

                } catch (error) {
                    log.error('[Tool] Error reading page content:', error);
                    return { error: "Failed to read page content. Make sure you have permission to access this page." };
                }
            },
        });

        // Register UI
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
                    {input.mode && input.mode !== 'text' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', opacity: 0.7 }}>Mode:</span>
                            <span style={{ fontSize: '11px', padding: '2px 6px', opacity: 0.9 }}>
                                {input.mode}
                            </span>
                        </div>
                    )}
                    {input.selector && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', opacity: 0.7 }}>Selector:</span>
                            <span style={{ fontSize: '11px', padding: '2px 6px', opacity: 0.9 }}>
                                {input.selector}
                            </span>
                        </div>
                    )}
                    {input.limit !== undefined && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', opacity: 0.7 }}>Limit:</span>
                            <span style={{ fontSize: '11px', padding: '2px 6px', opacity: 0.9 }}>
                                {input.limit.toLocaleString()} chars
                            </span>
                        </div>
                    )}
                </div>
            ),
            renderOutput: (output: any) => {
                if (output.error) {
                    return (
                        <div style={{ color: 'var(--error)', fontSize: '13px' }}>
                            {output.error}
                        </div>
                    );
                }

                const mode = output.mode || 'text';

                if (mode === 'structure') {
                    return (
                        <div style={{ fontSize: '13px' }}>
                            <div>Structure overview</div>
                            <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
                                {output.structure?.summary?.totalRegions || 0} regions, {' '}
                                {output.structure?.forms?.length || 0} forms
                            </div>
                        </div>
                    );
                }

                if (mode === 'text') {
                    return (
                        <div style={{ fontSize: '13px' }}>
                            <div>{output.contentLength?.toLocaleString() || 0} characters</div>
                            {output.truncated && (
                                <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
                                    Truncated from {output.originalLength?.toLocaleString()} chars
                                </div>
                            )}
                        </div>
                    );
                }

                // interactive or full mode
                const interactive = output.interactive || {};
                const counts = [];
                if (interactive.buttons?.length) counts.push(`${interactive.buttons.length} buttons`);
                if (interactive.links?.length) counts.push(`${interactive.links.length} links`);
                if (interactive.inputs?.length) counts.push(`${interactive.inputs.length} inputs`);
                if (interactive.forms?.length) counts.push(`${interactive.forms.length} forms`);

                return (
                    <div style={{ fontSize: '13px' }}>
                        <div>
                            {counts.length > 0
                                ? counts.join(', ')
                                : 'No interactive elements found'
                            }
                        </div>
                        {output.semantic && (
                            <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
                                + {Object.keys(output.semantic).length} semantic types
                            </div>
                        )}
                    </div>
                );
            }
        });

        log.info('✅ Unified readPageContent tool registration complete');

        return () => {
            log.info('🧹 Cleaning up unified readPageContent tool');
            unregisterToolUI('readPageContent');
        };
    }, [registerToolUI, unregisterToolUI]);
}
