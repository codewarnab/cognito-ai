import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSuggestions } from '@/hooks/suggestions';
import { TextMorph } from '@/components/ui/feedback';
import type { Message, ModelState } from '../../types';
import type { FileAttachmentData } from '../attachments/FileAttachment';
import type { WorkflowDefinition } from '@/workflows/types';
import { createLogger } from '~logger';
import { getSuggestionsEnabled } from '@/utils/settings';

const log = createLogger('SuggestedActions');

interface SuggestedActionsProps {
    messages: Message[];
    input: string;
    isLoading: boolean;
    activeWorkflow: WorkflowDefinition | null;
    attachments: FileAttachmentData[];
    isRecording?: boolean;
    modelState: ModelState;
    onSuggestionClick: (action: string) => void;
    tabAttachments?: Array<{ id: string; title: string; url: string; favIconUrl?: string }>;
    /** Whether the YouTube video suggestion badge is showing */
    shouldShowYouTubeVideoSuggestion?: boolean;
}

// Fallback suggestions (static) - only shown when generation fails
const FALLBACK_SUGGESTIONS = [
    {
        title: 'Find my recent GitHub visits',
        action: 'Find my recent GitHub visits from this morning',
    },
    {
        title: 'Set a reminder for',
        action: 'Set a reminder for my meeting tomorrow at 2pm',
    },
];

export const SuggestedActions: React.FC<SuggestedActionsProps> = ({
    messages,
    input,
    isLoading,
    activeWorkflow,
    attachments,
    isRecording,
    modelState,
    onSuggestionClick,
    tabAttachments = [],
    shouldShowYouTubeVideoSuggestion = false,
}) => {
    // Track if user has manually dismissed suggestions
    const [userDismissed, setUserDismissed] = useState(false);
    // Track if suggestions are enabled in settings
    const [suggestionsEnabled, setSuggestionsEnabled] = useState(true);

    // Load suggestions enabled setting
    useEffect(() => {
        const loadSetting = async () => {
            const enabled = await getSuggestionsEnabled();
            setSuggestionsEnabled(enabled);
        };
        loadSetting();
    }, []);

    // Use AI suggestions hook - only when enabled
    const { suggestions: aiSuggestions, isGenerating, error: suggestionError } = useSuggestions(
        modelState,
        messages.length,
        suggestionsEnabled
    );

    // Debug logging
    useEffect(() => {
        log.info('SuggestedActions state:', {
            mode: modelState.mode,
            messagesLength: messages.length,
            inputLength: input.length,
            aiSuggestions: aiSuggestions?.length || 0,
            isGenerating,
            suggestionError: suggestionError?.message,
            attachmentsCount: attachments.length,
            tabAttachmentsCount: tabAttachments.length,
            userDismissed,
            isLoading,
            activeWorkflow: !!activeWorkflow,
            isRecording
        });
    }, [aiSuggestions, isGenerating, suggestionError, messages.length, modelState.mode, input, attachments.length, tabAttachments.length, userDismissed, isLoading, activeWorkflow, isRecording]);

    // Determine which suggestions to show:
    // - If generating: show skeleton/loading (no suggestions yet)
    // - If AI suggestions available: show AI suggestions
    // - If error occurred: show fallback suggestions
    const suggestedActions = aiSuggestions || (suggestionError ? FALLBACK_SUGGESTIONS : []);

    // Calculate if suggestions should be shown based on conditions
    // Reset userDismissed when input is cleared and no messages exist
    const shouldShowSuggestions = messages.length === 0 && !input.trim();

    // Reset dismissal state when conditions allow showing suggestions again
    useEffect(() => {
        if (shouldShowSuggestions && userDismissed) {
            setUserDismissed(false);
        }
    }, [shouldShowSuggestions, userDismissed]);

    const showSuggestedActions =
        suggestionsEnabled &&
        messages.length === 0 &&
        !input.trim() &&
        !isLoading &&
        !activeWorkflow &&
        !userDismissed &&
        attachments.length === 0 &&
        tabAttachments.length === 0 &&
        !shouldShowYouTubeVideoSuggestion;

    const handleSuggestionClick = (action: string) => {
        onSuggestionClick(action);
        setUserDismissed(true);
    };

    return (
        <AnimatePresence>
            {showSuggestedActions && !isRecording && (
                <motion.div
                    key="suggested-actions-container"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.2 }}
                    className="suggested-actions-container"
                >
                    {/* Show loading indicator when generating (no suggestions yet) */}
                    {isGenerating && suggestedActions.length === 0 ? (
                        <div className="suggested-actions-loading-state">
                            <div className="loading-shimmer">Generating suggestions...</div>
                            <div className="suggested-actions-grid">
                                {[1, 2].map((i) => (
                                    <div key={`skeleton-${i}`} className="suggested-action-skeleton">
                                        <div className="skeleton-shimmer"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* Show actual suggestions (AI or fallback on error) */
                        <div className="suggested-actions-grid">
                            {suggestedActions.map((suggestedAction, index) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 20 }}
                                    transition={{ delay: 0.05 * index }}
                                    key={`suggested-action-${index}`}
                                >
                                    <button
                                        onClick={() => handleSuggestionClick(suggestedAction.action)}
                                        className="suggested-action-button"
                                        style={{
                                            overflow: 'hidden',
                                            maxWidth: '100%',
                                            padding: '8px 12px',
                                            whiteSpace: 'normal'
                                        }}
                                    >
                                        <TextMorph
                                            className="suggested-action-title"
                                            style={{
                                                display: 'inline',
                                                width: '100%',
                                                fontSize: '0.875rem',
                                                lineHeight: '1.4',
                                                overflowWrap: 'break-word',
                                                wordBreak: 'normal',
                                                hyphens: 'auto',
                                                textAlign: 'left'
                                            }}
                                        >
                                            {suggestedAction.title}
                                        </TextMorph>
                                    </button>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

