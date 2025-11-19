import { useState, useEffect } from 'react';
import type { ChatThread } from '../../../db';
import { getAllThreads, deleteThread } from '../../../db';
import { createLogger } from '@logger';
const log = createLogger('ThreadList');

interface ThreadListProps {
    currentThreadId: string | null;
    onThreadSelect: (threadId: string) => void;
    onNewThread: () => void;
    onBack: () => void;
}

export function ThreadList({ currentThreadId, onThreadSelect, onNewThread, onBack }: ThreadListProps) {
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
        loadThreads();
    }, []);

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

    const cleanTitle = (title: string) => {
        // Remove "User:" and "Assistant:" prefixes
        return title.replace(/^(User:|Assistant:)\s*/gi, '').trim();
    };

    return (
        <div className="thread-list-container">
            <div className="thread-list-header">
                <button onClick={onBack} className="back-button" title="Back to chat">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className="thread-list-header-content">
                    <h2>Chat History</h2>
                </div>
            </div>

            <button onClick={onNewThread} className="new-thread-button">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                </svg>
                New Chat
            </button>

            <div className="threads-list">
                {threads.length === 0 ? (
                    <div className="no-threads">
                        <p>No chat history yet</p>
                        <p className="text-sm">Start a new conversation to begin</p>
                    </div>
                ) : (
                    threads.map((thread) => (
                        <div
                            key={thread.id}
                            className={`thread-item ${thread.id === currentThreadId ? 'active' : ''}`}
                            onClick={() => {
                                onThreadSelect(thread.id);
                                onBack();
                            }}
                        >
                            <div className="thread-content">
                                <div className="thread-title">{cleanTitle(thread.title)}</div>
                                <div className="thread-date">{formatDate(thread.updatedAt)}</div>
                            </div>
                            <button
                                className="delete-thread-button"
                                onClick={(e) => handleDeleteThread(thread.id, e)}
                                title="Delete thread"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                </svg>
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
