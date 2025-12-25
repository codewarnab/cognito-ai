import React from 'react';
import { motion } from 'framer-motion';

/**
 * Skeleton loading component displayed while chat store is hydrating
 * Shows a placeholder UI to prevent flash of empty content
 */
export const ChatLoadingSkeleton: React.FC = () => {
    return (
        <div className="flex flex-col h-screen w-full m-0 p-0 bg-[#0a0e1a] text-[#e4e6eb] fixed inset-0">
            {/* Header Skeleton */}
            <div className="flex-shrink-0 px-3 py-2 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {/* Logo placeholder */}
                        <div className="w-6 h-6 rounded bg-white/5 animate-pulse" />
                        {/* Title placeholder */}
                        <div className="w-20 h-4 rounded bg-white/5 animate-pulse" />
                    </div>
                    <div className="flex items-center gap-1">
                        {/* Action buttons placeholder */}
                        <div className="w-8 h-8 rounded bg-white/5 animate-pulse" />
                        <div className="w-8 h-8 rounded bg-white/5 animate-pulse" />
                        <div className="w-8 h-8 rounded bg-white/5 animate-pulse" />
                    </div>
                </div>
            </div>

            {/* Messages Area Skeleton */}
            <div className="flex-1 overflow-hidden p-4 space-y-4">
                {/* Simulate loading state with animated placeholders */}
                <motion.div
                    initial={{ opacity: 0.3 }}
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className="flex justify-center items-center py-8"
                >
                    <div className="flex flex-col items-center gap-3">
                        {/* Cognito logo shimmer */}
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/10 to-white/5 animate-pulse" />

                        {/* Loading text */}
                        <div className="flex items-center gap-2 text-white/40 text-sm">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full"
                            />
                            <span>Loading chat...</span>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Input Area Skeleton */}
            <div className="flex-shrink-0 p-3 border-t border-white/5">
                <div className="flex flex-col gap-2">
                    {/* Toolbar placeholder */}
                    <div className="flex items-center gap-1 px-2">
                        <div className="w-7 h-7 rounded bg-white/5 animate-pulse" />
                        <div className="w-7 h-7 rounded bg-white/5 animate-pulse" />
                        <div className="w-7 h-7 rounded bg-white/5 animate-pulse" />
                    </div>
                    {/* Input field placeholder */}
                    <div className="relative">
                        <div className="w-full h-[44px] rounded-xl bg-white/5 animate-pulse" />
                    </div>
                </div>
            </div>
        </div>
    );
};
