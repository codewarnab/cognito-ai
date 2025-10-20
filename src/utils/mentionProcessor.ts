/**
 * Message processor for handling tab mentions
 * Extracts mentions and creates internal context messages
 */

import type { UIMessage } from 'ai';
import { generateId } from 'ai';
import { extractMentions } from './mentionUtils';
import { processMentionedTabs } from './tabSnapshot';
import { createLogger } from '../logger';

const log = createLogger('MentionProcessor');

/**
 * Process messages to handle tab mentions
 * Adds internal context messages for mentioned tabs
 */
export async function processMessagesWithMentions(
    messages: UIMessage[]
): Promise<UIMessage[]> {
    const processedMessages: UIMessage[] = [];

    for (const message of messages) {
        // Add the original message
        processedMessages.push(message);

        // Only process user messages
        if (message.role !== 'user') {
            continue;
        }

        // Extract text content from parts
        const textContent = message.parts
            ?.filter(part => part.type === 'text')
            .map(part => 'text' in part ? part.text : '')
            .join('') || '';

        // Extract mentions from the message
        const { tabMentions, toolMentions } = extractMentions(textContent);

        // Process tab mentions
        if (tabMentions.length > 0) {
            log.info('Found tab mentions', { count: tabMentions.length, mentions: tabMentions });

            try {
                // Capture tab snapshots
                const tabContext = await processMentionedTabs(tabMentions);

                // Create internal context message
                const contextMessage: UIMessage = {
                    id: generateId(),
                    role: 'user',
                    parts: [
                        {
                            type: 'text',
                            text: `Tab Context for mentioned tabs:\n${tabContext}`
                        }
                    ],
                    // Mark as internal so it doesn't show in UI
                    metadata: {
                        internal: true,
                        type: 'tab-context'
                    }
                };

                processedMessages.push(contextMessage);
                log.info('Added tab context message', { tabCount: tabMentions.length });
            } catch (error) {
                log.error('Error processing tab mentions', error);
                // Continue even if tab processing fails
            }
        }

        // Log tool mentions for system prompt enhancement
        if (toolMentions.length > 0) {
            log.info('Found tool mentions', { count: toolMentions.length, mentions: toolMentions });
            // Tool mentions can be used to enhance system prompt or prioritize tools
            // This can be implemented in the future
        }
    }

    return processedMessages;
}
