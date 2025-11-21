import { useEffect, useRef } from 'react';
import { createLogger } from '~logger';

const log = createLogger('useBackgroundMessageListener');

export interface UseBackgroundMessageListenerProps {
    currentThreadId: string | null;
    handleNewThread: () => Promise<void>;
    handleThreadSelect: (threadId: string) => Promise<void>;
    handleSendMessage: (text: string, fileAttachments?: any[], tabAttachments?: any[]) => Promise<void>;
    handleContinue: () => void;
    sendMessage: (params: { text: string }) => void;
}

/**
 * Hook to listen for omnibox and notification action messages from background script
 */
export function useBackgroundMessageListener({
    currentThreadId,
    handleNewThread,
    handleThreadSelect,
    handleSendMessage,
    handleContinue,
    sendMessage,
}: UseBackgroundMessageListenerProps) {
    // Track recently processed messages to prevent duplicates
    const processedMessagesRef = useRef<Set<string>>(new Set());
    const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const handleBackgroundMessage = async (
            message: any,
            _sender: chrome.runtime.MessageSender,
            sendResponse: (response?: any) => void
        ) => {
            // Create a unique key for this message to detect duplicates
            const dedupeKey = `${message?.type}-${JSON.stringify(message?.payload)}`;
            
            // Check if we've already processed this exact message recently (within 1 second)
            if (processedMessagesRef.current.has(dedupeKey)) {
                log.warn('⚠️ Duplicate message detected and ignored', { type: message?.type });
                sendResponse({ success: true, duplicate: true });
                return true;
            }
            
            // Mark this message as processed
            processedMessagesRef.current.add(dedupeKey);
            
            // Clean up old entries after 1 second
            if (cleanupTimeoutRef.current) {
                clearTimeout(cleanupTimeoutRef.current);
            }
            cleanupTimeoutRef.current = setTimeout(() => {
                processedMessagesRef.current.delete(dedupeKey);
            }, 1000);
            // Handle omnibox messages
            if (message?.type === 'omnibox/send-message') {
                const { text } = message.payload;

                log.info('🔤 Received omnibox message', { text, hasThread: !!currentThreadId });

                // If no thread exists, create a new one
                if (!currentThreadId) {
                    log.info('📝 Creating new thread for omnibox message');
                    await handleNewThread();
                    // Wait a bit for the thread to be created
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                // Send the message
                if (text && text.trim()) {
                    log.info('📤 Sending omnibox message to chat');
                    await handleSendMessage(text.trim());
                }

                sendResponse({ success: true });
                return true;
            }

            // Handle Ask AI button messages with attachments
            if (message?.type === 'ask-ai/send-message') {
                const { message: text, tabAttachments } = message.payload;

                log.info('🤖 Received Ask AI message', { text, tabAttachments });

                // If no thread exists, create a new one
                if (!currentThreadId) {
                    log.info('📝 Creating new thread for Ask AI message');
                    await handleNewThread();
                    // Wait a bit for the thread to be created
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                // Send the message with tab attachments
                if (text && text.trim()) {
                    log.info('📤 Sending Ask AI message to chat with attachments');
                    await handleSendMessage(text.trim(), undefined, tabAttachments);
                }

                sendResponse({ success: true });
                return true;
            }

            // Handle notification actions
            if (message?.type === 'ai/notification/action') {
                const { action, threadId } = message.payload;

                log.info('📬 Received notification action from background', { action, threadId });

                if (action === 'continue') {
                    // Load the correct thread if not already active
                    if (threadId && threadId !== currentThreadId) {
                        log.info('🔄 Switching to thread from notification', {
                            from: currentThreadId,
                            to: threadId
                        });
                        await handleThreadSelect(threadId);

                        // Wait a bit for the thread to load
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }

                    // Trigger the continue action
                    log.info('▶️ Triggering continue action from notification');
                    handleContinue();

                    sendResponse({ success: true });
                    return true; // Keep message channel open for async response
                } else if (action === 'navigate' || action === 'open') {
                    // Just open to the thread (notification body click)
                    if (threadId && threadId !== currentThreadId) {
                        log.info('📂 Opening thread from notification', { threadId });
                        await handleThreadSelect(threadId);
                    }
                    sendResponse({ success: true });
                    return true; // Keep message channel open for async response
                }
            }
            return false;
        };

        chrome.runtime.onMessage.addListener(handleBackgroundMessage);

        return () => {
            chrome.runtime.onMessage.removeListener(handleBackgroundMessage);
            if (cleanupTimeoutRef.current) {
                clearTimeout(cleanupTimeoutRef.current);
            }
        };
    }, [currentThreadId, handleThreadSelect, handleNewThread, handleContinue, handleSendMessage, sendMessage]);
}

