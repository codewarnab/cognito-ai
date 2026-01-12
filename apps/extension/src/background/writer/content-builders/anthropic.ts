/**
 * Anthropic Content Builder
 * 
 * Builds message content for Anthropic/Claude API multimodal requests.
 * Supports text, images, and documents (PDFs).
 * 
 * @module writer/content-builders/anthropic
 */

import type { WriterOptions, AnthropicContentPart } from '../core/types';

/**
 * Builds message content array for Anthropic/Claude multimodal requests.
 * 
 * Claude supports:
 * - Images: Use type: 'image' with base64 source
 * - PDFs: Use type: 'document' with base64 source
 * 
 * Per Claude best practice, attachments are placed before text content.
 * 
 * Note: Other file types (text/plain) are not natively supported by Claude.
 * 
 * @param {string} prompt - The text prompt
 * @param {WriterOptions} [options] - Writer options containing attachment info
 * @returns {AnthropicContentPart[]} Array of content parts for Anthropic message
 * 
 * @example
 * ```typescript
 * // Text only
 * const content = buildAnthropicMessageContent("Hello world");
 * // Returns: [{ type: 'text', text: 'Hello world' }]
 * 
 * // With image (attachment comes first per Claude best practice)
 * const content = buildAnthropicMessageContent("Describe this", {
 *   attachment: {
 *     base64Data: "...",
 *     mimeType: "image/png",
 *     fileName: "image.png",
 *     fileSize: 1024
 *   }
 * });
 * // Returns: [{ type: 'image', source: {...} }, { type: 'text', text: '...' }]
 * ```
 * 
 * @see https://platform.claude.com/docs/en/build-with-claude/vision
 * @see https://platform.claude.com/docs/en/build-with-claude/pdf-support
 */
export function buildAnthropicMessageContent(
    prompt: string,
    options?: WriterOptions
): AnthropicContentPart[] {
    const content: AnthropicContentPart[] = [];

    // Claude best practice: attachments should come before text
    if (options?.attachment) {
        if (options.attachment.mimeType.startsWith('image/')) {
            // Image attachments - use image format with base64 source
            content.push({
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: options.attachment.mimeType,
                    data: options.attachment.base64Data
                }
            });
        } else if (options.attachment.mimeType === 'application/pdf') {
            // PDF attachments - use document format with base64 source
            content.push({
                type: 'document',
                source: {
                    type: 'base64',
                    media_type: 'application/pdf',
                    data: options.attachment.base64Data
                }
            });
        }
        // Note: Other file types (text/plain) are not supported by Claude
    }

    // Add text prompt after attachments
    content.push({ type: 'text', text: prompt });

    return content;
}
