/**
 * Token Usage Tracking API
 */

import { db } from './database';
import { updateThreadTimestamp } from './threads';
import type { ChatMessage } from '~/types/database';
import type { AppUsage } from '~/types/ai/usage';

/**
 * Calculate cumulative usage for a thread
 * 
 * @param threadId - The thread ID to calculate usage for
 * @returns Cumulative AppUsage summing all messages, or null if no messages
 * 
 * @remarks
 * Sums up all usage metrics from all messages in the thread:
 * - inputTokens
 * - outputTokens
 * - totalTokens
 * - cachedInputTokens
 * - reasoningTokens
 * 
 * Context limits and modelId are copied from the last message with usage.
 */
export async function getThreadUsage(threadId: string): Promise<AppUsage | null> {
    const messages = await db.chatMessages
        .where('threadId')
        .equals(threadId)
        .toArray();

    if (messages.length === 0) return null;

    // Sum up all usage
    const cumulative: AppUsage = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        inputTokenDetails: {
            cacheReadTokens: 0,
            noCacheTokens: 0,
            cacheWriteTokens: 0,
        },
        outputTokenDetails: {
            reasoningTokens: 0,
            textTokens: 0,
        }
    };

    for (const msg of messages) {
        if (msg.usage) {
            cumulative.inputTokens = (cumulative.inputTokens || 0) + (msg.usage.inputTokens || 0);
            cumulative.outputTokens = (cumulative.outputTokens || 0) + (msg.usage.outputTokens || 0);
            cumulative.totalTokens = (cumulative.totalTokens || 0) + (msg.usage.totalTokens || 0);

            // Sum details if available, or fall back to legacy fields
            const cacheTokens = (msg.usage.inputTokenDetails?.cacheReadTokens || msg.usage.cachedInputTokens || 0);
            const reasoningTokens = (msg.usage.outputTokenDetails?.reasoningTokens || msg.usage.reasoningTokens || 0);

            if (cumulative.inputTokenDetails) {
                cumulative.inputTokenDetails.cacheReadTokens = (cumulative.inputTokenDetails.cacheReadTokens || 0) + cacheTokens;
            }
            if (cumulative.outputTokenDetails) {
                cumulative.outputTokenDetails.reasoningTokens = (cumulative.outputTokenDetails.reasoningTokens || 0) + reasoningTokens;
            }

            // Copy context limits from last message with usage
            if (msg.usage.context) {
                cumulative.context = msg.usage.context;
            }

            // Copy model ID from last message with usage
            if (msg.usage.modelId) {
                cumulative.modelId = msg.usage.modelId;
            }
        }
    }

    return cumulative;
}

/**
 * Update thread's last usage statistics
 * 
 * @param threadId - The thread ID to update
 * @param usage - Usage statistics to store
 * 
 * @remarks
 * Also updates the thread's updatedAt timestamp
 */
export async function updateThreadUsage(threadId: string, usage: AppUsage): Promise<void> {
    await db.chatThreads.update(threadId, {
        lastUsage: usage,
        updatedAt: Date.now()
    });
}

/**
 * Save chat message with usage information
 * 
 * @param message - Message data without id and timestamp
 * @param usage - Optional token usage statistics for this message
 * @returns The complete saved message with id and timestamp
 * 
 * @remarks
 * - Automatically generates UUID and timestamp
 * - Updates thread timestamp
 * - If usage is provided, also updates thread's lastUsage
 * - Uses transaction to ensure atomic updates
 */
export async function saveChatMessageWithUsage(
    message: Omit<ChatMessage, 'id' | 'timestamp'>,
    usage?: AppUsage
): Promise<ChatMessage> {
    const fullMessage: ChatMessage = {
        ...message,
        id: message.message.id || crypto.randomUUID(),
        timestamp: Date.now(),
        usage
    };
    await db.chatMessages.add(fullMessage);

    // Update thread timestamp and usage
    await db.transaction('rw', [db.chatThreads], async () => {
        await updateThreadTimestamp(message.threadId);
        if (usage) {
            await updateThreadUsage(message.threadId, usage);
        }
    });

    return fullMessage;
}
