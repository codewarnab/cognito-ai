/**
 * Message Processing Utility
 * 
 * Pre-processes messages to deduplicate consecutive assistant messages
 * with the same toolCallId. This is a workaround for an AI SDK v6 bug
 * where AbstractChat.makeRequest generates a new message ID, ignoring
 * the messageId parameter passed from addToolOutput, causing pushMessage
 * instead of replaceMessage.
 * 
 * NOTE: We no longer merge user tool-result messages as that was causing
 * issues with subsequent tool calls.
 */

import type { Message } from '../../../../types';
import { hasToolCalls } from '../../../../utils';
import { createLogger } from '~logger';

const log = createLogger('ProcessMessages', 'UI_CHAT');

/**
 * Extract tool identifiers from a message
 * 
 * Supports both AI SDK format (toolCallId) and Gemini format (functionCall.name)
 * 
 * @param message - Message to extract tool IDs from
 * @returns Set of unique tool identifiers
 */
function getToolIdentifiers(message: Message): Set<string> {
    const ids = new Set<string>();
    if (!message.parts) return ids;

    message.parts.forEach((part: any) => {
        // AI SDK format: uses toolCallId directly
        if (part.toolCallId) {
            ids.add(part.toolCallId);
        }
        // Gemini format: uses functionCall.name as fallback
        // Create a composite key to avoid collisions between different calls
        if (part.functionCall?.name && !part.toolCallId) {
            const argsStr = JSON.stringify(part.functionCall.args || {});
            ids.add(`gemini:${part.functionCall.name}:${argsStr.substring(0, 50)}`);
        }
    });

    return ids;
}

/**
 * Check if two messages are exact duplicates (same tool calls)
 * 
 * Returns true ONLY if they have exactly the same tools,
 * not just overlapping tools.
 * 
 * @param m1 - First message to compare
 * @param m2 - Second message to compare
 * @returns True if messages have exactly the same tool calls
 */
function areDuplicateToolMessages(m1: Message, m2: Message): boolean {
    const ids1 = getToolIdentifiers(m1);
    const ids2 = getToolIdentifiers(m2);

    // Must have same number of tool calls
    if (ids1.size !== ids2.size || ids1.size === 0) return false;

    // All IDs must match
    for (const id of ids1) {
        if (!ids2.has(id)) return false;
    }
    return true;
}

/**
 * Check if a tool part has output (completed state)
 * 
 * @param part - Tool part to check
 * @returns True if tool execution is complete
 */
function hasToolOutput(part: any): boolean {
    return part.state === 'output-available' ||
        part.state === 'result' ||
        part.output !== undefined ||
        part.functionResponse !== undefined;
}

/**
 * Merge two assistant messages with matching tool calls
 * 
 * The newer message's parts take precedence for completed tool calls,
 * while preserving tool inputs from the older message.
 * 
 * @param older - The earlier message in the conversation
 * @param newer - The later message in the conversation
 * @returns Merged message with combined parts
 */
function mergeAssistantMessages(older: Message, newer: Message): Message {
    const olderParts = older.parts || [];
    const newerParts = newer.parts || [];

    // Create a map of toolCallId -> newer part (with output)
    const newerToolParts = new Map<string, any>();
    newerParts.forEach((part: any) => {
        if (part.toolCallId && hasToolOutput(part)) {
            newerToolParts.set(part.toolCallId, part);
        }
    });

    // Merge: use newer parts where available, otherwise keep older parts
    const mergedParts = olderParts.map((part: any) => {
        if (part.toolCallId && newerToolParts.has(part.toolCallId)) {
            return newerToolParts.get(part.toolCallId);
        }
        return part;
    });

    // Add any text parts from newer message that aren't already present
    newerParts.forEach((part: any) => {
        if (part.type === 'text' && part.text?.trim()) {
            const hasText = mergedParts.some((p: any) =>
                p.type === 'text' && p.text === part.text
            );
            if (!hasText) {
                mergedParts.push(part);
            }
        }
    });

    return {
        ...older,
        parts: mergedParts
    };
}

/**
 * Process messages to deduplicate assistant messages with duplicate tool calls
 * 
 * This function handles the AI SDK v6 bug workaround by:
 * 1. Detecting consecutive assistant messages with identical tool calls
 * 2. Merging them into a single message with the most recent state
 * 3. Preserving tool inputs while updating with tool outputs
 * 
 * @param messages - Raw messages array from chat store
 * @returns Processed messages with duplicates merged
 */
export function processMessages(messages: Message[]): Message[] {
    const result: Message[] = [];
    const skipIds = new Set<string>();

    log.debug('[DEDUP] Processing messages', { count: messages.length });

    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];

        // Skip null/undefined messages
        if (!msg) continue;

        // Skip messages already marked for skipping
        if (msg.id && skipIds.has(msg.id)) {
            log.debug(`[DEDUP] Skipping message ${i}`, { id: msg.id, reason: 'already processed' });
            continue;
        }

        const hasToolCallsResult = hasToolCalls(msg);
        log.debug(`[DEDUP] Message ${i}`, { role: msg.role, hasTools: hasToolCallsResult, id: msg.id });

        // Only deduplicate assistant messages with tool calls
        if (msg.role === 'assistant' && hasToolCallsResult) {
            // Look ahead for potential duplicates
            // (AI SDK v6 bug creates duplicate assistant messages)
            if (i + 1 < messages.length) {
                const nextMsg = messages[i + 1];

                // ONLY merge if next is ALSO an assistant message with EXACTLY the same tools
                // This handles the duplicate bug where the same tool call appears twice
                if (nextMsg && nextMsg.role === 'assistant' && hasToolCalls(nextMsg)) {
                    if (areDuplicateToolMessages(msg, nextMsg)) {
                        log.debug('[DEDUP] ✓ Found exact duplicate, merging', {
                            olderId: msg.id,
                            newerId: nextMsg.id,
                            toolIds: Array.from(getToolIdentifiers(msg))
                        });

                        // Merge the messages, newer takes precedence for completed tools
                        const mergedMsg = mergeAssistantMessages(msg, nextMsg);
                        result.push(mergedMsg);

                        // Skip the duplicate in next iteration
                        if (nextMsg.id) {
                            skipIds.add(nextMsg.id);
                        }
                        continue;
                    } else {
                        log.debug('[DEDUP] ✗ Not duplicates - different tools', {
                            msg1Tools: Array.from(getToolIdentifiers(msg)),
                            msg2Tools: Array.from(getToolIdentifiers(nextMsg))
                        });
                    }
                }
            }
        }

        // Default: just push the message as-is
        result.push(msg);
    }

    log.debug('[DEDUP] Final result', { count: result.length, skipped: Array.from(skipIds) });
    return result;
}
