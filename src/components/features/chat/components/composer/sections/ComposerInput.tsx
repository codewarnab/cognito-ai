import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MentionInput } from '@/components/shared/inputs';
import type { FileAttachmentData } from '../../attachments/FileAttachment';
import type { WorkflowDefinition } from '@/workflows/types';

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
    composerRef: React.RefObject<HTMLDivElement>;
}

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
    composerRef
}) => {
    return (
        <div className="copilot-composer-primary">
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
                    placeholder={
                        activeWorkflow
                            ? `${activeWorkflow.name} mode: Describe what to ${activeWorkflow.id}...`
                            : attachments.length > 0
                                ? "Add a message (optional)..."
                                : "Ask anything (type @ to mention tabs, / for workflows)"
                    }
                    autoFocus={true}
                />
                {/* Animated Preview Overlay - iMessage style */}
                <AnimatePresence>
                    {input.trim() && !pendingMessageId && nextMessageId && (
                        <motion.div
                            key="input-preview"
                            layout="position"
                            className="copilot-textarea-preview-wrapper"
                            layoutId={`message-${nextMessageId}`}
                            transition={{ type: 'easeOut', duration: 0.2 }}
                            initial={{ opacity: 0.6, zIndex: -1 }}
                            animate={{ opacity: 0.6, zIndex: -1 }}
                            exit={{ opacity: 1, zIndex: 1 }}
                        >
                            <div className="copilot-textarea-preview-content">
                                {input}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

