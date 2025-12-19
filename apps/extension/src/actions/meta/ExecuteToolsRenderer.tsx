/**
 * Custom renderer for executeTools that displays each sub-tool call
 * using CompactToolCard, making them look identical to normal tool calls.
 * 
 * Phase 5: Enhanced with framer-motion animations for smooth transitions
 * - Loading state with animated indicator
 * - Staggered animation for tool cards appearing
 * - Smooth transitions between states
 */

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CompactToolCard } from '@/components/ui/tools/cards';
import { LoadingCheckIcon, type LoadingCheckIconHandle } from '@assets/icons/chat/loading-check';
import type { ToolUIState } from '@/ai/tools/components';
import type { TrackedToolCall } from '@/ai/tools/meta/types';

interface ExecuteToolsRendererProps {
    state: ToolUIState;
}

// Animation variants for the container
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.08, // Stagger each tool card by 80ms
            delayChildren: 0.1,
        },
    },
};

// Animation variants for individual tool cards
const cardVariants = {
    hidden: { 
        opacity: 0, 
        y: -8,
        scale: 0.95,
    },
    visible: { 
        opacity: 1, 
        y: 0,
        scale: 1,
        transition: {
            duration: 0.25,
            ease: [0.25, 0.46, 0.45, 0.94], // Custom easing for smooth feel
        },
    },
};

// Animation variants for loading state
const loadingVariants = {
    initial: { opacity: 0, y: -4 },
    animate: { 
        opacity: 1, 
        y: 0,
        transition: { duration: 0.2, ease: 'easeOut' },
    },
    exit: { 
        opacity: 0, 
        y: -4,
        transition: { duration: 0.15, ease: 'easeIn' },
    },
};

export function ExecuteToolsRenderer({ state }: ExecuteToolsRendererProps) {
    const { state: toolState, output, input } = state;
    const loadingIconRef = useRef<LoadingCheckIconHandle>(null);

    // Start loading animation when in loading state
    useEffect(() => {
        if (toolState === 'input-available' || toolState === 'input-streaming') {
            loadingIconRef.current?.startAnimation();
        } else {
            loadingIconRef.current?.stopAnimation();
        }
    }, [toolState]);

    // Extract tool calls from completed output
    const toolCalls: TrackedToolCall[] = output?.toolCalls || [];
    const isLoading = toolState === 'input-available' || toolState === 'input-streaming';
    const isComplete = toolState === 'output-available' || toolState === 'output-error';

    return (
        <AnimatePresence mode="wait">
            {/* Loading state */}
            {isLoading && (
                <motion.div
                    key="loading"
                    variants={loadingVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex items-center gap-2 text-sm text-[var(--text-secondary)] py-[6px]"
                >
                    <LoadingCheckIcon ref={loadingIconRef} size={16} />
                    <span>Executing code...</span>
                </motion.div>
            )}

            {/* Completed state - no tool calls */}
            {isComplete && toolCalls.length === 0 && (
                <motion.div
                    key="no-tools"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                    <CompactToolCard
                        toolName="executeTools"
                        state={toolState === 'output-available' ? 'success' : 'error'}
                        input={input}
                        output={output}
                        errorText={toolState === 'output-error' ? output?.error : undefined}
                    />
                </motion.div>
            )}

            {/* Completed state - with tool calls (staggered animation) */}
            {isComplete && toolCalls.length > 0 && (
                <motion.div
                    key="tool-cards"
                    className="flex flex-col gap-1"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    {toolCalls.map((call) => (
                        <motion.div key={call.callId} variants={cardVariants}>
                            <CompactToolCard
                                toolName={call.toolName}
                                state={call.state}
                                input={call.input}
                                output={call.output}
                                errorText={call.errorText}
                            />
                        </motion.div>
                    ))}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
