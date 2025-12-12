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
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadThreads = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const allThreads = await getAllThreads();
            setThreads(allThreads);
        } catch (error) {
            log.error('Failed to load threads', error);
            setError(error instanceof Error ? error.message : 'Failed to load conversations');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadThreads();
        }
    }, [isOpen]);

    // Refresh threads periodically when panel is open to catch external deletions
    useEffect(() => {
        if (!isOpen) return;

        const interval = setInterval(() => {
            loadThreads();
        }, 5000);

        return () => clearInterval(interval);
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

    const handleNewChat = () => {
        onNewThread();
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="fixed inset-0 bg-black/50 z-[1000] backdrop-blur-[4px]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                    />

                    {/* Side Panel */}
                    <motion.div
                        className="fixed inset-y-0 left-0 w-[320px] max-w-[320px] min-w-[320px] bg-[#0a0e1a] border-r border-white/[0.08] z-[1001] flex flex-col shadow-[-4px_0_20px_rgba(0,0,0,0.3)] md:w-[60%] md:max-w-[350px] md:min-w-[280px] sm:!w-screen sm:!max-w-[100vw] sm:!min-w-[100vw]"
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    >
                        <div className="flex items-start justify-between p-[20px_20px_16px] border-b border-white/[0.08] bg-[#0a0e1a] sm:p-[16px_16px_12px]">
                            <div className="flex flex-col items-start gap-1">
                                <h2 className="m-0 text-xl font-semibold text-white leading-[1.2]">Chat History</h2>
                                <p className="m-0 text-[13px] text-[#888888] leading-[1.4]">Your previous conversations</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="flex items-center justify-center p-2 bg-transparent border-none text-[#888888] cursor-pointer rounded-md transition-all duration-200 hover:bg-white/[0.05] hover:text-white"
                                title="Close chat history"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <button onClick={handleNewChat} className="flex items-center justify-center gap-2 m-[16px_20px] p-[12px_16px] bg-white/[0.05] text-white/[0.9] border border-white/[0.08] rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-white/[0.08] hover:border-white/[0.12] hover:-translate-y-px hover:shadow-md sm:m-[12px_16px]">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 5v14M5 12h14" />
                            </svg>
                            New Chat
                        </button>

                        <div className="flex-1 overflow-y-auto px-5 pb-5 sm:px-4 sm:pb-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/[0.15] [&::-webkit-scrollbar-thumb]:rounded-sm hover:[&::-webkit-scrollbar-thumb]:bg-white/25">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 px-6 text-center text-white/50">
                                    <div className="mb-4 opacity-50">
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                            <circle cx="12" cy="12" r="10" opacity="0.25" />
                                            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round">
                                                <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
                                            </path>
                                        </svg>
                                    </div>
                                    <h3 className="m-0 mb-2 text-lg font-medium text-white">Loading conversations...</h3>
                                </div>
                            ) : error ? (
                                <div className="flex flex-col items-center justify-center py-12 px-6 text-center text-white/50">
                                    <div className="mb-4 opacity-50">
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                            <circle cx="12" cy="12" r="10" />
                                            <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
                                        </svg>
                                    </div>
                                    <h3 className="m-0 mb-2 text-lg font-medium text-white">Failed to load conversations</h3>
                                    <p className="m-0 text-sm opacity-70">{error}</p>
                                    <button onClick={loadThreads} className="flex items-center justify-center gap-2 mt-4 px-4 py-2 bg-white/[0.05] text-white/[0.9] border border-white/[0.08] rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-white/[0.08] hover:border-white/[0.12] hover:-translate-y-px hover:shadow-md">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M1 4v6h6M23 20v-6h-6" />
                                            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                                        </svg>
                                        Retry
                                    </button>
                                </div>
                            ) : threads.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 px-6 text-center text-white/50">
                                    <div className="mb-4 opacity-50">
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                                        </svg>
                                    </div>
                                    <h3 className="m-0 mb-2 text-lg font-medium text-white">No conversations yet</h3>
                                    <p className="m-0 text-sm opacity-70">Start a new conversation to begin</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {threads.map((thread) => (
                                        <div
                                            key={thread.id}
                                            className={`flex items-center justify-between p-[12px_16px] bg-white/[0.03] border border-white/[0.08] rounded-lg cursor-pointer transition-all duration-200 hover:bg-white/[0.05] hover:border-white/[0.12] hover:translate-x-1 group ${thread.id === currentThreadId ? '!bg-white/[0.05] !border-[#1264ff]/50 shadow-md' : ''}`}
                                            onClick={() => handleThreadClick(thread.id)}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className={`text-sm font-medium text-white mb-1 overflow-hidden text-ellipsis whitespace-nowrap ${thread.id === currentThreadId ? 'text-white/[0.9]' : ''}`}>{cleanTitle(thread.title)}</div>
                                                <div className="text-xs text-white/50">{formatDate(thread.updatedAt)}</div>
                                            </div>
                                            <button
                                                className="flex items-center justify-center p-1.5 bg-transparent border-none text-white/40 cursor-pointer rounded opacity-0 transition-all duration-200 hover:bg-red-500/10 hover:text-[#ef4444] group-hover:opacity-100"
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


