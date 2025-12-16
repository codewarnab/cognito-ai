import { useState, useEffect } from 'react';
import type { ChatThread } from '../../../db';
import { getAllThreads, deleteThread } from '../../../db';
import { createLogger } from '~logger';
const log = createLogger('ThreadList', 'UI_THREADS');

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
        <div className="flex flex-col h-screen bg-[#0a0e1a]">
            <div className="flex items-center gap-3 p-4 border-b border-white/[0.08] bg-[#0a0e1a]">
                <button onClick={onBack} className="flex items-center justify-center p-2 bg-transparent border-none text-[#888888] cursor-pointer rounded-md transition-all duration-200 hover:bg-white/[0.05] hover:text-white" title="Back to chat">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className="flex flex-col gap-1 flex-1">
                    <h2 className="m-0 text-lg font-semibold text-white">Chat History</h2>
                </div>
            </div>

            <button onClick={onNewThread} className="flex items-center justify-center gap-2 m-4 p-[12px_16px] bg-[#1264ff] text-white border-none rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-[#1264ff]/90 hover:-translate-y-px hover:shadow-md">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                </svg>
                New Chat
            </button>

            <div className="flex-1 overflow-y-auto p-2 container-scrollbar">
                {threads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-6 text-center text-[#888888]">
                        <p className="my-1 mx-0">No chat history yet</p>
                        <p className="text-[13px] opacity-70 my-1 mx-0">Start a new conversation to begin</p>
                    </div>
                ) : (
                    threads.map((thread) => (
                        <div
                            key={thread.id}
                            className={`flex items-center justify-between p-[12px_16px] mb-2 bg-[#0a0e1a] border border-white/[0.08] rounded-lg cursor-pointer transition-all duration-200 hover:bg-white/[0.05] hover:border-[#1264ff] hover:translate-x-0.5 group ${thread.id === currentThreadId ? 'bg-white/[0.05] border-[#1264ff] shadow-[0_2px_8px_rgba(59,130,246,0.15)]' : ''}`}
                            onClick={() => {
                                onThreadSelect(thread.id);
                                onBack();
                            }}
                        >
                            <div className="flex-1 min-w-0">
                                <div className={`text-sm font-medium mb-1 overflow-hidden text-ellipsis whitespace-nowrap ${thread.id === currentThreadId ? 'text-[#1264ff]' : 'text-white'}`}>{cleanTitle(thread.title)}</div>
                                <div className="text-xs text-[#888888]">{formatDate(thread.updatedAt)}</div>
                            </div>
                            <button
                                className="flex items-center justify-center p-1.5 bg-transparent border-none text-[#888888] cursor-pointer rounded opacity-0 transition-all duration-200 hover:bg-red-500/10 hover:text-[#ef4444] group-hover:opacity-100"
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

