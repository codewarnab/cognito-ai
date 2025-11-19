import { useState, useEffect, useRef, useCallback } from 'react';
import { createLogger } from '@logger';
import {
    createThread,
    loadThreadMessages,
    clearThreadMessages,
    getLastActiveThreadId,
    setLastActiveThreadId,
    setBrowserSessionId,
    type ChatMessage
} from '../db';
import type { UIMessage } from 'ai';
import type { ContextWarningState } from '../types/sidepanel';
import type { AppUsage } from '../ai/types/usage';
import { clearAllDismissals } from '../utils/localPdfDismissals';

const log = createLogger('useThreadManagement');

interface UseThreadManagementProps {
    setMessages?: (messages: UIMessage[]) => void;
    setContextWarning: (warning: ContextWarningState | null) => void;
    resetUsage?: () => void;
    setUsage?: (usage: AppUsage | null) => void;
}

/**
 * Hook to manage chat thread lifecycle and persistence
 */
export function useThreadManagement({
    setMessages,
    setContextWarning,
    resetUsage,
    setUsage,
}: UseThreadManagementProps) {
    const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
    const sessionIdRef = useRef<string>(Date.now().toString());

    // Load messages from IndexedDB on mount or thread change
    useEffect(() => {
        if (!setMessages) return; // Wait for setMessages to be available

        const loadMessages = async () => {
            try {
                if (!currentThreadId) {
                    const currentSessionId = sessionIdRef.current;
                    const lastThreadId = await getLastActiveThreadId();

                    if (lastThreadId) {
                        log.info("Restoring last active thread", { threadId: lastThreadId });
                        setCurrentThreadId(lastThreadId);
                        await setBrowserSessionId(currentSessionId);
                        return;
                    }

                    const thread = await createThread();
                    setCurrentThreadId(thread.id);
                    await setLastActiveThreadId(thread.id);
                    await setBrowserSessionId(currentSessionId);
                    log.info("Created new thread", { threadId: thread.id });
                    return;
                }

                const storedMessages = await loadThreadMessages(currentThreadId);
                if (storedMessages.length > 0) {
                    log.info("Loading thread messages from DB", {
                        threadId: currentThreadId,
                        count: storedMessages.length
                    });

                    // Convert to UIMessage and attach usage data
                    const uiMessages: UIMessage[] = storedMessages.map((msg: ChatMessage) => {
                        const uiMessage = msg.message;
                        // Attach usage data to the UIMessage so it can be used for calculations
                        if (msg.usage) {
                            (uiMessage as any).usage = msg.usage;
                        }
                        return uiMessage;
                    });

                    log.info("Restored messages with tool parts and usage", {
                        totalMessages: uiMessages.length,
                        messagesWithTools: uiMessages.filter(m =>
                            m.parts?.some((p: any) =>
                                p.type === 'tool-call' ||
                                p.type === 'tool-result'
                            )
                        ).length,
                        messagesWithUsage: uiMessages.filter(m => (m as any).usage).length
                    });

                    setMessages(uiMessages);

                    // Note: Usage loading is handled by useAIChat hook's effect
                    // when threadId changes, so we don't need to load it here
                    // This prevents race conditions and duplicate loads
                }

                await setLastActiveThreadId(currentThreadId);
            } catch (error) {
                log.error("Failed to load thread messages", error);
            }
        };

        loadMessages();
    }, [currentThreadId, setMessages]);

    const handleNewThread = useCallback(async () => {
        try {
            const thread = await createThread();
            setCurrentThreadId(thread.id);
            setMessages?.([]);
            setContextWarning(null);
            resetUsage?.();
            setUsage?.(null); // Reset usage for new thread

            // Clear dismissed PDF suggestions for fresh start
            clearAllDismissals();

            await setLastActiveThreadId(thread.id);
            log.info("✨ Created new thread with reset context", { threadId: thread.id });
        } catch (error) {
            log.error("Failed to create new thread", error);
        }
    }, [setMessages, setContextWarning, resetUsage, setUsage]);

    const handleThreadSelect = useCallback(async (threadId: string) => {
        log.info("🔄 Switching to thread", { threadId });
        setCurrentThreadId(threadId);
        setContextWarning(null);
        setUsage?.(null); // Reset usage before new thread loads

        // Clear dismissed PDF suggestions when switching threads
        clearAllDismissals();

        await setLastActiveThreadId(threadId);
    }, [setContextWarning, setUsage]);

    const handleClearChat = useCallback(async () => {
        if (!currentThreadId) return;

        if (window.confirm('Are you sure you want to clear the chat history for this thread?')) {
            try {
                log.info("Clearing thread messages", { threadId: currentThreadId });
                setMessages?.([]);
                setUsage?.(null); // Reset usage when clearing chat
                await clearThreadMessages(currentThreadId);
                log.info("Thread messages cleared successfully");
            } catch (error) {
                log.error("Failed to clear thread messages", error);
            }
        }
    }, [currentThreadId, setMessages, setUsage]);

    return {
        currentThreadId,
        handleNewThread,
        handleThreadSelect,
        handleClearChat,
    };
}
