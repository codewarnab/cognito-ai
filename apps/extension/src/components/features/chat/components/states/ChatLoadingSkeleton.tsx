import React from 'react';
import { motion } from 'motion/react';

/**
 * Skeleton loading component displayed while chat store is hydrating
 * Shows a placeholder UI to prevent flash of empty content
 * Matches the actual ChatHeader and ChatInput layout
 */
export const ChatLoadingSkeleton: React.FC = () => {
    return (
        <div className="flex flex-col h-screen w-full m-0 p-0 bg-[#0a0e1a] text-[#e4e6eb] fixed inset-0">
            {/* Header Skeleton - matches ChatHeader layout */}
            <div className="flex-shrink-0 pt-2 px-3 bg-[#0a0e1a]/80 backdrop-blur-md min-h-[32px]">
                <div className="flex items-center justify-between gap-2 w-full">
                    {/* Left: Sidebar toggle */}
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-md bg-white/5 animate-pulse" />
                    </div>
                    {/* Right: New chat, wrench, kebab menu */}
                    <div className="flex items-center gap-1 shrink-0 ml-auto">
                        <div className="w-8 h-8 rounded-md bg-white/5 animate-pulse" />
                        <div className="w-8 h-8 rounded-md bg-white/5 animate-pulse" />
                        <div className="w-8 h-8 rounded-md bg-white/5 animate-pulse" />
                    </div>
                </div>
            </div>

            {/* Messages Area Skeleton - shows placeholder message bubbles */}
            <div className="flex-1 overflow-hidden px-4 py-6 space-y-4">
                {/* User message placeholder (right-aligned) */}
                <div className="flex justify-end">
                    <div className="max-w-[80%] px-4 py-3 rounded-2xl bg-[rgba(99,102,241,0.15)] animate-pulse">
                        <div className="h-4 w-32 rounded bg-white/10" />
                    </div>
                </div>

                {/* Assistant message placeholder (left-aligned) */}
                <div className="flex justify-start">
                    <div className="max-w-[85%] space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                            {/* Avatar placeholder */}
                            <div className="w-6 h-6 rounded-full bg-white/10 animate-pulse" />
                        </div>
                        <div className="space-y-2 animate-pulse">
                            <div className="h-4 w-64 rounded bg-white/8" />
                            <div className="h-4 w-48 rounded bg-white/8" />
                            <div className="h-4 w-56 rounded bg-white/8" />
                        </div>
                    </div>
                </div>

                {/* Another user message placeholder */}
                <div className="flex justify-end">
                    <div className="max-w-[80%] px-4 py-3 rounded-2xl bg-[rgba(99,102,241,0.15)] animate-pulse">
                        <div className="h-4 w-44 rounded bg-white/10" />
                    </div>
                </div>

                {/* Assistant typing indicator */}
                <div className="flex justify-start">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-white/10 animate-pulse" />
                        <div className="flex gap-1 px-3 py-2">
                            <motion.div
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                                className="w-2 h-2 rounded-full bg-white/30"
                            />
                            <motion.div
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                                className="w-2 h-2 rounded-full bg-white/30"
                            />
                            <motion.div
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                                className="w-2 h-2 rounded-full bg-white/30"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Input Area Skeleton - matches ChatInput/Composer layout */}
            <div className="flex-shrink-0 px-4 pb-2 bg-[rgba(10,14,26,0.85)] backdrop-blur-[20px]">
                {/* Composer container */}
                <div className="flex flex-col p-2 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-xl">
                    {/* Input placeholder */}
                    <div className="w-full h-[44px] rounded-lg bg-transparent" />

                    {/* Bottom toolbar row */}
                    <div className="flex items-end justify-between gap-3 mt-1">
                        {/* Left toolbar: mode, tools, search, model icons */}
                        <div className="flex items-center gap-1">
                            <div className="w-7 h-7 rounded-md bg-white/5 animate-pulse" />
                            <div className="w-7 h-7 rounded-md bg-white/5 animate-pulse" />
                            <div className="w-7 h-7 rounded-md bg-white/5 animate-pulse" />
                            {/* Separator */}
                            <div className="w-px h-4 bg-white/10 mx-1" />
                            <div className="w-7 h-7 rounded-md bg-white/5 animate-pulse" />
                        </div>

                        {/* Right actions: attachments, send */}
                        <div className="flex items-center gap-1">
                            <div className="w-7 h-7 rounded-md bg-white/5 animate-pulse" />
                            <div className="w-8 h-8 rounded-lg bg-white/5 animate-pulse" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
