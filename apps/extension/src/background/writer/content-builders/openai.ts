/**
 * OpenAI Content Builder
 * 
 * Builds message content for OpenAI API multimodal requests.
 * Compatible with OpenAI Chat Completions API and xAI API.
 * 
 * @module writer/content-builders/openai
 */

import type { WriterOptions, OpenAIContentPart } from '../core/types';

/**
 * Builds message content array for OpenAI (and xAI) multimodal requests.
 * 
 * OpenAI supports:
 * - Images: Use type: 'image_url' with data URL
 * - PDFs: Use type: 'file' with base64 data
 * 
 * Note: Other file types (text/plain) are not natively supported by OpenAI.
 * They would need to be handled differently (e.g., extract text and include inline).
 * 
 * @param {string} prompt - The text prompt
 * @param {WriterOptions} [options] - Writer options containing attachment info
 * @returns {OpenAIContentPart[]} Array of content parts for OpenAI message
 * 
 * @example
 * ```typescript
 * // Text only
 * const content = buildOpenAIMessageContent("Hello world");
 * // Returns: [{ type: 'text', text: 'Hello world' }]
 * 
 * // With image
 * const content = buildOpenAIMessageContent("Describe this", {
 *   attachment: {
 *     base64Data: "...",
 *     mimeType: "image/png",
 *     fileName: "image.png",
 *     fileSize: 1024
 *   }
 * });
 * // Returns: [{ type: 'text', text: '...' }, { type: 'image_url', image_url: { url: '...' } }]
 * ```
 * 
 * @see https://platform.openai.com/docs/guides/images-vision
 * @see https://platform.openai.com/docs/guides/pdf-files
 */
export function buildOpenAIMessageContent(
    prompt: string,
    options?: WriterOptions
): OpenAIContentPart[] {
    const content: OpenAIContentPart[] = [{ type: 'text', text: prompt }];

    if (options?.attachment) {
        if (options.attachment.mimeType.startsWith('image/')) {
            // Image attachments - use image_url format
            content.push({
                type: 'image_url',
                image_url: {
                    url: `data:${options.attachment.mimeType};base64,${options.attachment.base64Data}`
                }
            });
        } else if (options.attachment.mimeType === 'application/pdf') {
            // PDF attachments - use input_file format
            // Note: This requires the Responses API or Chat Completions with file support
            content.push({
                type: 'file',
                file: {
                    filename: options.attachment.fileName,
                    file_data: `data:application/pdf;base64,${options.attachment.base64Data}`
                }
            });
        }
        // Note: Other file types (text/plain) are not supported by OpenAI
        // They would need to be handled differently (e.g., extract text and include inline)
    }

    return content;
}
