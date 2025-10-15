import { createLogger } from "../logger";

const log = createLogger("Actions-Debugger");

// Mutex to prevent concurrent debugger operations on same tab
const tabMutexes = new Map<number, Promise<void>>();

export interface DebuggerEvaluateOptions {
    returnByValue?: boolean;
    awaitPromise?: boolean;
}

export interface DebuggerEvaluateResult {
    success: boolean;
    result?: any;
    error?: string;
}

export interface DebuggerSnapshotOptions {
    selector?: string;
    includeScreenshot?: boolean;
}

export interface DebuggerSnapshotResult {
    success: boolean;
    markup?: string;
    screenshot?: string;
    error?: string;
}

/**
 * Execute a function with debugger attached, ensuring proper cleanup
 */
export async function withDebugger<T>(
    tabId: number,
    fn: () => Promise<T>
): Promise<T> {
    // Wait for any existing operations on this tab
    while (tabMutexes.has(tabId)) {
        await tabMutexes.get(tabId);
    }

    // Create new mutex
    let resolveMutex: () => void;
    const mutexPromise = new Promise<void>((resolve) => {
        resolveMutex = resolve;
    });
    tabMutexes.set(tabId, mutexPromise);

    try {
        log.info("Attaching debugger", { tabId });

        // Check if already attached
        const targets = await chrome.debugger.getTargets();
        const isAttached = targets.some(
            (t) => t.tabId === tabId && t.attached
        );

        if (!isAttached) {
            await chrome.debugger.attach({ tabId }, "1.3");
        }

        // Enable required domains
        await chrome.debugger.sendCommand({ tabId }, "Page.enable");
        await chrome.debugger.sendCommand({ tabId }, "DOM.enable");
        await chrome.debugger.sendCommand({ tabId }, "Network.enable");

        // Execute the function
        const result = await fn();

        return result;
    } finally {
        // Clean up
        try {
            await chrome.debugger.detach({ tabId });
            log.info("Detached debugger", { tabId });
        } catch (error) {
            log.warn("Error detaching debugger (may already be detached):", error);
        }

        // Release mutex
        tabMutexes.delete(tabId);
        resolveMutex!();
    }
}

/**
 * Evaluate JavaScript expression in the page context
 */
export async function evaluate(
    tabId: number,
    expression: string,
    options: DebuggerEvaluateOptions = {}
): Promise<DebuggerEvaluateResult> {
    const { returnByValue = true, awaitPromise = true } = options;

    try {
        log.info("evaluate", { tabId, expressionLength: expression.length });

        const result = await withDebugger(tabId, async () => {
            const response = await chrome.debugger.sendCommand(
                { tabId },
                "Runtime.evaluate",
                {
                    expression,
                    returnByValue,
                    awaitPromise,
                }
            ) as any;

            if (response.exceptionDetails) {
                throw new Error(
                    `Evaluation exception: ${response.exceptionDetails.text}`
                );
            }

            return response.result.value;
        });

        return { success: true, result };
    } catch (error) {
        log.error("Error evaluating expression:", error);
        return {
            success: false,
            error: `Evaluation failed: ${(error as Error).message}`,
        };
    }
}

/**
 * Capture DOM snapshot with optional screenshot
 */
export async function snapshotDOM(
    tabId: number,
    options: DebuggerSnapshotOptions = {}
): Promise<DebuggerSnapshotResult> {
    const { selector, includeScreenshot = false } = options;

    try {
        log.info("snapshotDOM", { tabId, selector, includeScreenshot });

        const result = await withDebugger(tabId, async () => {
            let markup: string;

            if (selector) {
                // Get specific element
                const doc = await chrome.debugger.sendCommand(
                    { tabId },
                    "DOM.getDocument"
                ) as any;

                const node = await chrome.debugger.sendCommand(
                    { tabId },
                    "DOM.querySelector",
                    {
                        nodeId: doc.root.nodeId,
                        selector,
                    }
                ) as any;

                if (!node.nodeId) {
                    throw new Error(`Element not found: ${selector}`);
                }

                const outerHTML = await chrome.debugger.sendCommand(
                    { tabId },
                    "DOM.getOuterHTML",
                    {
                        nodeId: node.nodeId,
                    }
                ) as any;

                markup = outerHTML.outerHTML;
            } else {
                // Get entire document
                const doc = await chrome.debugger.sendCommand(
                    { tabId },
                    "DOM.getDocument"
                ) as any;

                const outerHTML = await chrome.debugger.sendCommand(
                    { tabId },
                    "DOM.getOuterHTML",
                    {
                        nodeId: doc.root.nodeId,
                    }
                ) as any;

                markup = outerHTML.outerHTML;
            }

            let screenshot: string | undefined;
            if (includeScreenshot) {
                const screenshotData = await chrome.debugger.sendCommand(
                    { tabId },
                    "Page.captureScreenshot",
                    {
                        format: "png",
                    }
                ) as any;

                screenshot = `data:image/png;base64,${screenshotData.data}`;
            }

            return { markup, screenshot };
        });

        return { success: true, ...result };
    } catch (error) {
        log.error("Error capturing DOM snapshot:", error);
        return {
            success: false,
            error: `Snapshot failed: ${(error as Error).message}`,
        };
    }
}

/**
 * Set file input files using debugger (for file uploads)
 */
export async function setFileInputFiles(
    tabId: number,
    selector: string,
    files: string[]
): Promise<{ success: boolean; error?: string }> {
    try {
        log.info("setFileInputFiles", { tabId, selector, fileCount: files.length });

        await withDebugger(tabId, async () => {
            const doc = await chrome.debugger.sendCommand(
                { tabId },
                "DOM.getDocument"
            ) as any;

            const node = await chrome.debugger.sendCommand(
                { tabId },
                "DOM.querySelector",
                {
                    nodeId: doc.root.nodeId,
                    selector,
                }
            ) as any;

            if (!node.nodeId) {
                throw new Error(`File input not found: ${selector}`);
            }

            await chrome.debugger.sendCommand(
                { tabId },
                "DOM.setFileInputFiles",
                {
                    nodeId: node.nodeId,
                    files,
                }
            );
        });

        return { success: true };
    } catch (error) {
        log.error("Error setting file input files:", error);
        return {
            success: false,
            error: `Failed to set files: ${(error as Error).message}`,
        };
    }
}

/**
 * Get all active debugger attachments
 */
export async function getActiveAttachments(): Promise<
    Array<{ tabId: number }>
> {
    try {
        const targets = await chrome.debugger.getTargets();
        return targets
            .filter((t) => t.attached && t.tabId !== undefined)
            .map((t) => ({ tabId: t.tabId! }));
    } catch (error) {
        log.error("Error getting active attachments:", error);
        return [];
    }
}

/**
 * Detach all debuggers (cleanup utility)
 */
export async function detachAll(): Promise<void> {
    try {
        const attachments = await getActiveAttachments();
        for (const { tabId } of attachments) {
            try {
                await chrome.debugger.detach({ tabId });
                log.info("Detached debugger from tab", { tabId });
            } catch (error) {
                log.warn("Error detaching from tab:", { tabId, error });
            }
        }
    } catch (error) {
        log.error("Error detaching all:", error);
    }
}
