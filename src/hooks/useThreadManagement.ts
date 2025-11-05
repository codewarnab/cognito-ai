import { useState, useEffect, useRef, useCallback } from 'react';
import { createLogger } from '../logger';
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

const log = createLogger('useThreadManagement');

interface UseThreadManagementProps {
    setMessages?: (messages: UIMessage[]) => void;
    setContextWarning: (warning: ContextWarningState | null) => void;
    resetUsage?: () => void;
}

/**
 * Hook to manage chat thread lifecycle and persistence
 */
export function useThreadManagement({
    setMessages,
    setContextWarning,
    resetUsage,
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

                    const uiMessages: UIMessage[] = storedMessages.map((msg: ChatMessage) => msg.message);

                    log.info("Restored messages with tool parts", {
                        totalMessages: uiMessages.length,
                        messagesWithTools: uiMessages.filter(m =>
                            m.parts?.some((p: any) =>
                                p.type === 'tool-call' ||
                                p.type === 'tool-result'
                            )
                        ).length
                    });

                    setMessages(uiMessages);
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
            await setLastActiveThreadId(thread.id);
            log.info("✨ Created new thread with reset context", { threadId: thread.id });
        } catch (error) {
            log.error("Failed to create new thread", error);
        }
    }, [setMessages, setContextWarning, resetUsage]);

    const handleThreadSelect = useCallback(async (threadId: string) => {
        log.info("🔄 Switching to thread", { threadId });
        setCurrentThreadId(threadId);
        setContextWarning(null);
        await setLastActiveThreadId(threadId);
    }, [setContextWarning]);

    const handleClearChat = useCallback(async () => {
        if (!currentThreadId) return;

        if (window.confirm('Are you sure you want to clear the chat history for this thread?')) {
            try {
                log.info("Clearing thread messages", { threadId: currentThreadId });
                setMessages?.([]);
                await clearThreadMessages(currentThreadId);
                log.info("Thread messages cleared successfully");
            } catch (error) {
                log.error("Failed to clear thread messages", error);
            }
        }
    }, [currentThreadId, setMessages]);

    return {
        currentThreadId,
        handleNewThread,
        handleThreadSelect,
        handleClearChat,
    };
}
