import { createLogger } from "../logger";
import { injectContent } from "./primitives";

const log = createLogger("Actions-Media");

export interface CaptureTabOptions {
    format?: 'png' | 'jpeg';
    quality?: number; // 0-100, for jpeg only
}

export interface CaptureTabResult {
    success: boolean;
    dataUrl?: string;
    error?: string;
}

export interface CaptureElementResult {
    success: boolean;
    dataUrl?: string;
    error?: string;
}

export interface OcrResult {
    success: boolean;
    text?: string;
    confidence?: number;
    error?: string;
}

/**
 * Capture visible tab as image
 */
export async function captureTab(
    tabId: number,
    options: CaptureTabOptions = {}
): Promise<CaptureTabResult> {
    const { format = 'png', quality = 90 } = options;

    try {
        log.info("captureTab", { tabId, format, quality });

        const dataUrl = await chrome.tabs.captureVisibleTab(undefined, {
            format: format as 'png' | 'jpeg',
            quality: format === 'jpeg' ? quality : undefined,
        });

        return { success: true, dataUrl };
    } catch (error) {
        log.error("Error capturing tab:", error);
        return {
            success: false,
            error: `Failed to capture tab: ${(error as Error).message}`,
        };
    }
}

/**
 * Capture specific element as image
 */
export async function captureElement(
    tabId: number,
    selector: string
): Promise<CaptureElementResult> {
    try {
        log.info("captureElement", { tabId, selector });

        // Get element bounding box
        const rectResult = await injectContent<{
            success: boolean;
            rect?: DOMRect;
            error?: string;
        }>(
            tabId,
            (sel: string) => {
                const element = document.querySelector(sel);
                if (!element) {
                    return { success: false, error: `Element not found: ${sel}` };
                }

                const rect = element.getBoundingClientRect();
                return {
                    success: true,
                    rect: {
                        x: rect.x,
                        y: rect.y,
                        width: rect.width,
                        height: rect.height,
                        top: rect.top,
                        right: rect.right,
                        bottom: rect.bottom,
                        left: rect.left,
                    } as DOMRect,
                };
            },
            [selector]
        );

        if (!rectResult.success || !rectResult.rect) {
            return { success: false, error: rectResult.error || "Failed to get element bounds" };
        }

        // Capture full tab
        const fullCapture = await captureTab(tabId, { format: 'png' });
        if (!fullCapture.success || !fullCapture.dataUrl) {
            return { success: false, error: "Failed to capture tab" };
        }

        // Crop to element bounds using canvas
        const croppedDataUrl = await cropImage(
            fullCapture.dataUrl,
            rectResult.rect
        );

        return { success: true, dataUrl: croppedDataUrl };
    } catch (error) {
        log.error("Error capturing element:", error);
        return {
            success: false,
            error: `Failed to capture element: ${(error as Error).message}`,
        };
    }
}

/**
 * Crop image to specified bounds
 */
async function cropImage(dataUrl: string, rect: DOMRect): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = new OffscreenCanvas(rect.width, rect.height);
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error("Failed to get canvas context"));
                return;
            }

            ctx.drawImage(
                img,
                rect.x,
                rect.y,
                rect.width,
                rect.height,
                0,
                0,
                rect.width,
                rect.height
            );

            canvas.convertToBlob({ type: 'image/png' }).then((blob) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error("Failed to read cropped image"));
                reader.readAsDataURL(blob);
            });
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = dataUrl;
    });
}

/**
 * Perform OCR on image (using Tesseract WASM)
 * Note: This is a placeholder - Tesseract would need to be properly integrated
 */
export async function ocrImage(
    dataUrl: string,
    options: { lang?: string } = {}
): Promise<OcrResult> {
    const { lang = 'eng' } = options;

    try {
        log.info("ocrImage", { lang, dataUrlLength: dataUrl.length });

        // TODO: Integrate Tesseract.js WASM
        // For now, return a placeholder response
        log.warn("OCR not yet implemented - Tesseract.js integration needed");

        return {
            success: false,
            error: "OCR functionality not yet implemented. Tesseract.js WASM integration required.",
        };

        /* Future implementation:
        const worker = await Tesseract.createWorker();
        await worker.loadLanguage(lang);
        await worker.initialize(lang);
        
        const { data } = await worker.recognize(dataUrl);
        await worker.terminate();
        
        return {
          success: true,
          text: data.text,
          confidence: data.confidence,
        };
        */
    } catch (error) {
        log.error("Error performing OCR:", error);
        return {
            success: false,
            error: `OCR failed: ${(error as Error).message}`,
        };
    }
}
