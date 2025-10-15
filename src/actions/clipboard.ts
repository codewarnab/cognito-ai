import { createLogger } from "../logger";
import { injectContent } from "./primitives";

const log = createLogger("Actions-Clipboard");

export interface ClipboardReadOptions {
    type?: 'text' | 'html';
}

export interface ClipboardReadResult {
    success: boolean;
    text?: string;
    html?: string;
    error?: string;
}

export interface ClipboardWriteData {
    text?: string;
    html?: string;
}

export interface ClipboardWriteResult {
    success: boolean;
    error?: string;
}

/**
 * Read from clipboard (requires permission)
 */
export async function readClipboard(
    tabId: number,
    options: ClipboardReadOptions = {}
): Promise<ClipboardReadResult> {
    const { type = 'text' } = options;

    try {
        log.info("readClipboard", { tabId, type });

        // Try using navigator.clipboard in page context
        const result = await injectContent<Promise<ClipboardReadResult>>(
            tabId,
            async (clipType: string): Promise<ClipboardReadResult> => {
                try {
                    if (!navigator.clipboard) {
                        return { success: false, error: "Clipboard API not available" };
                    }

                    if (clipType === 'text' || !clipType) {
                        const text = await navigator.clipboard.readText();
                        return { success: true, text };
                    }

                    if (clipType === 'html') {
                        const clipboardItems = await navigator.clipboard.read();
                        for (const item of clipboardItems) {
                            if (item.types.includes('text/html')) {
                                const blob = await item.getType('text/html');
                                const html = await blob.text();
                                return { success: true, html };
                            }
                        }
                        return { success: false, error: "No HTML content in clipboard" };
                    }

                    return { success: false, error: `Unsupported type: ${clipType}` };
                } catch (error) {
                    return {
                        success: false,
                        error: `Clipboard read failed: ${(error as Error).message}`
                    };
                }
            },
            [type]
        );

        // Await the result if it's a Promise
        const finalResult = await result;

        return finalResult;
    } catch (error) {
        log.error("Error reading clipboard:", error);
        return {
            success: false,
            error: `Failed to read clipboard: ${(error as Error).message}`
        };
    }
}

/**
 * Write to clipboard (requires permission)
 */
export async function writeClipboard(
    tabId: number,
    data: ClipboardWriteData
): Promise<ClipboardWriteResult> {
    try {
        log.info("writeClipboard", { tabId, hasText: !!data.text, hasHtml: !!data.html });

        // Try using navigator.clipboard in page context
        const result = await injectContent<Promise<ClipboardWriteResult>>(
            tabId,
            async (clipData: ClipboardWriteData): Promise<ClipboardWriteResult> => {
                try {
                    if (!navigator.clipboard) {
                        return { success: false, error: "Clipboard API not available" };
                    }

                    if (clipData.text && !clipData.html) {
                        await navigator.clipboard.writeText(clipData.text);
                        return { success: true };
                    }

                    if (clipData.html || (clipData.text && clipData.html)) {
                        const clipboardItem = new ClipboardItem({
                            'text/plain': new Blob([clipData.text || ''], { type: 'text/plain' }),
                            'text/html': new Blob([clipData.html || ''], { type: 'text/html' }),
                        });
                        await navigator.clipboard.write([clipboardItem]);
                        return { success: true };
                    }

                    return { success: false, error: "No data to write" };
                } catch (error) {
                    return {
                        success: false,
                        error: `Clipboard write failed: ${(error as Error).message}`
                    };
                }
            },
            [data]
        );

        const finalResult = await result;
        return finalResult;
    } catch (error) {
        log.error("Error writing to clipboard:", error);
        return {
            success: false,
            error: `Failed to write to clipboard: ${(error as Error).message}`
        };
    }
}
