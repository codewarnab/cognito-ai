import React from 'react';
import { ModeSelector } from '../../../dropdowns/ModeSelector';
import { ToolsModal } from '../../modals/ToolPopover';
import { SearchControls } from '../../search/SearchControls';
import { ModelSelectorPopover } from '../ModelSelectorPopover';
import { Wrench, Cloud, Key } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/primitives/tooltip';
import { HIDE_LOCAL_MODE, HIDE_MODEL_SELECTOR } from '@/constants';
import { createLogger } from '~logger';
import { useSettingsStore, type SettingsState } from '@/stores';
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
    // Workflow state
    activeWorkflow: WorkflowDefinition | null;
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
    isModelSelectorOpen,
    setIsModelSelectorOpen
}) => {
    // Debug logging for tools display
    log.info('🔧 ComposerToolbar render', {
        totalEnabledCount,
        mcpToolsCount,
        webMcpToolsCount,
        activeWorkflow: activeWorkflow?.name || null,
        isAdaptiveMode: modelState.mode === 'adaptive'
    });

    // Backend mode state
    const useBackendMode = useSettingsStore((s: SettingsState) => s.useBackendMode);
    const setUseBackendMode = useSettingsStore((s: SettingsState) => s.setUseBackendMode);

    const getTooltipText = () => {
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
                            onClick={() => !activeWorkflow && setShowToolsModal(!showToolsModal)}
                            disabled={!!activeWorkflow}
                            aria-label="Manage enabled tools"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: 'none',
                                background: 'transparent',
                                color: isTooManyTools
                                    ? 'var(--color-warning, #f59e0b)'
                                    : activeWorkflow
                                        ? 'var(--text-tertiary, #6b7280)'
                                        : 'var(--text-secondary, #9ca3af)',
                                cursor: activeWorkflow ? 'not-allowed' : 'pointer',
                                opacity: activeWorkflow ? 0.5 : 1,
                                transition: 'color 0.15s, opacity 0.15s',
                                fontSize: '12px',
                                fontWeight: 800,
                            }}
                        >
                            <Wrench size={14} />
                            <span style={{ fontSize: '10px', fontWeight: 400 }}>
                                {totalEnabledCount}
                            </span>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                        {getTooltipText()}
                    </TooltipContent>
                </Tooltip>

                {/* Tools Popover */}
                {(
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

            {/* Search Controls - Toggle and Depth Selector (hidden in adaptive mode) */}
            <SearchControls
                activeWorkflow={activeWorkflow}
                isAdaptiveMode={modelState.mode === 'adaptive'}
            />

            {/* Model Selector - Gemini icon with model popover */}
            {!HIDE_MODEL_SELECTOR && (
                <ModelSelectorPopover
                    isOpen={isModelSelectorOpen}
                    onOpenChange={setIsModelSelectorOpen}
                />
            )}

            {/* Backend Mode Toggle */}
            <div className="flex items-center gap-1 border-l border-border/50 pl-2 ml-2">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            onClick={() => setUseBackendMode(!useBackendMode)}
                            className="cursor-pointer"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: 'none',
                                background: useBackendMode
                                    ? 'rgba(139, 92, 246, 0.1)'
                                    : 'rgba(156, 163, 175, 0.1)',
                                color: useBackendMode
                                    ? 'rgb(139, 92, 246)'
                                    : 'var(--text-secondary, #9ca3af)',
                                fontSize: '12px',
                                fontWeight: 500,
                                transition: 'all 0.15s',
                            }}
                        >
                            {useBackendMode ? (
                                <>
                                    <Cloud size={14} />
                                    <span>Backend</span>
                                </>
                            ) : (
                                <>
                                    <Key size={14} />
                                    <span>BYOK</span>
                                </>
                            )}
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px]">
                        <p className="text-xs">
                            {useBackendMode
                                ? "Using Cognito's API (rate limited, no API key needed)"
                                : "Using your API key (unlimited, key stays on device)"
                            }
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Click to switch modes
                        </p>
                    </TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
};

