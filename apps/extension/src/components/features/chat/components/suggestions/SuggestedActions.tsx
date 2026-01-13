import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useSuggestions } from '@/hooks/suggestions';
import { CliAgentSelector } from '@/components/features/cliMode';
import { useToolsStore } from '@/stores';
import type { ToolsState } from '@/stores/tools/types';
import type { Message, ModelState } from '../../types';
import type { FileAttachmentData } from '../attachments/FileAttachment';
import type { WorkflowDefinition } from '@/workflows/types';
import { createLogger } from '~logger';
import { getSuggestionsEnabled } from '@/utils/settings';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/primitives/tooltip';

const log = createLogger('SuggestedActions', 'UI_CHAT_COMPONENTS');

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
    /** Whether the selected text suggestion badge is showing */
    shouldShowSelectedTextSuggestion?: boolean;
}

// Fallback suggestions (static) - only shown when generation fails
// Titles are progressively longer: 2-3 words, 3-4 words, 4-6 words
const FALLBACK_SUGGESTIONS = [
    {
        title: 'Search tabs',
        action: 'Search my open tabs',
    },
    {
        title: 'Find recent visits',
        action: 'Find my recent GitHub visits from this morning',
    },
    {
        title: 'Set reminder for tomorrow',
        action: 'Set a reminder for my meeting tomorrow at 2pm',
    },
];

const getPillSizeClasses = (index: number) => {
    // Base sizes (Pill 1, 2, 3) with max-width constraints
    // Each pill is progressively slightly larger, with the 3rd capped to prevent overflow
    // Using overflow-hidden + mask gradient for smooth fade (no ellipsis)
    const truncateClasses = 'overflow-hidden';
    switch (index) {
        case 0: // Pill 1 - smallest, max ~140px
            return `text-xs py-[7px] px-[14px] max-w-[140px] ${truncateClasses} max-[480px]:text-[11px] max-[480px]:py-1 max-[480px]:px-2.5 max-[480px]:max-w-[120px] max-[360px]:text-[10px] max-[360px]:py-1 max-[360px]:px-2 max-[360px]:max-w-[100px]`;
        case 1: // Pill 2 - medium, max ~170px
            return `text-[13px] py-[9px] px-4 max-w-[170px] ${truncateClasses} max-[480px]:text-xs max-[480px]:py-[5px] max-[480px]:px-3 max-[480px]:max-w-[140px] max-[360px]:text-[11px] max-[360px]:py-1 max-[360px]:px-2.5 max-[360px]:max-w-[120px]`;
        case 2: // Pill 3 - largest but capped, max ~200px (only slightly bigger than pill 2)
            return `text-sm py-[11px] px-[18px] max-w-[200px] ${truncateClasses} max-[480px]:text-[13px] max-[480px]:py-1.5 max-[480px]:px-3.5 max-[480px]:max-w-[170px] max-[360px]:text-xs max-[360px]:py-[5px] max-[360px]:px-3 max-[360px]:max-w-[140px]`;
        default:
            return `text-xs py-[7px] px-[14px] max-w-[140px] ${truncateClasses}`;
    }
};

// Fade mask style for smooth text truncation
const getFadeMaskStyle = (): React.CSSProperties => ({
    maskImage: 'linear-gradient(to right, black 75%, transparent 100%)',
    WebkitMaskImage: 'linear-gradient(to right, black 75%, transparent 100%)',
});

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
    shouldShowSelectedTextSuggestion = false,
}) => {
    // Track if user has manually dismissed suggestions
    const [userDismissed, setUserDismissed] = useState(false);
    // Track if suggestions are enabled in settings
    // Start with null to indicate "not yet loaded" - prevents API calls before we know the setting
    const [suggestionsEnabled, setSuggestionsEnabled] = useState<boolean | null>(null);

    // Check if we're in code mode - show agent selector instead of suggestions
    const toolsMode = useToolsStore((s: ToolsState) => s.currentMode);
    const isCodeMode = toolsMode === 'cli';

    // Load suggestions enabled setting
    useEffect(() => {
        const loadSetting = async () => {
            const enabled = await getSuggestionsEnabled();
            setSuggestionsEnabled(enabled);
        };
        loadSetting();
    }, []);

    // Use AI suggestions hook - only when enabled AND setting has been loaded
    // Pass false while loading (null) to prevent premature API calls
    const { suggestions: aiSuggestions, isGenerating, error: suggestionError } = useSuggestions(
        modelState,
        messages.length,
        suggestionsEnabled === true // Only enable when explicitly true (not null or false)
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
            isRecording,
            suggestionsEnabled,
            isCodeMode,
            toolsMode
        });
    }, [aiSuggestions, isGenerating, suggestionError, messages.length, modelState.mode, input, attachments.length, tabAttachments.length, userDismissed, isLoading, activeWorkflow, isRecording, suggestionsEnabled, isCodeMode, toolsMode]);

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
        suggestionsEnabled === true &&
        messages.length === 0 &&
        !input.trim() &&
        !isLoading &&
        !activeWorkflow &&
        !userDismissed &&
        attachments.length === 0 &&
        tabAttachments.length === 0 &&
        !shouldShowYouTubeVideoSuggestion &&
        !shouldShowSelectedTextSuggestion;

    const handleSuggestionClick = (action: string) => {
        onSuggestionClick(action);
        setUserDismissed(true);
    };

    // In CLI mode, show both agent selector and suggestions together
    const showCliAgentSelector = isCodeMode;
    const showSuggestionPills = showSuggestedActions && !isRecording;

    // Don't render anything if neither should show
    if (!showCliAgentSelector && !showSuggestionPills) {
        return null;
    }

    // CLI mode layout - agent selector on left, right-aligned suggestion pills
    if (isCodeMode) {
        return (
            <div className="absolute bottom-full left-0 right-0 mb-2 px-3 z-[-1] pointer-events-auto max-[480px]:mb-1.5 max-[480px]:px-2.5">
                <div className="flex items-end gap-3">
                    {/* CLI Agent Selector - aligned to bottom */}
                    <div className="flex-shrink-0">
                        <CliAgentSelector inline />
                    </div>

                    {/* Right-aligned suggestion pills */}
                    {showSuggestionPills && suggestedActions.length > 0 && (
                        <div className="flex-1 flex justify-end">
                            <AnimatePresence>
                                <motion.div
                                    key="cli-suggestions-container"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 20 }}
                                    transition={{ duration: 0.2 }}
                                    className="max-w-[60%] max-[480px]:max-w-[55%]"
                                >
                                    <div className="flex flex-col items-end gap-1 max-[480px]:gap-[5px]">
                                        {suggestedActions.map((suggestedAction, index) => (
                                            <motion.div
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 20 }}
                                                transition={{ delay: 0.05 * index }}
                                                key={`cli-suggestion-${index}`}
                                            >
                                                <Tooltip delayDuration={300}>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            onClick={() => handleSuggestionClick(suggestedAction.action)}
                                                            className={`
                                                                inline-flex items-center text-left bg-white/[0.04] border-none rounded-full 
                                                                text-white/60 font-normal leading-[1.3] cursor-pointer transition-all duration-150 
                                                                whitespace-nowrap w-auto min-h-auto max-h-none h-auto flex-row hover:bg-white/[0.08] 
                                                                hover:text-white/85 hover:transform-none hover:shadow-none active:bg-white/[0.06] active:scale-98
                                                                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/[0.04] disabled:hover:transform-none
                                                                ${getPillSizeClasses(index)}
                                                            `}
                                                            style={getFadeMaskStyle()}
                                                        >
                                                            {suggestedAction.title}
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="max-w-[280px] text-wrap">
                                                        {suggestedAction.title}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </motion.div>
                                        ))}
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Standard mode - vertical pill layout aligned to the right
    return (
        <div className="absolute bottom-full left-0 right-0 mb-2 px-3 z-[-1] pointer-events-auto max-[480px]:mb-1.5 max-[480px]:px-2.5 flex justify-end">
            <AnimatePresence>
                {showSuggestionPills && (
                    <motion.div
                        key="suggested-actions-container"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className="max-w-[70%] max-[480px]:max-w-[65%] max-[360px]:max-w-[60%]"
                    >
                        {/* Show loading indicator when generating (no suggestions yet) */}
                        {isGenerating && suggestedActions.length === 0 ? (
                            <div className="flex flex-col items-end gap-1.5">
                                <div className="hidden">Generating suggestions...</div>
                                <div className="flex flex-col items-end gap-1 w-auto max-w-none max-[480px]:gap-[5px]">
                                    {[1, 2, 3].map((i, index) => (
                                        <div
                                            key={`skeleton-${i}`}
                                            className="h-6 bg-white/[0.03] rounded-[14px] relative overflow-hidden"
                                            style={{ width: index === 0 ? 80 : index === 1 ? 110 : 140 }}
                                        >
                                            <div className="absolute top-0 -left-full w-full h-full bg-gradient-to-r from-transparent via-white/[0.06] to-transparent animate-[shimmer_1.5s_infinite]"></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            /* Show actual suggestions (AI or fallback on error) */
                            <div className="flex flex-col items-end gap-1 w-auto max-w-none max-[480px]:gap-[5px]">
                                {suggestedActions.map((suggestedAction, index) => (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 20 }}
                                        transition={{ delay: 0.05 * index }}
                                        key={`suggested-action-${index}`}
                                    >
                                        <Tooltip delayDuration={300}>
                                            <TooltipTrigger asChild>
                                                <button
                                                    onClick={() => handleSuggestionClick(suggestedAction.action)}
                                                    className={`
                                                    inline-flex items-center text-left bg-white/[0.04] border-none rounded-full 
                                                    text-white/60 font-normal leading-[1.3] cursor-pointer transition-all duration-150 
                                                    whitespace-nowrap w-auto min-h-auto max-h-none h-auto flex-row hover:bg-white/[0.08] 
                                                    hover:text-white/85 hover:transform-none hover:shadow-none active:bg-white/[0.06] active:scale-98
                                                    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/[0.04] disabled:hover:transform-none
                                                    ${getPillSizeClasses(index)}
                                                `}
                                                    style={getFadeMaskStyle()}
                                                >
                                                    {suggestedAction.title}
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="max-w-[280px] text-wrap">
                                                {suggestedAction.title}
                                            </TooltipContent>
                                        </Tooltip>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

