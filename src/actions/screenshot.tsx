import { useEffect } from "react";
import { z } from "zod";
import { registerTool } from "@/ai/tools";
import { useToolUI } from "@/ai/tools/components";
import { CompactToolRenderer } from "@/ai/tools/components";
import type { ToolUIState } from "@/ai/tools/components";
import { createLogger } from '~logger';

const log = createLogger('Tool-TakeScreenshot');

// Quality presets for screenshot compression
const QUALITY_PRESETS = {
    low: { jpegQuality: 0.3, maxWidth: 800, maxHeight: 600 },
    medium: { jpegQuality: 0.5, maxWidth: 1200, maxHeight: 900 },
    high: { jpegQuality: 0.85, maxWidth: 1920, maxHeight: 1080 },
} as const;

type QualityLevel = keyof typeof QUALITY_PRESETS;

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
2. Capture current viewport as PNG image
3. Compress image based on quality setting for AI analysis
4. Return high-quality image for display, compressed version for AI
5. Use visual info to decide next actions (click, type, read, etc.)

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

                    // Step 4: Check if tab is loading
                    if (tab.status === 'loading') {
                        log.warn('Tab is still loading', { url: tab.url });
                        // Don't fail, but warn - we can still try to capture
                    }

                    // Step 5: Capture screenshot
                    let dataUrl: string;
                    try {
                        dataUrl = await chrome.tabs.captureVisibleTab(
                            tab.windowId,
                            { format: 'png' }
                        );

                        if (!dataUrl) {
                            log.error('captureVisibleTab returned empty data');
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

                    // Step 6: Compress screenshot for AI processing
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

                    // Step 7: Get additional metadata
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

                    return {
                        success: true,
                        screenshot: dataUrl, // Full quality PNG for UI display
                        screenshotForAI: screenshotForAI, // Compressed JPEG for AI analysis
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
                    if (!output?.screenshot) {
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
                                src={output.screenshot}
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
                                            url: output.screenshot,
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

