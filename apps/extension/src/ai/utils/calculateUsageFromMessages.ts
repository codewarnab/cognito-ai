import type { UIMessage } from 'ai';
import type { AppUsage } from '../types/usage';
import { createLogger } from '~logger';

const log = createLogger('calculateUsageFromMessages', 'AI_CHAT');

/**
 * Calculate cumulative usage from messages in memory
 * This is used to rebuild usage state from loaded messages
 */
export function calculateUsageFromMessages(messages: UIMessage[]): AppUsage | null {
    if (!messages || messages.length === 0) {
        log.info('No messages to calculate usage from');
        return null;
    }

    // Sum up all usage from messages
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

    let hasAnyUsage = false;

    for (const msg of messages) {
        // Check if message has usage data attached
        const msgUsage = (msg as any).usage;
        if (msgUsage) {
            hasAnyUsage = true;
            cumulative.inputTokens = (cumulative.inputTokens || 0) + (msgUsage.inputTokens || 0);
            cumulative.outputTokens = (cumulative.outputTokens || 0) + (msgUsage.outputTokens || 0);
            cumulative.totalTokens = (cumulative.totalTokens || 0) + (msgUsage.totalTokens || 0);

            // Sum details if available, or fall back to legacy fields
            const cacheTokens = (msgUsage.inputTokenDetails?.cacheReadTokens || msgUsage.cachedInputTokens || 0);
            const reasoningTokens = (msgUsage.outputTokenDetails?.reasoningTokens || msgUsage.reasoningTokens || 0);

            if (cumulative.inputTokenDetails) {
                cumulative.inputTokenDetails.cacheReadTokens = (cumulative.inputTokenDetails.cacheReadTokens || 0) + cacheTokens;
            }
            if (cumulative.outputTokenDetails) {
                cumulative.outputTokenDetails.reasoningTokens = (cumulative.outputTokenDetails.reasoningTokens || 0) + reasoningTokens;
            }

            // Copy context limits from last message with usage
            if (msgUsage.context) {
                cumulative.context = msgUsage.context;
            }

            // Copy model ID from last message with usage
            if (msgUsage.modelId) {
                cumulative.modelId = msgUsage.modelId;
            }
        }
    }

    if (!hasAnyUsage) {
        log.info('No usage data found in any message');
        return null;
    }

    log.info('✅ Calculated cumulative usage from messages', {
        totalMessages: messages.length,
        totalTokens: cumulative.totalTokens,
        hasContext: !!cumulative.context
    });

    return cumulative;
}

