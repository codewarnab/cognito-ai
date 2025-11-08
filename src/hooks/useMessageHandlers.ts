import { useCallback } from 'react';
import { createLogger } from '../logger';
import { db } from '../db';
import { extractPageContext, formatPageContextForAI } from '../utils/pageContextExtractor';
import { processFile } from '../utils/fileProcessor';
import { getModelConfig, setConversationStartMode } from '../utils/modelSettings';
import type { FileAttachmentData } from '../components/features/chat/components/FileAttachment';
import type { UIMessage } from 'ai';

const log = createLogger('useMessageHandlers');

interface UseMessageHandlersProps {
    messages: UIMessage[];
    currentThreadId: string | null;
    isLoading: boolean;
    sendMessage: (message: any) => void;
}

/**
 * Hook to handle message sending with attachments and context
 */
export function useMessageHandlers({
    messages,
    currentThreadId,
    isLoading,
    sendMessage,
}: UseMessageHandlersProps) {

    const handleSendMessage = useCallback(async (
        messageText?: string,
        attachments?: FileAttachmentData[],
        workflowId?: string
    ) => {
        const trimmedInput = messageText?.trim() || '';

        if (!trimmedInput && (!attachments || attachments.length === 0)) {
            return;
        }

        if (isLoading) {
            return;
        }

        log.info("SendMessage", {
            length: trimmedInput.length,
            hasAttachments: attachments && attachments.length > 0,
            attachmentCount: attachments?.length || 0,
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

                    const messageParts: any[] = [];

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

                    sendMessage({
                        role: 'user',
                        parts: messageParts
                    });

                    return;
                }
            } catch (error) {
                log.error("Failed to process attachments", error);
                alert("Failed to process some attachments. Please try again.");
            }
        }

        sendMessage({ text: finalMessage });
    }, [messages.length, currentThreadId, isLoading, sendMessage]);

    return { handleSendMessage };
}
