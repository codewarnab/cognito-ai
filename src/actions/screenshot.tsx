import { useEffect } from "react";
import { z } from "zod";
import { registerTool } from "../ai/tools";
import { useToolUI } from "../ai/tools/components";
import { CompactToolRenderer } from "../ai/tools/components";
import type { ToolUIState } from "../ai/tools/components";
import { createLogger } from "../logger";

const log = createLogger('Tool-TakeScreenshot');

export function useScreenshotTool() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering takeScreenshot tool...');

        registerTool({
            name: "takeScreenshot",
            description: "Capture a screenshot of the current visible viewport to visually analyze the page. Returns a full-resolution PNG image that the AI can analyze for layout, design, visual elements, content, forms, buttons, and any visible information. Use this as the primary method to understand what's on a page.",
            parameters: z.object({
                reason: z.string()
                    .optional()
                    .describe("Optional: Brief reason for taking the screenshot (e.g., 'analyze page layout', 'check form fields')")
            }),
            execute: async ({ reason }) => {
                try {
                    log.info("TOOL CALL: takeScreenshot", { reason });

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

                    // Step 6: Get additional metadata
                    const viewport = {
                        width: tab.width || null,
                        height: tab.height || null
                    };

                    log.info("✅ Screenshot captured successfully", {
                        url: tab.url,
                        title: tab.title,
                        dataUrlLength: dataUrl.length,
                        viewport
                    });

                    return {
                        success: true,
                        screenshot: dataUrl, // data:image/png;base64,...
                        url: tab.url,
                        title: tab.title,
                        timestamp: new Date().toISOString(),
                        viewport,
                        tabId: tab.id,
                        windowId: tab.windowId,
                        tabStatus: tab.status,
                        description: `Screenshot of ${tab.title || tab.url}`,
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
                                onClick={(e) => {
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
