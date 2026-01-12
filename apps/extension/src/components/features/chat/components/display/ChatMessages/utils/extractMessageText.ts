/**
 * Message Text Extraction Utility
 * 
 * Extracts plain text content from chat messages for copying,
 * quoting, or other text-based operations.
 */

import type { Message } from '../../../../types';

/**
 * Extract text content from a message for copying
 * 
 * Filters message parts to find text-type parts and joins them
 * together with double newlines for proper paragraph separation.
 * 
 * @param message - The message to extract text from
 * @returns Combined text content from all text parts
 * 
 * @example
 * ```ts
 * const message = {
 *   parts: [
 *     { type: 'text', text: 'Hello' },
 *     { type: 'tool-call', ... },
 *     { type: 'text', text: 'World' }
 *   ]
 * };
 * extractMessageText(message); // "Hello\n\nWorld"
 * ```
 */
export function extractMessageText(message: Message): string {
    // Return empty string if no parts exist
    if (!message.parts || message.parts.length === 0) {
        return '';
    }

    // Filter to only text parts with actual content
    const textParts = message.parts
        .filter((part: any) => part.type === 'text' && part.text)
        .map((part: any) => part.text);

    // Join with double newlines for paragraph separation
    return textParts.join('\n\n');
}
