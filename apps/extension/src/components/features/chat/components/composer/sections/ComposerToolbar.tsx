import React from 'react';
import { ModeSelector } from '../../../dropdowns/ModeSelector';
import { ToolsModal } from '../../modals/ToolPopover';
import { SearchControls } from '../../search/SearchControls';
import { ModelSelectorPopover } from '../ModelSelectorPopover';
import { Wrench } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/primitives/tooltip';
import { HIDE_LOCAL_MODE } from '@/constants';
import { SEARCH_TOOL_NAMES } from '@/ai/tools/searchToolFilter';
import { createLogger } from '~logger';
import type { AIMode, ModelState } from '../../../types';
import type { WorkflowDefinition } from '@/workflows/types';

const log = createLogger('ComposerToolbar', 'AI_CHAT');

interface ComposerToolbarProps {
    modelState: ModelState;
    onModeChange: (mode: AIMode) => void;
    showModeDropdown: boolean;
    onToggleModeDropdown: (show: boolean) => void;
    onError?: (message: string, type?: 'error' | 'warning' | 'info') => void;
    // Tools state
    mcpToolsCount: number;
    webMcpToolsCount: number;
    totalEnabledCount: number;
    isTooManyTools: boolean;
    showToolsModal: boolean;
    setShowToolsModal: (show: boolean) => void;
    loadToolsCount: () => Promise<void>;
    setEnabledToolsCount: () => void;
    setMcpToolsCount: () => void;
    // Workflow/search state
    activeWorkflow: WorkflowDefinition | null;
    isSearchActive: boolean;
    // Model selector state
    isModelSelectorOpen?: boolean;
    setIsModelSelectorOpen?: (isOpen: boolean) => void;
}

/**
 * Left side toolbar with mode selector, tools button, search controls, and model selector.
 */
export const ComposerToolbar: React.FC<ComposerToolbarProps> = ({
    modelState,
    onModeChange,
    showModeDropdown,
    onToggleModeDropdown,
    onError,
    mcpToolsCount,
    webMcpToolsCount,
    totalEnabledCount,
    isTooManyTools,
    showToolsModal,
    setShowToolsModal,
    loadToolsCount,
    setEnabledToolsCount,
    setMcpToolsCount,
    activeWorkflow,
    isSearchActive,
    isModelSelectorOpen,
    setIsModelSelectorOpen
}) => {
    // Debug logging for tools display
    const searchToolsCount = SEARCH_TOOL_NAMES.length;
    log.info('🔧 ComposerToolbar render', {
        isSearchActive,
        totalEnabledCount,
        mcpToolsCount,
        webMcpToolsCount,
        searchToolsCount,
        activeWorkflow: activeWorkflow?.name || null,
        toolsDisplay: isSearchActive ? `${searchToolsCount} (Search)` : `${totalEnabledCount}`
    });

    const getTooltipText = () => {
        if (isSearchActive) return `Tools are locked in Search mode (${searchToolsCount} search tools available)`;
        if (activeWorkflow) return "Tools are managed by the active workflow";
        if (isTooManyTools) return "Too many tools enabled - may slow AI responses";
        return "Manage enabled tools";
    };

    return (
        <div className="flex items-center shrink-0" style={{ gap: '8px' }}>
            {!HIDE_LOCAL_MODE && (
                <ModeSelector
                    modelState={modelState}
                    onModeChange={onModeChange}
                    showModeDropdown={showModeDropdown}
                    onToggleDropdown={onToggleModeDropdown}
                    onError={onError}
                />
            )}

            <div style={{ position: 'relative' }}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            onClick={() => !activeWorkflow && !isSearchActive && setShowToolsModal(!showToolsModal)}
                            disabled={!!activeWorkflow || isSearchActive}
                            aria-label={isSearchActive ? "Tools locked in search mode" : "Manage enabled tools"}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: 'none',
                                background: 'transparent',
                                color: isTooManyTools && !isSearchActive
                                    ? 'var(--color-warning, #f59e0b)'
                                    : activeWorkflow || isSearchActive
                                        ? 'var(--text-tertiary, #6b7280)'
                                        : 'var(--text-secondary, #9ca3af)',
                                cursor: activeWorkflow || isSearchActive ? 'not-allowed' : 'pointer',
                                opacity: activeWorkflow || isSearchActive ? 0.5 : 1,
                                transition: 'color 0.15s, opacity 0.15s',
                                fontSize: '12px',
                                fontWeight: 800,
                            }}
                        >
                            <Wrench size={14} />
                            <span style={{ fontSize: '10px', fontWeight: 400 }}>
                                {isSearchActive ? searchToolsCount : totalEnabledCount}
                            </span>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                        {getTooltipText()}
                    </TooltipContent>
                </Tooltip>

                {/* Tools Popover - hidden when search mode is active */}
                {!isSearchActive && (
                    <ToolsModal
                        isOpen={showToolsModal}
                        onClose={() => {
                            setShowToolsModal(false);
                            // Refresh tools count after modal closes
                            loadToolsCount();
                        }}
                        onCountChange={() => {
                            setEnabledToolsCount();
                            setMcpToolsCount();
                        }}
                    />
                )}
            </div>

            {/* Search Controls - Toggle and Depth Selector */}
            <SearchControls activeWorkflow={activeWorkflow} />

            {/* Model Selector - Gemini icon with model popover */}
            <ModelSelectorPopover
                isOpen={isModelSelectorOpen}
                onOpenChange={setIsModelSelectorOpen}
            />
        </div>
    );
};

