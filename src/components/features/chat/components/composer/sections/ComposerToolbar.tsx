import React from 'react';
import { ModeSelector } from '../../../dropdowns/ModeSelector';
import { ToolsModal } from '../../modals/ToolPopover';
import { SearchControls } from '../../search/SearchControls';
import { ModelSelectorPopover } from '../ModelSelectorPopover';
import { Tooltip } from '@/components/ui/primitives';
import { Wrench } from 'lucide-react';
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
    isSearchActive
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
                            ? `Tools are locked in Search mode (${searchToolsCount} search tools available)`
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
                            {isSearchActive 
                                ? `${searchToolsCount} (Search)` 
                                : `${totalEnabledCount}${webMcpToolsCount > 0 ? ` (${webMcpToolsCount} Web)` : ''}${mcpToolsCount > 0 ? ` (${mcpToolsCount} MCP)` : ''}`}
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
            <SearchControls activeWorkflow={activeWorkflow} />

            {/* Model Selector - Gemini icon with model popover */}
            <ModelSelectorPopover />
        </div>
    );
};

