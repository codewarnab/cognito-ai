import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ChatThread } from '../../../db';
import { getAllThreads, deleteThread } from '../../../db';
import { createLogger } from '~logger';

const log = createLogger('ThreadListSidePanel');

function cleanTitle(title: string): string {
    return title.replace(/^(User:|Assistant:)\s*/gi, '').trim();
}

interface ThreadListSidePanelProps {
    isOpen: boolean;
    onClose: () => void;
    currentThreadId: string | null;
    onThreadSelect: (threadId: string) => void;
    onNewThread: () => void;
}

export function ThreadListSidePanel({
    isOpen,
    onClose,
    currentThreadId,
    onThreadSelect,
    onNewThread
}: ThreadListSidePanelProps) {
    const [threads, setThreads] = useState<ChatThread[]>([]);

    const loadThreads = async () => {
        try {
            const allThreads = await getAllThreads();
            setThreads(allThreads);
        } catch (error) {
            log.error('Failed to load threads', error);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadThreads();
        }
    }, [isOpen]);

    const handleDeleteThread = async (threadId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await deleteThread(threadId);
            await loadThreads();

            // If we deleted the current thread, trigger new thread
            if (threadId === currentThreadId) {
                onNewThread();
            }
        } catch (error) {
            log.error('Failed to delete thread', error);
        }
    };

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } else if (days === 1) {
            return 'Yesterday';
        } else if (days < 7) {
            return `${days} days ago`;
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    };

    const handleThreadClick = (threadId: string) => {
        onThreadSelect(threadId);
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="thread-sidepanel-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                    />

                    {/* Side Panel */}
                    <motion.div
                        className="thread-sidepanel"
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    >
                        <div className="thread-sidepanel-header">
                            <div className="thread-sidepanel-header-content">
                                <h2>Chat History</h2>
                                <p>Your previous conversations</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="thread-sidepanel-close"
                                title="Close chat history"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <button onClick={onNewThread} className="thread-sidepanel-new-button">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 5v14M5 12h14" />
                            </svg>
                            New Chat
                        </button>

                        <div className="thread-sidepanel-content">
                            {threads.length === 0 ? (
                                <div className="thread-sidepanel-empty">
                                    <div className="thread-sidepanel-empty-icon">
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                                        </svg>
                                    </div>
                                    <h3>No conversations yet</h3>
                                    <p>Start a new conversation to begin</p>
                                </div>
                            ) : (
                                <div className="thread-sidepanel-list">
                                    {threads.map((thread) => (
                                        <div
                                            key={thread.id}
                                            className={`thread-sidepanel-item ${thread.id === currentThreadId ? 'active' : ''}`}
                                            onClick={() => handleThreadClick(thread.id)}
                                        >
                                            <div className="thread-sidepanel-item-content">
                                                <div className="thread-sidepanel-item-title">{cleanTitle(thread.title)}</div>
                                                <div className="thread-sidepanel-item-date">{formatDate(thread.updatedAt)}</div>
                                            </div>
                                            <button
                                                className="thread-sidepanel-item-delete"
                                                onClick={(e) => handleDeleteThread(thread.id, e)}
                                                title="Delete conversation"
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}


