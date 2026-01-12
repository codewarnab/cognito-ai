/**
 * Gemini Content Builder
 * 
 * Builds request parts for Google Gemini API multimodal content.
 * Supports text and inline binary data (images, documents).
 * 
 * @module writer/content-builders/gemini
 */

import type { WriterOptions, GeminiRequestPart } from '../core/types';

/**
 * Builds request parts for Gemini API multimodal content.
 * 
 * Per Gemini best practices, attachments are placed before text content.
 * Supports images and documents (PDFs) via inline base64 data.
 * 
 * @param {string} prompt - The text prompt
 * @param {WriterOptions} [options] - Writer options containing attachment info
 * @returns {GeminiRequestPart[]} Array of request parts for Gemini API
 * 
 * @example
 * ```typescript
 * const parts = buildGeminiRequestParts("Describe this image", {
 *   attachment: {
 *     base64Data: "...",
 *     mimeType: "image/png",
 *     fileName: "screenshot.png",
 *     fileSize: 1024
 *   }
 * });
 * // Returns: [{ inlineData: { mimeType: "image/png", data: "..." } }, { text: "Describe this image" }]
 * ```
 * 
 * @see https://ai.google.dev/gemini-api/docs/vision
 */
export function buildGeminiRequestParts(
    prompt: string,
    options?: WriterOptions
): GeminiRequestPart[] {
    const parts: GeminiRequestPart[] = [];

    // Add attachment first (before text, per Gemini best practices)
    if (options?.attachment) {
        parts.push({
            inlineData: {
                mimeType: options.attachment.mimeType,
                data: options.attachment.base64Data,
            },
        });
    }

    // Add text prompt
    parts.push({ text: prompt });

    return parts;
}
