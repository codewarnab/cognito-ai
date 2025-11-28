import React from 'react';
import { ModeSelector } from '../../../dropdowns/ModeSelector';
import { ToolsModal } from '../../modals/ToolsModal';
import { SearchControls } from '../../search/SearchControls';
import { ModelSelectorPopover } from '../ModelSelectorPopover';
import { Tooltip } from '@/components/ui/primitives';
import { Wrench } from 'lucide-react';
import { HIDE_LOCAL_MODE } from '@/constants';
import type { AIMode, ModelState } from '../../../types';
import type { WorkflowDefinition } from '@/workflows/types';

interface ComposerToolbarProps {
    modelState: ModelState;
    onModeChange: (mode: AIMode) => void;
    showModeDropdown: boolean;
    onToggleModeDropdown: (show: boolean) => void;
    onError?: (message: string, type?: 'error' | 'warning' | 'info') => void;
    // Tools state
    enabledToolsCount: number;
    mcpToolsCount: number;
    totalEnabledCount: number;
    isTooManyTools: boolean;
    showToolsModal: boolean;
    setShowToolsModal: (show: boolean) => void;
    loadToolsCount: () => Promise<void>;
    setEnabledToolsCount: (count: number) => void;
    setMcpToolsCount: (count: number) => void;
    // Workflow/search state
    activeWorkflow: WorkflowDefinition | null;
    isSearchActive: boolean;
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
    enabledToolsCount,
    mcpToolsCount,
    totalEnabledCount,
    isTooManyTools,
    showToolsModal,
    setShowToolsModal,
    loadToolsCount,
    setEnabledToolsCount,
    setMcpToolsCount,
    activeWorkflow,
    isSearchActive
}) => {
    return (
        <div className="copilot-composer-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                <Tooltip
                    content={
                        isSearchActive
                            ? "Tools are locked in Search mode (only webSearch & retrieve available)"
                            : activeWorkflow
                                ? "Tools are managed by the active workflow"
                                : isTooManyTools
                                    ? "Too many tools enabled - may slow AI responses"
                                    : "Manage enabled tools"
                    }
                    position="top"
                    delay={200}
                >
                    <button
                        type="button"
                        className={`composer-tools-button ${activeWorkflow || isSearchActive ? 'disabled' : ''} ${isTooManyTools && !isSearchActive ? 'warning' : ''}`}
                        onClick={() => !activeWorkflow && !isSearchActive && setShowToolsModal(!showToolsModal)}
                        disabled={!!activeWorkflow || isSearchActive}
                        aria-label={isSearchActive ? "Tools locked in search mode" : "Manage enabled tools"}
                    >
                        <Wrench size={14} />
                        <span className="composer-tools-count">
                            {isSearchActive ? '2 (Search)' : `${totalEnabledCount}${mcpToolsCount > 0 ? ` (${mcpToolsCount} MCP)` : ''}`}
                        </span>
                    </button>
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
                        onCountChange={(extCount, mcpCount) => {
                            setEnabledToolsCount(extCount);
                            setMcpToolsCount(mcpCount);
                        }}
                    />
                )}
            </div>

            {/* Search Controls - Toggle and Depth Selector */}
            <SearchControls />

            {/* Model Selector - Gemini icon with model popover */}
            <ModelSelectorPopover />
        </div>
    );
};

