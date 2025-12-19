import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MentionInput } from '@/components/shared/inputs';
import type { FileAttachmentData } from '../../attachments/FileAttachment';
import type { WorkflowDefinition } from '@/workflows/types';
import type { SearchDepth } from '@/search/types';

interface ComposerInputProps {
    input: string;
    setInput: (value: string) => void;
    isLoading: boolean;
    pendingMessageId?: string | null;
    nextMessageId?: string;
    activeWorkflow: WorkflowDefinition | null;
    attachments: FileAttachmentData[];
    showSlashDropdown: boolean;
    handleSlashCommandDetection: (show: boolean, query: string) => void;
    composerRef: React.RefObject<HTMLDivElement | null>;
    isSearchActive?: boolean;
    searchDepth?: SearchDepth;
}

/**
 * Returns the appropriate placeholder text based on current mode.
 */
const getPlaceholder = (
    activeWorkflow: WorkflowDefinition | null,
    attachments: FileAttachmentData[],
    isSearchActive?: boolean,
    searchDepth?: SearchDepth
): string => {
    if (activeWorkflow) {
        return `${activeWorkflow.name} mode: Describe what to ${activeWorkflow.id}...`;
    }
    if (attachments.length > 0) {
        return 'Add a message (optional)...';
    }
    if (isSearchActive) {
        return searchDepth === 'advanced'
            ? 'Deep research the web...'
            : 'Search the web...';
    }
    return 'Ask anything (type @ to mention tabs, / for workflows)';
};

/**
 * Main input area with MentionInput and animated preview overlay.
 */
export const ComposerInput: React.FC<ComposerInputProps> = ({
    input,
    setInput,
    isLoading,
    pendingMessageId,
    nextMessageId,
    activeWorkflow,
    attachments,
    showSlashDropdown,
    handleSlashCommandDetection,
    composerRef,
    isSearchActive,
    searchDepth
}) => {
    return (
        <div className="flex items-start gap-2 flex-1 overflow-hidden min-h-[44px] relative">
            <div style={{ position: 'relative', width: '100%' }}>
                <MentionInput
                    value={input}
                    onChange={setInput}
                    onSlashCommand={handleSlashCommandDetection}
                    isSlashDropdownOpen={showSlashDropdown}
                    onSend={() => {
                        // Trigger form submit by clicking the submit button
                        const form = composerRef.current?.closest('form');
                        if (form) {
                            form.requestSubmit();
                        }
                    }}
                    disabled={isLoading}
                    placeholder={getPlaceholder(activeWorkflow, attachments, isSearchActive, searchDepth)}
                    autoFocus={true}
                />
                {/* Animated Preview Overlay - iMessage style */}
                <AnimatePresence>
                    {input.trim() && !pendingMessageId && nextMessageId && (
                        <motion.div
                            key="input-preview"
                            layout="position"
                            className="pointer-events-none absolute top-0 left-0 -z-10 flex min-h-[24px] w-full items-center overflow-hidden break-words pt-[10px] pl-2"
                            layoutId={`message-${nextMessageId}`}
                            transition={{ type: 'easeOut', duration: 0.2 }}
                            initial={{ opacity: 0.6, zIndex: -1 }}
                            animate={{ opacity: 0.6, zIndex: -1 }}
                            exit={{ opacity: 1, zIndex: 1 }}
                        >
                            <div className="text-white/50 text-sm font-normal leading-[1.4] tracking-[0.3px] break-words whitespace-pre-wrap" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }}>
                                {input}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

