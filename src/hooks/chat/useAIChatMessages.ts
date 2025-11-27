import { useCallback } from 'react';
import { createLogger } from '~logger';
import { db, clearThreadMessages, updateThreadTitle, type ChatMessage } from '../../db';
import { generateThreadTitle } from '@/utils/ai';
import type { UIMessage } from 'ai';

const log = createLogger('useAIChatMessages');

interface UseAIChatMessagesProps {
    currentThreadId: string | null;
    onContextWarning: (percent: number) => void;
}

/**
 * Hook to handle AI chat message persistence and title generation
 */
export function useAIChatMessages({ currentThreadId }: UseAIChatMessagesProps) {

    const handleFinish = useCallback(async (result: any) => {
        log.info('AI response finished', { messageId: result.message.id });

        if (result.messages && result.messages.length > 0 && currentThreadId) {
            try {
                await clearThreadMessages(currentThreadId);

                const dbMessages: ChatMessage[] = result.messages
                    .map((msg: UIMessage, index: number) => {
                        // Safely filter out transient parts
                        let messageWithoutTransient;
                        try {
                            messageWithoutTransient = {
                                ...msg,
                                parts: msg.parts?.filter((part: any) => part && !part.transient)
                            };
                        } catch (error) {
                            log.error('Error filtering transient parts', {
                                error: error instanceof Error ? error.message : String(error),
                                messageId: msg.id
                            });
                            messageWithoutTransient = msg;
                        }

                        let timestamp: number;
                        if ((msg as any).createdAt) {
                            timestamp = new Date((msg as any).createdAt).getTime();
                        } else {
                            timestamp = Date.now() + index;
                        }

                        return {
                            id: msg.id,
                            threadId: currentThreadId,
                            message: messageWithoutTransient,
                            timestamp,
                            sequenceNumber: index,
                        };
                    });

                if (dbMessages.length > 0) {
                    await db.chatMessages.bulkAdd(dbMessages);

                    const toolCallCount = dbMessages.filter(msg =>
                        msg.message.parts?.some((p: any) =>
                            p && (p.type === 'tool-call' || p.type === 'tool-result')
                        )
                    ).length;

                    const totalToolParts = dbMessages.reduce((sum, msg) =>
                        sum + (msg.message.parts?.filter((p: any) =>
                            p && (p.type === 'tool-call' || p.type === 'tool-result')
                        ).length || 0), 0
                    );

                    log.info("💾 Saved thread messages to DB after AI response", {
                        threadId: currentThreadId,
                        totalMessages: dbMessages.length,
                        messagesWithTools: toolCallCount,
                        totalToolParts,
                        preservesToolUI: true
                    });
                }

                // Generate thread title if needed
                if (result.messages.length >= 2 && result.message.role === 'assistant') {
                    const currentThread = await db.chatThreads.get(currentThreadId);
                    const hasCustomTitle = currentThread?.title &&
                        currentThread.title !== 'New Chat' &&
                        !currentThread.title.startsWith('Chat ');

                    if (!hasCustomTitle) {
                        log.info("Generating thread title after assistant response");

                        const conversationContext = result.messages
                            .filter((msg: UIMessage) => msg.role === 'user' || msg.role === 'assistant')
                            .map((msg: UIMessage) => {
                                try {
                                    const text = msg.parts
                                        ?.filter((part: any) => part && part.type === 'text')
                                        .map((part: any) => {
                                            // Safely extract text with null checks
                                            if (part && typeof part.text === 'string') {
                                                return part.text;
                                            }
                                            return '';
                                        })
                                        .filter((t: string) => t.length > 0)
                                        .join('') || '';
                                    return `${msg.role === 'user' ? 'User' : 'Assistant'}: ${text}`;
                                } catch (error) {
                                    log.error('Error extracting text for title generation', {
                                        error: error instanceof Error ? error.message : String(error),
                                        messageId: msg.id
                                    });
                                    return '';
                                }
                            })
                            .filter((text: string) => text.length > 0)
                            .join('\n\n');

                        generateThreadTitle(conversationContext, {
                            maxLength: 40,
                            context: 'This is a chat conversation. Generate a concise headline summarizing the main topic.',
                            onDownloadProgress: (progress) => {
                                const percent = Math.floor(progress * 100);
                                if (percent % 25 === 0) {
                                    log.info(`Summarizer model download: ${percent}%`);
                                }
                            }
                        }).then(title => {
                            updateThreadTitle(currentThreadId, title);
                            log.info("Updated thread title after AI response", {
                                threadId: currentThreadId,
                                title
                            });
                        }).catch(error => {
                            log.error("Failed to generate thread title", error);
                        });
                    } else {
                        log.info("Skipping title generation - thread already has a custom title", {
                            threadId: currentThreadId,
                            currentTitle: currentThread.title
                        });
                    }
                }
            } catch (error) {
                log.error("Failed to save messages after AI response", error);
            }
        }
    }, [currentThreadId]);

    return { handleFinish };
}

