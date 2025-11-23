import { useEffect } from "react";
import { z } from "zod";
import { createLogger } from '~logger';
import { registerTool } from "../../ai/tools";
import { useToolUI } from "../../ai/tools/components";

const log = createLogger("Actions-DOM-ExecuteScript");

interface ScriptExecutionResult {
    success: boolean;
    result?: any;
    executed?: boolean;
    error?: string;
    stack?: string;
    type?: string;
    timeout?: boolean;
    suggestion?: string;
    frameRemoved?: boolean;
    cspBlocked?: boolean;
    permissionDenied?: boolean;
}

export function useExecuteScriptTool() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering executeScript tool...');

        registerTool({
            name: "executeScript",
            description: `Execute JavaScript code in the active page context. Use for tasks without specific tools.

WHEN TO USE:
- Canvas manipulation (drawing, WebGL)
- Custom event triggering
- Accessing page-specific APIs
- Complex DOM operations requiring multiple steps
- Tasks that require page context (libraries, frameworks)

PRECONDITIONS:
- Use analyzeDom first to understand page structure
- Verify selectors and element existence
- Ensure code is safe and won't cause infinite loops

SECURITY NOTES:
- Runs in page context (has full DOM access)
- Subject to page's Content Security Policy (CSP)
- May fail on restricted sites

RETURNS: Execution result or error with details

EXAMPLE - Drawing on Canvas:
Input: {
  code: "const canvas = document.querySelector('#canvas-id');
         const ctx = canvas.getContext('2d');
         ctx.fillStyle = 'blue';
         ctx.fillRect(10, 10, 100, 100);
         return { drawn: true, position: {x: 10, y: 10} };"
}
Output: { success: true, result: { drawn: true, position: {x: 10, y: 10} } }

EXAMPLE - Form Manipulation:
Input: {
  code: "const form = document.querySelector('form');
         const inputs = form.querySelectorAll('input[type=text]');
         inputs.forEach(input => input.value = 'Test');
         return { filled: inputs.length };"
}
Output: { success: true, result: { filled: 3 } }`,
            parameters: z.object({
                code: z.string().describe("JavaScript code to execute in page context. Can use async/await. Should return serializable data."),
                timeout: z.number().optional().default(5000).describe("Execution timeout in milliseconds (default: 5000ms)"),
                returnValue: z.boolean().optional().default(true).describe("Whether to return the execution result (default: true)")
            }),
            execute: async ({ code, timeout = 5000, returnValue = true }) => {
                try {
                    log.info("TOOL CALL: executeScript", {
                        codeLength: code.length,
                        timeout,
                        returnValue
                    });

                    // Get active tab
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab || !tab.id) {
                        return {
                            success: false,
                            error: "No active tab found",
                            suggestion: "Make sure a tab is active and accessible"
                        };
                    }

                    // Log code being executed (first 200 chars for security)
                    log.info("📝 Executing script:", {
                        preview: code.slice(0, 200) + (code.length > 200 ? '...' : ''),
                        tabId: tab.id,
                        url: tab.url
                    });

                    // Execute script with timeout handling
                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        args: [code, returnValue, timeout],
                        func: (scriptCode: string, shouldReturn: boolean, timeoutMs: number) => {
                            return new Promise<ScriptExecutionResult>((resolve) => {
                                let timedOut = false;
                                let timeoutId: number | null = null;

                                // Set up timeout
                                timeoutId = window.setTimeout(() => {
                                    timedOut = true;
                                    resolve({
                                        success: false,
                                        error: `Script execution timeout after ${timeoutMs}ms`,
                                        timeout: true,
                                        suggestion: "Script took too long. Consider simplifying or breaking into smaller operations."
                                    });
                                }, timeoutMs);

                                try {
                                    // Create async function to support await
                                    const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
                                    const fn = new AsyncFunction(scriptCode);

                                    // Execute the function
                                    const resultPromise = fn();

                                    // Handle result
                                    Promise.resolve(resultPromise)
                                        .then((result) => {
                                            if (timedOut) return;
                                            if (timeoutId !== null) clearTimeout(timeoutId);

                                            resolve({
                                                success: true,
                                                result: shouldReturn ? result : undefined,
                                                executed: true
                                            });
                                        })
                                        .catch((error: Error) => {
                                            if (timedOut) return;
                                            if (timeoutId !== null) clearTimeout(timeoutId);

                                            resolve({
                                                success: false,
                                                error: error.message,
                                                stack: error.stack,
                                                type: error.constructor.name,
                                                suggestion: generateErrorSuggestion(error.message)
                                            });
                                        });
                                } catch (error) {
                                    if (timedOut) return;
                                    if (timeoutId !== null) clearTimeout(timeoutId);

                                    const err = error as Error;
                                    resolve({
                                        success: false,
                                        error: err.message,
                                        stack: err.stack,
                                        type: err.constructor.name,
                                        suggestion: generateErrorSuggestion(err.message)
                                    });
                                }
                            });

                            // Helper function to generate error suggestions
                            function generateErrorSuggestion(errorMsg: string): string {
                                if (errorMsg.includes('is not defined')) {
                                    return "Variable or function not found. Check if it exists in page context.";
                                }
                                if (errorMsg.includes('Cannot read property') || errorMsg.includes('Cannot read properties')) {
                                    return "Trying to access property of null/undefined. Use analyzeDom to verify element exists.";
                                }
                                if (errorMsg.includes('querySelector') || errorMsg.includes('getElementById')) {
                                    return "Element not found. Use analyzeDom to get correct selector.";
                                }
                                if (errorMsg.includes('Unexpected token')) {
                                    return "Syntax error in code. Check JavaScript syntax.";
                                }
                                if (errorMsg.includes('canvas') || errorMsg.includes('context')) {
                                    return "Canvas error. Ensure canvas exists and context is available.";
                                }
                                if (errorMsg.includes('Permission') || errorMsg.includes('denied')) {
                                    return "Permission denied. Page may have security restrictions.";
                                }
                                return "Check console for details and verify code logic.";
                            }
                        }
                    });

                    const result = results[0]?.result as ScriptExecutionResult | undefined;

                    if (result?.success) {
                        log.info("✅ executeScript success", {
                            hasResult: !!result.result,
                            resultType: result.result ? typeof result.result : undefined
                        });
                    } else {
                        log.warn("❌ executeScript failed", {
                            error: result?.error,
                            type: result?.type,
                            timeout: result?.timeout
                        });
                    }

                    return result || {
                        success: false,
                        error: "Failed to execute script - no result returned",
                        suggestion: "Script may have failed silently. Check browser console."
                    };

                } catch (error) {
                    const errorMsg = (error as Error)?.message || String(error);

                    // Handle frame removal (page navigation)
                    if (errorMsg.includes('Frame with ID') || errorMsg.includes('was removed')) {
                        log.warn('[Tool] Frame removed during script execution - page may be navigating', {
                            codePreview: code.slice(0, 100)
                        });
                        return {
                            success: false,
                            error: "Page is navigating - script execution cancelled",
                            frameRemoved: true,
                            suggestion: "Wait for page to load before executing scripts."
                        };
                    }

                    // Handle CSP errors
                    if (errorMsg.includes('Content Security Policy') || errorMsg.includes('CSP')) {
                        log.warn('[Tool] CSP blocked script execution', { error: errorMsg });
                        return {
                            success: false,
                            error: "Content Security Policy blocked script execution",
                            cspBlocked: true,
                            suggestion: "This site blocks script injection. Try using specific tools instead."
                        };
                    }

                    // Handle permission errors
                    if (errorMsg.includes('Cannot access') || errorMsg.includes('permissions')) {
                        log.warn('[Tool] Permission error', { error: errorMsg });
                        return {
                            success: false,
                            error: "Permission denied - cannot access this page",
                            permissionDenied: true,
                            suggestion: "Extension cannot access chrome:// pages or some restricted sites."
                        };
                    }

                    // Generic error
                    log.error('[Tool] Error executing script:', error);
                    return {
                        success: false,
                        error: `Failed to execute script: ${errorMsg}`,
                        suggestion: "Check if the page is accessible and code is valid."
                    };
                }
            },
        });

        log.info('✅ executeScript tool registration complete');

        return () => {
            log.info('🧹 Cleaning up executeScript tool');
            unregisterToolUI('executeScript');
        };
    }, [registerToolUI, unregisterToolUI]);
}
