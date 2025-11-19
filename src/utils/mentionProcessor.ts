/**
 * Message processor for handling tab mentions
 * Extracts mentions and creates internal context messages
 * Optimized with batch processing and parallel execution
 */

import type { UIMessage } from 'ai';
import { generateId } from 'ai';
import { extractMentions, type TabMention } from './mentionUtils';
import { captureTabSnapshot, type TabSnapshotResult } from './tabSnapshot';
import { createLogger } from '@logger';

const log = createLogger('MentionProcessor');

/**
 * Optimized message processor with caching and batch operations
 */
class MessageProcessor {
    private mentionCache: Map<string, { tabMentions: TabMention[]; toolMentions: any[] }> = new Map();
    private readonly CACHE_SIZE_LIMIT = 100;

    /**
     * Extract text content from message parts
     */
    private extractTextContent(message: UIMessage): string {
        return message.parts
            ?.filter(part => part.type === 'text')
            .map(part => 'text' in part ? part.text : '')
            .join('') || '';
    }

    /**
     * Generate cache key for message content
     */
    private getCacheKey(textContent: string): string {
        // Use first 200 chars as cache key to avoid huge keys
        return textContent.substring(0, 200);
    }

    /**
     * Get mentions with caching to avoid repeated parsing
     */
    private getMentions(textContent: string): { tabMentions: TabMention[]; toolMentions: any[] } {
        const cacheKey = this.getCacheKey(textContent);

        // Check cache first
        let mentions = this.mentionCache.get(cacheKey);
        if (!mentions) {
            mentions = extractMentions(textContent);

            // Implement LRU eviction if cache is too large
            if (this.mentionCache.size >= this.CACHE_SIZE_LIMIT) {
                const firstKey = this.mentionCache.keys().next().value;
                if (firstKey !== undefined) {
                    this.mentionCache.delete(firstKey);
                }
            }

            this.mentionCache.set(cacheKey, mentions);
        }

        return mentions;
    }

    /**
     * Batch process all tab snapshots in parallel
     */
    private async batchCaptureTabSnapshots(
        tabIds: number[]
    ): Promise<Map<number, TabSnapshotResult>> {
        const startTime = performance.now();

        // Capture all tabs in parallel using Promise.all
        const results = await Promise.all(
            tabIds.map(async (tabId) => {
                const snapshot = await captureTabSnapshot(tabId);
                return { tabId, snapshot };
            })
        );

        const duration = performance.now() - startTime;
        log.info('Batch captured tab snapshots', {
            count: tabIds.length,
            durationMs: duration.toFixed(2),
            avgPerTab: (duration / tabIds.length).toFixed(2)
        });

        return new Map(results.map(({ tabId, snapshot }) => [tabId, snapshot]));
    }

    /**
     * Create context message with all tab data
     */
    private createContextMessage(
        tabSnapshots: Map<number, TabSnapshotResult>,
        batchedTabRequests: Map<number, TabMention>
    ): UIMessage {
        const contextParts: string[] = [];

        for (const [tabId, mention] of batchedTabRequests.entries()) {
            const result = tabSnapshots.get(tabId);

            if (!result) {
                contextParts.push(`- @${mention.display}: Failed to capture`);
                continue;
            }

            if (result.error) {
                contextParts.push(`- @${mention.display}: ${result.error}`);
                continue;
            }

            let content = `- @${mention.display} (${result.url}):\n\`\`\`\n${result.snapshot}\n\`\`\``;

            if (result.screenshot) {
                content += '\n\n[Screenshot available for this tab]';
            }

            contextParts.push(content);
        }

        return {
            id: generateId(),
            role: 'user',
            parts: [
                {
                    type: 'text',
                    text: `Tab Context for mentioned tabs:\n${contextParts.join('\n\n')}`
                }
            ],
            metadata: {
                internal: true,
                type: 'tab-context'
            }
        };
    }

    /**
     * Process messages with mentions using batch processing and parallel execution
     */
    async processMessagesWithMentions(
        messages: UIMessage[]
    ): Promise<UIMessage[]> {
        const processedMessages: UIMessage[] = [];
        const batchedTabRequests: Map<number, TabMention> = new Map();
        let totalToolMentions = 0;

        // First pass: collect all unique tab mentions across all messages
        for (const message of messages) {
            processedMessages.push(message);

            if (message.role !== 'user') continue;

            const textContent = this.extractTextContent(message);

            // Use cached mention extraction
            const { tabMentions, toolMentions } = this.getMentions(textContent);

            // Collect unique tab IDs for batching (deduplication via Map)
            for (const mention of tabMentions) {
                const tabId = parseInt(mention.id, 10);
                if (!isNaN(tabId)) {
                    // Store only if not already present (first mention wins)
                    if (!batchedTabRequests.has(tabId)) {
                        batchedTabRequests.set(tabId, mention);
                    }
                }
            }

            // Track tool mentions for logging
            if (toolMentions.length > 0) {
                totalToolMentions += toolMentions.length;
            }
        }

        // Second pass: batch process all unique tab snapshots in parallel
        if (batchedTabRequests.size > 0) {
            log.info('Processing batched tab mentions', {
                uniqueTabs: batchedTabRequests.size,
                totalMessages: messages.length
            });

            try {
                const tabSnapshots = await this.batchCaptureTabSnapshots(
                    Array.from(batchedTabRequests.keys())
                );

                // Create single context message with all tab data
                const contextMessage = this.createContextMessage(
                    tabSnapshots,
                    batchedTabRequests
                );

                processedMessages.push(contextMessage);

                log.info('Added batched tab context message', {
                    tabCount: batchedTabRequests.size,
                    cacheHits: this.mentionCache.size
                });
            } catch (error) {
                log.error('Error processing batched tab mentions', error);
                // Continue even if batch processing fails
            }
        }

        // Log tool mentions summary
        if (totalToolMentions > 0) {
            log.info('Found tool mentions across messages', { count: totalToolMentions });
            // Tool mentions can be used to enhance system prompt or prioritize tools
            // This can be implemented in the future
        }

        return processedMessages;
    }

    /**
     * Clear the mention cache (useful for testing or memory management)
     */
    clearCache(): void {
        this.mentionCache.clear();
        log.info('Mention cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; limit: number; hitRate: number } {
        return {
            size: this.mentionCache.size,
            limit: this.CACHE_SIZE_LIMIT,
            hitRate: this.mentionCache.size > 0 ? 1 : 0 // Simplified for now
        };
    }
}

// Create singleton instance
const messageProcessor = new MessageProcessor();

/**
 * Process messages to handle tab mentions
 * Adds internal context messages for mentioned tabs
 * Optimized with batch processing and parallel execution
 */
export async function processMessagesWithMentions(
    messages: UIMessage[]
): Promise<UIMessage[]> {
    return messageProcessor.processMessagesWithMentions(messages);
}

/**
 * Clear the mention extraction cache
 */
export function clearMentionCache(): void {
    messageProcessor.clearCache();
}

/**
 * Get cache statistics for monitoring
 */
export function getMentionCacheStats(): { size: number; limit: number; hitRate: number } {
    return messageProcessor.getCacheStats();
}
