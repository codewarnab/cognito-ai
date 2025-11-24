import { useCallback, useRef } from 'react';
import { createLogger } from '~logger';
import { db } from '../db';
import { extractPageContext, formatPageContextForAI } from '../utils/pageContextExtractor';
import { processFile } from '../utils/fileProcessor';
import { processTabsForMessage, type ProcessedTab } from '../utils/tabProcessor';
import { getModelConfig, setConversationStartMode } from '../utils/modelSettings';
import { HIDE_LOCAL_MODE } from '@constants';
import { hasGoogleApiKey } from '../utils/providerCredentials';
import type { FileAttachmentData } from '@components/features/chat/components/FileAttachment';
import type { TabAttachmentData } from '@components/features/chat/components/TabAttachment';
import type { UIMessage } from 'ai';

const log = createLogger('useMessageHandlers');

interface UseMessageHandlersProps {
    messages: UIMessage[];
    currentThreadId: string | null;
    isLoading: boolean;
    sendMessage: (message: any) => void;
    onError?: (message: string, type?: 'error' | 'warning' | 'info') => void;
}

/**
 * Hook to handle message sending with attachments and context
 */
export function useMessageHandlers({
    messages,
    currentThreadId,
    isLoading,
    sendMessage,
    onError,
}: UseMessageHandlersProps) {
    // Track the last sent message to prevent duplicates
    const lastSentMessageRef = useRef<{ text: string; timestamp: number } | null>(null);
    const sendingRef = useRef(false);

    const handleSendMessage = useCallback(async (
        messageText?: string,
        attachments?: FileAttachmentData[],
        tabAttachments?: TabAttachmentData[],
        workflowId?: string
    ) => {
        const trimmedInput = messageText?.trim() || '';

        if (!trimmedInput && (!attachments || attachments.length === 0) && (!tabAttachments || tabAttachments.length === 0)) {
            return;
        }

        if (isLoading) {
            return;
        }

        // Prevent duplicate sends - check if we're already sending
        if (sendingRef.current) {
            log.warn('⚠️ Message send already in progress, ignoring duplicate call');
            return;
        }

        // Check if this is a duplicate of the last message sent within 2 seconds
        const now = Date.now();
        if (lastSentMessageRef.current) {
            const timeSinceLastSend = now - lastSentMessageRef.current.timestamp;
            const isSameMessage = lastSentMessageRef.current.text === trimmedInput;

            if (isSameMessage && timeSinceLastSend < 2000) {
                log.warn('⚠️ Duplicate message detected and prevented', {
                    text: trimmedInput.substring(0, 50),
                    timeSinceLastSend
                });
                return;
            }
        }

        // Mark as sending and record this message
        sendingRef.current = true;
        lastSentMessageRef.current = { text: trimmedInput, timestamp: now };

        try {
            // Validate API key if HIDE_LOCAL_MODE is enabled or if in remote mode
            const config = await getModelConfig();
            if ((HIDE_LOCAL_MODE || config.mode === 'remote') && !(await hasGoogleApiKey())) {
                onError?.(
                    'API Key Required. Please add your Gemini API key in Settings to use the AI assistant.',
                    'error'
                );
                return;
            }

            log.info("SendMessage", {
                length: trimmedInput.length,
                hasAttachments: attachments && attachments.length > 0,
                attachmentCount: attachments?.length || 0,
                hasTabAttachments: tabAttachments && tabAttachments.length > 0,
                tabAttachmentCount: tabAttachments?.length || 0,
                workflowId: workflowId || 'none'
            });

            // Track conversation start mode on first message
            if (messages.length === 0) {
                try {
                    const config = await getModelConfig();
                    if (!config.conversationStartMode) {
                        await setConversationStartMode(config.mode);
                        log.info("Locked conversation mode", { mode: config.mode });
                    }
                } catch (error) {
                    log.warn("Failed to set conversation start mode", error);
                }
            }

            let finalMessage = trimmedInput;
            if (workflowId) {
                log.info("Workflow mode active", { workflowId });
                finalMessage = `/${workflowId} ${trimmedInput}`;
            }

            // Capture page context for first message
            if (messages.length === 0 && currentThreadId) {
                try {
                    const pageContext = await extractPageContext();
                    if (pageContext) {
                        const contextFormatted = formatPageContextForAI(pageContext);
                        await db.chatThreads.update(currentThreadId, {
                            initialPageContext: contextFormatted
                        });

                        log.info("Captured initial page context for thread", {
                            threadId: currentThreadId,
                            url: pageContext.url,
                            inputs: pageContext.inputs.length,
                            buttons: pageContext.buttons.length,
                            links: pageContext.links.length
                        });
                    }
                } catch (error) {
                    log.warn("Failed to capture initial page context", error);
                }
            }

            // Process attachments if present
            let messageParts: any[] | null = null;

            if (attachments && attachments.length > 0) {
                try {
                    log.info("Processing file attachments", { count: attachments.length });

                    const processedFiles = await Promise.all(
                        attachments.map(async (att) => {
                            try {
                                return await processFile(att.file);
                            } catch (error) {
                                log.error("Failed to process file", { name: att.file.name, error });
                                return null;
                            }
                        })
                    );

                    // Validate processed files are not null and have required properties
                    const validFiles = processedFiles.filter((f): f is NonNullable<typeof f> =>
                        f !== null &&
                        f !== undefined &&
                        typeof f.mimeType === 'string' &&
                        typeof f.content === 'string' &&
                        typeof f.name === 'string' &&
                        typeof f.size === 'number'
                    );

                    if (validFiles.length > 0) {
                        log.info("Files processed successfully", {
                            total: attachments.length,
                            successful: validFiles.length,
                            images: validFiles.filter(f => f.isImage).length
                        });

                        messageParts = [];

                        if (finalMessage) {
                            messageParts.push({
                                type: 'text',
                                text: finalMessage
                            });
                        }

                        for (const file of validFiles) {
                            messageParts.push({
                                type: 'file',
                                mediaType: file.mimeType,
                                url: `data:${file.mimeType};base64,${file.content}`,
                                name: file.name,
                                size: file.size
                            });
                        }
                    }
                } catch (error) {
                    log.error("Failed to process attachments", error);
                    onError?.("Failed to process some attachments. Please try again.", 'error');
                }
            }

            // Process tab attachments if present
            if (tabAttachments && tabAttachments.length > 0) {
                try {
                    log.info("Processing tab attachments", { count: tabAttachments.length });

                    const processedTabs: ProcessedTab[] = await processTabsForMessage(tabAttachments);

                    // If we already have message parts from files, add tabs to them
                    // Otherwise create new parts array
                    const tabMessageParts: any[] = messageParts?.length ? messageParts : [];

                    // Add text if not already added
                    if (finalMessage && !tabMessageParts.some(p => p.type === 'text')) {
                        tabMessageParts.push({
                            type: 'text',
                            text: finalMessage
                        });
                    }

                    // Add tab-context parts for UI rendering
                    // AND add formatted text for AI consumption
                    for (const tab of processedTabs) {
                        // Add tab-context part for UI display (visual card)
                        tabMessageParts.push({
                            type: 'tab-context',
                            url: tab.url,
                            title: tab.title,
                            content: tab.content,
                            favicon: tab.favicon,
                            error: tab.error
                        });

                        // Add formatted text part for AI to understand the tab content
                        let tabContextText = `\n\n[TAB ATTACHMENT: ${tab.title}]\nURL: ${tab.url}\n`;

                        if (tab.error) {
                            tabContextText += `Error: ${tab.error}\n`;
                        } else if (tab.content) {
                            tabContextText += `Content:\n${tab.content}\n`;
                        } else {
                            tabContextText += `Content: (No content available)\n`;
                        }

                        tabContextText += `[/TAB ATTACHMENT]\n`;

                        tabMessageParts.push({
                            type: 'text',
                            text: tabContextText
                        });
                    }

                    log.info("Tabs processed successfully", {
                        total: tabAttachments.length,
                        withContent: processedTabs.filter(t => t.content).length,
                        withErrors: processedTabs.filter(t => t.error).length
                    });

                    sendMessage({
                        role: 'user',
                        parts: tabMessageParts
                    });

                    return;
                } catch (error) {
                    log.error("Failed to process tab attachments", error);
                    onError?.("Failed to process some tabs. They may have been closed or inaccessible.", 'warning');
                    // Continue with regular message sending
                }
            }

            // If we have file parts but no tab parts, send the file message
            if (messageParts && messageParts.length > 0) {
                sendMessage({
                    role: 'user',
                    parts: messageParts
                });
                return;
            }

            // Regular message (no attachments)
            sendMessage({ text: finalMessage });
        } finally {
            // Reset sending flag after a short delay
            setTimeout(() => {
                sendingRef.current = false;
            }, 500);
        }
    }, [messages.length, currentThreadId, isLoading, sendMessage, onError]);

    return { handleSendMessage };
}

