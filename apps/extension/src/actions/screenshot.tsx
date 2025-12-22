import { useEffect } from "react";
import { z } from "zod";
import { registerTool } from "@/ai/tools";
import { useToolUI } from "@/ai/tools/components";
import { CompactToolRenderer } from "@/ai/tools/components";
import type { ToolUIState } from "@/ai/tools/components";
import { createLogger } from '~logger';

const log = createLogger('Tool-TakeScreenshot', 'TOOLS_EXECUTION');

// Quality presets for screenshot compression
const QUALITY_PRESETS = {
    low: { jpegQuality: 0.3, maxWidth: 800, maxHeight: 600 },
    medium: { jpegQuality: 0.5, maxWidth: 1200, maxHeight: 900 },
    high: { jpegQuality: 0.85, maxWidth: 1920, maxHeight: 1080 },
} as const;

type QualityLevel = keyof typeof QUALITY_PRESETS;

// ============================================================================
// SECURITY: Blur Sensitive Fields in Screenshots
// ============================================================================
// Before capturing screenshots, we blur sensitive input fields to prevent
// leaking PII (passwords, credit card numbers, SSN, etc.) to the AI model.
// This is ALWAYS enabled and cannot be disabled for privacy protection.
// The blur is applied temporarily and removed immediately after capture.
// ============================================================================

/**
 * CSS selectors for sensitive input fields that should be blurred in screenshots.
 * SECURITY: These fields may contain PII and should never be visible in screenshots.
 * 
 * LAYER 1: CSS Selector-based detection
 * These selectors catch the majority of sensitive fields by type, autocomplete,
 * name, and id attributes.
 */
const SENSITIVE_FIELD_SELECTORS = [
    // Password fields (type-based)
    'input[type="password"]',
    'input[autocomplete="current-password"]',
    'input[autocomplete="new-password"]',

    // Credit card fields
    'input[autocomplete="cc-number"]',
    'input[autocomplete="cc-exp"]',
    'input[autocomplete="cc-exp-month"]',
    'input[autocomplete="cc-exp-year"]',
    'input[autocomplete="cc-csc"]',
    'input[autocomplete="cc-type"]',

    // Sensitive name patterns (case-insensitive)
    // Full words
    'input[name*="password" i]',
    'input[name*="passwd" i]',
    'input[name*="ssn" i]',
    'input[name*="social" i]',
    'input[name*="secret" i]',
    // Abbreviations - LAYER 1 ENHANCEMENT
    'input[name*="pass" i]',
    'input[name*="pwd" i]',
    // Card-related
    'input[name*="cvv" i]',
    'input[name*="cvc" i]',
    'input[name*="csc" i]',
    'input[name*="cardnumber" i]',
    'input[name*="card-number" i]',
    'input[name*="card_number" i]',
    'input[name*="creditcard" i]',
    'input[name*="credit-card" i]',
    'input[name*="credit_card" i]',
    'input[name*="securitycode" i]',
    'input[name*="security-code" i]',
    'input[name*="security_code" i]',
    'input[name*="pin" i]',

    // ID-based patterns (case-insensitive)
    // Full words
    'input[id*="password" i]',
    'input[id*="passwd" i]',
    'input[id*="ssn" i]',
    'input[id*="secret" i]',
    // Abbreviations - LAYER 1 ENHANCEMENT
    'input[id*="pass" i]',
    'input[id*="pwd" i]',
    // Card-related
    'input[id*="cvv" i]',
    'input[id*="cvc" i]',
    'input[id*="cardnumber" i]',
    'input[id*="credit" i]',
    'input[id*="securitycode" i]',

    // Placeholder-based patterns - LAYER 1 ENHANCEMENT
    'input[placeholder*="password" i]',
    'input[placeholder*="pass" i]',
    'input[placeholder*="pwd" i]',
    'input[placeholder*="secret" i]',
    'input[placeholder*="ssn" i]',
    'input[placeholder*="cvv" i]',
    'input[placeholder*="cvc" i]',
    'input[placeholder*="card number" i]',
    'input[placeholder*="security code" i]',
].join(',');

/**
 * Marker attribute to track which elements were blurred by us.
 * Used to restore original state after screenshot capture.
 */
const BLUR_MARKER_ATTR = 'data-cognito-security-blur';

/**
 * LAYER 2: Password toggle detection patterns.
 * These are CSS selectors and class/id patterns for "show password" toggle buttons.
 * If a text input has a sibling matching these patterns, it's likely a password field.
 */
const PASSWORD_TOGGLE_PATTERNS = {
    // Class patterns for password toggle buttons
    classPatterns: [
        'toggle', 'eye', 'show', 'hide', 'visibility', 'reveal', 'peek',
        'password-toggle', 'pass-toggle', 'show-password', 'hide-password',
        'eye-icon', 'eye-btn', 'visibility-toggle'
    ],
    // Container class patterns that indicate a password field wrapper
    containerPatterns: [
        'password', 'pass-field', 'pwd-field', 'password-field',
        'password-input', 'password-wrapper', 'pass-wrapper', 'pwd-wrapper',
        'password-container', 'pass-container', 'secret-field'
    ],
    // Icon patterns (Font Awesome, Material Icons, etc.)
    iconSelectors: [
        '.fa-eye', '.fa-eye-slash',              // Font Awesome
        '.material-icons',                        // Material Icons
        '[class*="icon-eye"]',                   // Generic icon patterns
        '[class*="icon-visibility"]',
        'svg[class*="eye"]',                      // SVG icons
        'svg[class*="visibility"]'
    ]
};

/**
 * LAYER 3: Value-based heuristics for password detection.
 * Patterns that suggest a value might be a password.
 */
const PASSWORD_VALUE_PATTERNS = {
    // Minimum length for password detection
    minLength: 4,
    // Maximum length (very long values are likely not passwords)
    maxLength: 128,
    // Passwords rarely contain spaces
    noSpaces: true,
    // Patterns that suggest password content (has mixed chars, symbols, etc.)
    // We check if the value has characteristics of a password
};

/**
 * Injects a script to blur sensitive fields before screenshot capture.
 * SECURITY: This prevents PII from being visible in screenshots sent to AI.
 * 
 * Uses a 3-layer approach:
 * - LAYER 1: CSS selectors for type, autocomplete, name, id, placeholder
 * - LAYER 2: JavaScript detection for password toggle siblings (eye icons, show/hide buttons)
 * - LAYER 3: Value-based heuristics for edge cases
 * 
 * @param tabId - The tab ID to inject the blur script into
 * @returns Number of elements that were blurred
 */
async function blurSensitiveFields(tabId: number): Promise<number> {
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: (
                selectors: string,
                markerAttr: string,
                togglePatterns: typeof PASSWORD_TOGGLE_PATTERNS,
                valuePatterns: typeof PASSWORD_VALUE_PATTERNS
            ) => {
                // ================================================================
                // SECURITY: Multi-layer sensitive field detection
                // ================================================================
                const blurredElements = new Set<HTMLElement>();

                /**
                 * Apply blur to an element and track it
                 */
                function blurElement(el: HTMLElement): boolean {
                    if (blurredElements.has(el)) return false;

                    // Store original filter value if any
                    const originalFilter = el.style.filter;
                    el.setAttribute(markerAttr, originalFilter || '');
                    // Apply strong blur to hide content
                    el.style.filter = 'blur(8px)';
                    blurredElements.add(el);
                    return true;
                }

                // ================================================================
                // LAYER 1: CSS Selector-based detection
                // ================================================================
                const selectorMatches = document.querySelectorAll(selectors);
                selectorMatches.forEach(el => blurElement(el as HTMLElement));

                // ================================================================
                // LAYER 2: Password toggle sibling detection
                // ================================================================
                // Find all text inputs and check if they have password toggle siblings
                const textInputs = document.querySelectorAll('input[type="text"], input:not([type])');

                textInputs.forEach(input => {
                    const inputEl = input as HTMLInputElement;
                    if (blurredElements.has(inputEl)) return; // Already blurred by Layer 1

                    // Check 1: Is input inside a password container?
                    const parent = inputEl.closest('[class], [id]');
                    if (parent) {
                        const parentClass = (parent.className || '').toLowerCase();
                        const parentId = (parent.id || '').toLowerCase();
                        const combined = parentClass + ' ' + parentId;

                        const isPasswordContainer = togglePatterns.containerPatterns.some(
                            pattern => combined.includes(pattern.toLowerCase())
                        );
                        if (isPasswordContainer) {
                            blurElement(inputEl);
                            return;
                        }
                    }

                    // Check 2: Does input have a toggle button sibling?
                    const parentContainer = inputEl.parentElement;
                    if (parentContainer) {
                        // Look for toggle buttons in parent and grandparent
                        const searchContainers = [
                            parentContainer,
                            parentContainer.parentElement
                        ].filter(Boolean) as HTMLElement[];

                        for (const container of searchContainers) {
                            // Check for elements with toggle-like classes
                            const allElements = container.querySelectorAll('*');
                            let hasToggle = false;

                            for (const el of allElements) {
                                if (el === inputEl) continue;

                                const elClass = ((el as HTMLElement).className || '').toLowerCase();
                                const elId = ((el as HTMLElement).id || '').toLowerCase();
                                const combined = elClass + ' ' + elId;

                                // Check class patterns
                                if (togglePatterns.classPatterns.some(p => combined.includes(p.toLowerCase()))) {
                                    hasToggle = true;
                                    break;
                                }
                            }

                            // Check for icon selectors
                            if (!hasToggle) {
                                for (const iconSelector of togglePatterns.iconSelectors) {
                                    if (container.querySelector(iconSelector)) {
                                        hasToggle = true;
                                        break;
                                    }
                                }
                            }

                            if (hasToggle) {
                                blurElement(inputEl);
                                return;
                            }
                        }
                    }
                });

                // ================================================================
                // LAYER 3: Value-based heuristics
                // ================================================================
                // Scan remaining text inputs for password-like values
                const remainingInputs = document.querySelectorAll('input[type="text"], input:not([type])');

                remainingInputs.forEach(input => {
                    const inputEl = input as HTMLInputElement;
                    if (blurredElements.has(inputEl)) return; // Already blurred

                    const value = inputEl.value || '';

                    // Skip empty or very short values
                    if (value.length < valuePatterns.minLength) return;
                    // Skip very long values (probably not passwords)
                    if (value.length > valuePatterns.maxLength) return;

                    // Heuristic 1: Password-like characteristics
                    // - No spaces (passwords rarely have spaces)
                    // - Mix of character types (letters, numbers, symbols)
                    if (valuePatterns.noSpaces && value.includes(' ')) return;

                    const hasLowercase = /[a-z]/.test(value);
                    const hasUppercase = /[A-Z]/.test(value);
                    const hasNumbers = /\d/.test(value);
                    const hasSymbols = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value);

                    // Count how many character types are present
                    const charTypeCount = [hasLowercase, hasUppercase, hasNumbers, hasSymbols]
                        .filter(Boolean).length;

                    // If value has 3+ character types and reasonable length, likely a password
                    if (charTypeCount >= 3 && value.length >= 8) {
                        blurElement(inputEl);
                        return;
                    }

                    // Heuristic 2: Input appears right after a password-related label
                    const labels = document.querySelectorAll(`label[for="${inputEl.id}"]`);
                    labels.forEach(label => {
                        const labelText = (label.textContent || '').toLowerCase();
                        if (
                            labelText.includes('password') ||
                            labelText.includes('pass') ||
                            labelText.includes('secret') ||
                            labelText.includes('pin')
                        ) {
                            blurElement(inputEl);
                        }
                    });

                    // Also check preceding sibling text
                    const prevSibling = inputEl.previousElementSibling;
                    if (prevSibling) {
                        const siblingText = (prevSibling.textContent || '').toLowerCase();
                        if (
                            siblingText.includes('password') ||
                            siblingText.includes('pass') ||
                            siblingText.includes('secret')
                        ) {
                            blurElement(inputEl);
                        }
                    }
                });

                return blurredElements.size;
            },
            args: [SENSITIVE_FIELD_SELECTORS, BLUR_MARKER_ATTR, PASSWORD_TOGGLE_PATTERNS, PASSWORD_VALUE_PATTERNS]
        });

        const blurredCount = results[0]?.result || 0;
        if (blurredCount > 0) {
            log.info('SECURITY: Blurred sensitive fields before screenshot (3-layer detection)', { count: blurredCount });
        }
        return blurredCount;
    } catch (error) {
        // If we can't inject (e.g., restricted page), log and continue
        log.warn('Could not blur sensitive fields', { error: (error as Error).message });
        return 0;
    }
}

/**
 * Removes blur from sensitive fields after screenshot capture.
 * Restores original filter values if any were present.
 * @param tabId - The tab ID to remove blur from
 */
async function unblurSensitiveFields(tabId: number): Promise<void> {
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            func: (markerAttr: string) => {
                // SECURITY: Restore original state after screenshot
                const blurredElements = document.querySelectorAll(`[${markerAttr}]`);

                blurredElements.forEach(el => {
                    const htmlEl = el as HTMLElement;
                    // Restore original filter value
                    const originalFilter = htmlEl.getAttribute(markerAttr);
                    htmlEl.style.filter = originalFilter || '';
                    htmlEl.removeAttribute(markerAttr);
                });
            },
            args: [BLUR_MARKER_ATTR]
        });
        log.debug('SECURITY: Restored sensitive fields after screenshot');
    } catch (error) {
        // If we can't inject, the page may have navigated away - that's fine
        log.warn('Could not restore sensitive fields', { error: (error as Error).message });
    }
}

/**
 * Compresses a base64 PNG image to JPEG with optional resizing
 * @param dataUrl - Original PNG data URL (data:image/png;base64,...)
 * @param quality - Quality level: 'low', 'medium', or 'high'
 * @returns Compressed JPEG data URL
 */
async function compressScreenshot(
    dataUrl: string,
    quality: QualityLevel
): Promise<{ compressedDataUrl: string; originalSize: number; compressedSize: number }> {
    const preset = QUALITY_PRESETS[quality];

    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            try {
                // Calculate new dimensions while maintaining aspect ratio
                let { width, height } = img;
                const aspectRatio = width / height;

                if (width > preset.maxWidth) {
                    width = preset.maxWidth;
                    height = Math.round(width / aspectRatio);
                }

                if (height > preset.maxHeight) {
                    height = preset.maxHeight;
                    width = Math.round(height * aspectRatio);
                }

                // Create canvas and draw resized image
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas 2d context'));
                    return;
                }

                // Use better image smoothing for downscaling
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                ctx.drawImage(img, 0, 0, width, height);

                // Convert to JPEG with specified quality
                const compressedDataUrl = canvas.toDataURL('image/jpeg', preset.jpegQuality);

                // Calculate sizes for logging
                const originalSize = Math.round((dataUrl.length * 3) / 4); // Approximate base64 to bytes
                const compressedSize = Math.round((compressedDataUrl.length * 3) / 4);

                log.info('Screenshot compressed', {
                    quality,
                    originalDimensions: `${img.width}x${img.height}`,
                    newDimensions: `${width}x${height}`,
                    originalSizeKB: Math.round(originalSize / 1024),
                    compressedSizeKB: Math.round(compressedSize / 1024),
                    compressionRatio: `${Math.round((1 - compressedSize / originalSize) * 100)}%`
                });

                resolve({ compressedDataUrl, originalSize, compressedSize });
            } catch (err) {
                reject(err);
            }
        };

        img.onerror = () => {
            reject(new Error('Failed to load image for compression'));
        };

        img.src = dataUrl;
    });
}

export function useScreenshotTool() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering takeScreenshot tool...');

        registerTool({
            name: "takeScreenshot",
            description: `Capture a visual screenshot of the current viewport. Use this as the PRIMARY method to understand what's visible on a page - it's faster and more reliable than text extraction for initial page analysis.

QUALITY PARAMETER - IMPORTANT:
- "low" (PREFERRED): Use for navigation verification, checking if page loaded, quick overviews. Fastest AI processing.
- "medium" (DEFAULT): Use for general page analysis, identifying elements, forms, layouts.
- "high": ONLY use when you need to read small text, analyze fine visual details, or inspect precise UI elements(use it when you dont understand the visual details from low or medium ).

⚠️ ALWAYS prefer "low" quality unless you specifically need to read text or see fine details. High quality screenshots slow down AI response significantly.

WHEN TO USE:
- First step when analyzing any new page (before readPageContent or extractText)
- User asks "what's on this page?", "show me the page", "what do you see?"
- Verifying page loaded correctly after navigateTo (use quality="low")
- Checking visual layout, design, UI elements, forms, buttons
- Identifying clickable elements before using clickByText
- Debugging why interactions failed (see what's actually visible)

PRECONDITIONS:
- Must have activeTab permission
- Tab must be on a regular website (http:// or https://)
- Cannot capture chrome://, chrome-extension://, about:// pages (browser security)
- Tab must be visible (not minimized)

WORKFLOW:
1. Verify tab is accessible and visible
2. Wait for page to finish loading if still in progress (auto-waits up to 10s)
3. Capture current viewport as PNG image
4. Compress image based on quality setting for AI analysis
5. Return high-quality image for display, compressed version for AI
6. Use visual info to decide next actions (click, type, read, etc.)

LIMITATIONS:
- Only captures visible viewport (not full page scroll)
- Cannot capture restricted browser pages (chrome://, etc.)
- Requires tab to be in foreground and window visible

EXAMPLE: 
- takeScreenshot(quality="low", reason="verify page loaded") - for navigation checks
- takeScreenshot(quality="medium", reason="analyze page layout") - for general analysis  
- takeScreenshot(quality="high", reason="read small text in footer") - only when needed`,
            parameters: z.object({
                quality: z.enum(["low", "medium", "high"])
                    .default("medium")
                    .describe("Image quality for AI processing. Use 'low' for quick checks (PREFERRED - fastest), 'medium' for general analysis, 'high' ONLY for reading small text or fine details. Lower quality = faster AI response."),
                reason: z.string()
                    .optional()
                    .describe("Optional brief reason for screenshot (for logging/debugging). Examples: 'analyze page layout', 'verify form fields', 'check search results'. Not required but helpful for context."),
                delay: z.number().optional().default(0).describe("Delay in milliseconds before taking screenshot. Essential when waiting for a previous action to complete (e.g., AI response, form submission) or for dynamic content/animations to load.")
            }),
            execute: async ({ reason, quality = "medium", delay }, abortSignal) => {
                try {
                    // Handle delay if specified
                    if (delay && delay > 0) {
                        log.info(`⏳ takeScreenshot waiting for ${delay}ms...`);
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

                    log.info("TOOL CALL: takeScreenshot", { reason, quality, delay });

                    // Step 1: Check permissions first
                    let hasPermission = false;
                    try {
                        hasPermission = await chrome.permissions.contains({
                            permissions: ['activeTab']
                        });

                        if (!hasPermission) {
                            log.error('Missing activeTab permission');
                            return {
                                error: "Missing required 'activeTab' permission. The extension needs permission to capture screenshots. Please check extension permissions in chrome://extensions/.",
                                success: false,
                                errorType: 'PERMISSION_DENIED',
                                errorDetails: 'activeTab permission not granted'
                            };
                        }
                    } catch (permError) {
                        log.error('Error checking permissions:', permError);
                        return {
                            error: `Failed to check permissions: ${(permError as Error).message}. Unable to verify if screenshot capture is allowed.`,
                            success: false,
                            errorType: 'PERMISSION_CHECK_FAILED',
                            errorDetails: (permError as Error).message
                        };
                    }

                    // Step 2: Get active tab
                    let tab: chrome.tabs.Tab | undefined;
                    try {
                        const tabs = await chrome.tabs.query({
                            active: true,
                            currentWindow: true
                        });
                        tab = tabs[0];

                        if (!tab) {
                            log.error('No active tab found in current window');
                            return {
                                error: "No active tab found in the current window. Please make sure a tab is selected and try again.",
                                success: false,
                                errorType: 'NO_ACTIVE_TAB',
                                errorDetails: 'chrome.tabs.query returned empty array'
                            };
                        }

                        if (!tab.id) {
                            log.error('Active tab has no ID', { tab });
                            return {
                                error: "Active tab has no valid ID. This is unusual - the tab may be in an invalid state.",
                                success: false,
                                errorType: 'INVALID_TAB_ID',
                                errorDetails: 'tab.id is undefined'
                            };
                        }

                        if (!tab.windowId) {
                            log.error('Active tab has no window ID', { tab });
                            return {
                                error: "Active tab is not associated with a window. Cannot capture screenshot.",
                                success: false,
                                errorType: 'INVALID_WINDOW_ID',
                                errorDetails: 'tab.windowId is undefined'
                            };
                        }

                    } catch (tabError) {
                        log.error('Error querying active tab:', tabError);
                        return {
                            error: `Failed to get active tab: ${(tabError as Error).message}. The browser may be in an unstable state.`,
                            success: false,
                            errorType: 'TAB_QUERY_FAILED',
                            errorDetails: (tabError as Error).message
                        };
                    }

                    // Step 3: Check if tab URL is accessible
                    const restrictedSchemes = [
                        'chrome://',
                        'chrome-extension://',
                        'about://',
                        'edge://',
                        'devtools:',
                        'chrome-search://',
                        'chrome-untrusted://'
                    ];

                    if (tab.url) {
                        const matchedScheme = restrictedSchemes.find(scheme => tab.url!.startsWith(scheme));
                        if (matchedScheme) {
                            const scheme = matchedScheme.replace('://', '');
                            log.warn('Attempted to capture restricted page', { url: tab.url, scheme });
                            return {
                                error: `Cannot capture screenshots of ${scheme}:// pages due to browser security restrictions. These are protected system pages. Try navigating to a regular website (http:// or https://) instead.`,
                                success: false,
                                errorType: 'RESTRICTED_PAGE',
                                errorDetails: `Page scheme: ${scheme}://`,
                                url: tab.url,
                                restrictedScheme: scheme
                            };
                        }
                    } else {
                        log.warn('Tab has no URL', { tab });
                        return {
                            error: "The active tab has no URL. It may be a new empty tab or a special browser page. Try navigating to a website first.",
                            success: false,
                            errorType: 'NO_URL',
                            errorDetails: 'tab.url is undefined or null'
                        };
                    }

                    // Step 4: Wait for page to finish loading if needed
                    if (tab.status === 'loading') {
                        log.info('Tab is still loading, waiting for page to complete...', { url: tab.url });

                        try {
                            // Wait for the page to finish loading using content script
                            await chrome.scripting.executeScript({
                                target: { tabId: tab.id! },
                                func: () => {
                                    return new Promise<void>((resolve) => {
                                        if (document.readyState === 'complete') {
                                            resolve();
                                        } else {
                                            const onLoad = () => {
                                                resolve();
                                            };
                                            window.addEventListener('load', onLoad, { once: true });
                                            // Fallback timeout to avoid hanging indefinitely
                                            setTimeout(() => {
                                                window.removeEventListener('load', onLoad);
                                                resolve();
                                            }, 10000);
                                        }
                                    });
                                }
                            });
                            log.info('Page finished loading, proceeding with screenshot');
                        } catch (waitError) {
                            // If we can't inject script to wait (e.g., restricted page), just proceed
                            log.warn('Could not wait for page load, proceeding anyway', {
                                error: (waitError as Error).message
                            });
                        }
                    }

                    // ================================================================
                    // SECURITY: Step 5 - Blur sensitive fields before capture
                    // ================================================================
                    // We blur password fields, credit card inputs, SSN fields, etc.
                    // to prevent PII from being visible in screenshots sent to AI.
                    // This is ALWAYS enabled and cannot be disabled.
                    // ================================================================
                    let blurredCount = 0;
                    try {
                        blurredCount = await blurSensitiveFields(tab.id!);
                    } catch (blurError) {
                        // Non-fatal: continue with screenshot even if blur fails
                        log.warn('SECURITY: Could not blur sensitive fields, proceeding anyway', {
                            error: (blurError as Error).message
                        });
                    }

                    // Step 6: Capture screenshot (after page load, with sensitive fields blurred)
                    let dataUrl: string;
                    try {
                        dataUrl = await chrome.tabs.captureVisibleTab(
                            tab.windowId,
                            { format: 'png' }
                        );

                        if (!dataUrl) {
                            log.error('captureVisibleTab returned empty data');
                            // SECURITY: Restore page state before returning
                            if (blurredCount > 0) await unblurSensitiveFields(tab.id!).catch(() => { });
                            return {
                                error: "Screenshot capture returned empty data. The page may not be fully loaded or visible.",
                                success: false,
                                errorType: 'EMPTY_SCREENSHOT',
                                errorDetails: 'captureVisibleTab returned falsy value',
                                url: tab.url,
                                title: tab.title
                            };
                        }

                        // Validate data URL format
                        if (!dataUrl.startsWith('data:image/png;base64,')) {
                            log.error('Invalid screenshot data format', { prefix: dataUrl.substring(0, 50) });
                            // SECURITY: Restore page state before returning
                            if (blurredCount > 0) await unblurSensitiveFields(tab.id!).catch(() => { });
                            return {
                                error: "Screenshot data is in an invalid format. Expected PNG base64 data URL.",
                                success: false,
                                errorType: 'INVALID_FORMAT',
                                errorDetails: `Data URL prefix: ${dataUrl.substring(0, 50)}`,
                                url: tab.url,
                                title: tab.title
                            };
                        }

                    } catch (captureError) {
                        log.error('Error capturing visible tab:', captureError);
                        // SECURITY: Restore page state before returning on error
                        if (blurredCount > 0) await unblurSensitiveFields(tab.id!).catch(() => { });

                        const errorMsg = (captureError as Error).message || String(captureError);

                        // Provide context-specific error messages
                        let userMessage = `Failed to capture screenshot: ${errorMsg}`;
                        let errorType = 'CAPTURE_FAILED';

                        if (errorMsg.includes('permission')) {
                            userMessage = `Permission denied when trying to capture screenshot. The extension may not have access to this tab. Error: ${errorMsg}`;
                            errorType = 'CAPTURE_PERMISSION_DENIED';
                        } else if (errorMsg.includes('inactive')) {
                            userMessage = `Cannot capture screenshot because the tab is not active or visible. Please make sure the tab is in the foreground. Error: ${errorMsg}`;
                            errorType = 'TAB_NOT_ACTIVE';
                        } else if (errorMsg.includes('window')) {
                            userMessage = `Cannot capture screenshot due to window state issues. The window may be minimized or not visible. Error: ${errorMsg}`;
                            errorType = 'WINDOW_STATE_ERROR';
                        }

                        return {
                            error: userMessage,
                            success: false,
                            errorType,
                            errorDetails: errorMsg,
                            url: tab.url,
                            title: tab.title,
                            tabId: tab.id,
                            windowId: tab.windowId
                        };
                    }

                    // ================================================================
                    // SECURITY: Step 7 - Restore sensitive fields after capture
                    // ================================================================
                    // Always unblur after capture, regardless of success/failure.
                    // This ensures the page returns to its original visual state.
                    // ================================================================
                    if (blurredCount > 0) {
                        try {
                            await unblurSensitiveFields(tab.id!);
                        } catch (unblurError) {
                            // Non-fatal: page will return to normal on refresh anyway
                            log.warn('SECURITY: Could not restore sensitive fields', {
                                error: (unblurError as Error).message
                            });
                        }
                    }

                    // Step 8: Compress screenshot for AI processing
                    let screenshotForAI = dataUrl;
                    let compressionInfo: { originalSizeKB: number; compressedSizeKB: number; compressionRatio: string } | null = null;

                    try {
                        const { compressedDataUrl, originalSize, compressedSize } = await compressScreenshot(
                            dataUrl,
                            quality as QualityLevel
                        );
                        screenshotForAI = compressedDataUrl;
                        compressionInfo = {
                            originalSizeKB: Math.round(originalSize / 1024),
                            compressedSizeKB: Math.round(compressedSize / 1024),
                            compressionRatio: `${Math.round((1 - compressedSize / originalSize) * 100)}%`
                        };
                    } catch (compressionError) {
                        log.warn('Failed to compress screenshot, using original', { error: (compressionError as Error).message });
                        // Fall back to original image if compression fails
                    }

                    // Step 9: Get additional metadata
                    const viewport = {
                        width: tab.width || null,
                        height: tab.height || null
                    };

                    log.info("✅ Screenshot captured successfully", {
                        url: tab.url,
                        title: tab.title,
                        quality,
                        originalSizeKB: compressionInfo?.originalSizeKB,
                        compressedSizeKB: compressionInfo?.compressedSizeKB,
                        viewport
                    });

                    // IMPORTANT: Only send compressed screenshot to AI to reduce token usage
                    // Full quality PNG is stored in screenshotDisplay for UI rendering
                    return {
                        success: true,
                        screenshot: screenshotForAI, // Compressed JPEG for AI analysis (sent to model)
                        screenshotDisplay: dataUrl, // Full quality PNG for UI display only (not sent to AI)
                        quality,
                        compressionApplied: compressionInfo !== null,
                        compressionInfo,
                        url: tab.url,
                        title: tab.title,
                        timestamp: new Date().toISOString(),
                        viewport,
                        tabId: tab.id,
                        windowId: tab.windowId,
                        tabStatus: tab.status,
                        description: `Screenshot of ${tab.title || tab.url} (quality: ${quality})`,
                        reason: reason || undefined
                    };

                } catch (error) {
                    // Catch-all for any unexpected errors
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    const errorStack = error instanceof Error ? error.stack : undefined;

                    log.error('[Tool] Unexpected error in takeScreenshot:', error);

                    return {
                        error: `Unexpected error while taking screenshot: ${errorMsg}. This may be a bug in the extension. Please try again or report this issue.`,
                        success: false,
                        errorType: 'UNEXPECTED_ERROR',
                        errorDetails: errorMsg,
                        errorStack: errorStack?.substring(0, 500) // Truncate stack trace
                    };
                }
            },
        });

        // Register UI renderer with custom renderers
        registerToolUI(
            'takeScreenshot',
            (state: ToolUIState) => {
                return CompactToolRenderer({ state });
            },
            {
                renderInput: () => null, // Hide input section
                renderOutput: (output: any) => {
                    // Use screenshotDisplay (full quality) for UI, fall back to screenshot (compressed)
                    const displayImage = output?.screenshotDisplay || output?.screenshot;
                    if (!displayImage) {
                        return null;
                    }

                    return (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            width: '100%'
                        }}>
                            {output.reason && (
                                <div style={{
                                    fontSize: '11px',
                                    color: '#888',
                                    fontStyle: 'italic'
                                }}>
                                    {output.reason}
                                </div>
                            )}
                            <img
                                src={displayImage}
                                alt={output.title || 'Screenshot'}
                                className="tool-screenshot-image"
                                style={{
                                    maxWidth: '100%',
                                    borderRadius: '6px',
                                    border: '1px solid #e5e5e5',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s ease'
                                }}
                                onClick={() => {
                                    // Dispatch custom event to open image preview modal
                                    const event = new CustomEvent('openImagePreview', {
                                        detail: {
                                            url: displayImage,
                                            name: output.title || 'Screenshot'
                                        }
                                    });
                                    window.dispatchEvent(event);
                                }}
                                onMouseEnter={(e) => {
                                    (e.target as HTMLImageElement).style.transform = 'scale(1.02)';
                                }}
                                onMouseLeave={(e) => {
                                    (e.target as HTMLImageElement).style.transform = 'scale(1)';
                                }}
                            />
                        </div>
                    );
                }
            }
        );

        log.info('✅ takeScreenshot tool registered');

        return () => {
            unregisterToolUI('takeScreenshot');
            log.info('🔧 takeScreenshot tool unregistered');
        };
    }, [registerToolUI, unregisterToolUI]);
}

