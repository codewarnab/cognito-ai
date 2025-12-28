/**
 * Message Sanitizer for Backend Chat
 * 
 * Fixes malformed conversation structures before sending to backend.
 */

import type { ModelMessage } from 'ai';
import { createLogger } from '~logger';

const log = createLogger('MessageSanitizer', 'AI_CHAT_BACKEND');

/**
 * Sanitize messages to fix malformed conversation structure.
 * 
 * Problem: When UIMessages are converted to ModelMessages, an assistant message may contain
 * both tool-calls AND text responses that were generated AFTER the tool result was received.
 * If the tool result is in a separate 'tool' role message at the end, this creates an invalid
 * structure where the AI thinks it already responded to the tool result, causing a loop.
 * 
 * Solution: If the last message is a 'tool' role message (pending tool result), remove any
 * text content from the preceding assistant message that appears AFTER tool-call parts.
 * This ensures the AI sees: user -> assistant(tool-call) -> tool(result)
 * Instead of: user -> assistant(tool-call + text + text + text) -> tool(result)
 */
export function sanitizeMessagesForBackend(messages: ModelMessage[]): ModelMessage[] {
    if (messages.length < 2) return messages;

    const lastMessage = messages[messages.length - 1];
    const secondLastMessage = messages[messages.length - 2];

    // Null safety checks
    if (!lastMessage || !secondLastMessage) return messages;

    // Check if we have the problematic pattern:
    // secondLastMessage is 'assistant' with tool-calls AND text
    // lastMessage is 'tool' (pending tool result)
    if (lastMessage.role !== 'tool' || secondLastMessage.role !== 'assistant') {
        return messages;
    }

    // Check if assistant message has content array
    const assistantContent = secondLastMessage.content;
    if (!Array.isArray(assistantContent)) {
        return messages;
    }

    // Find if there are both tool-calls and text parts
    const hasToolCalls = assistantContent.some((part: any) => part.type === 'tool-call');
    const hasTextAfterToolCall = (() => {
        let seenToolCall = false;
        for (const part of assistantContent as any[]) {
            if (part.type === 'tool-call') {
                seenToolCall = true;
            } else if (part.type === 'text' && seenToolCall) {
                return true;
            }
        }
        return false;
    })();

    if (!hasToolCalls || !hasTextAfterToolCall) {
        return messages;
    }

    log.warn('🔧 Detected malformed message structure - removing text after tool-calls from assistant message', {
        originalPartCount: assistantContent.length,
    });

    // Filter out text parts that come AFTER tool-call parts
    let seenToolCall = false;
    const cleanedContent = (assistantContent as any[]).filter((part: any) => {
        if (part.type === 'tool-call') {
            seenToolCall = true;
            return true;
        }
        // Keep text parts that come BEFORE the first tool-call
        if (part.type === 'text' && !seenToolCall) {
            return true;
        }
        // Remove text parts that come AFTER tool-calls
        if (part.type === 'text' && seenToolCall) {
            log.info('🗑️ Removing post-tool-call text from assistant message:', {
                textLength: part.text?.length || 0,
                preview: (part.text || '').substring(0, 50) + '...',
            });
            return false;
        }
        // Keep other part types
        return true;
    });

    log.info('✅ Cleaned message structure', {
        originalPartCount: assistantContent.length,
        cleanedPartCount: cleanedContent.length,
    });

    // Return sanitized messages - cast to ModelMessage to ensure type safety
    const cleanedAssistantMessage: ModelMessage = {
        ...secondLastMessage,
        content: cleanedContent,
    } as ModelMessage;

    return [
        ...messages.slice(0, -2),
        cleanedAssistantMessage,
        lastMessage,
    ];
}
