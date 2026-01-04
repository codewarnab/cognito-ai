import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ModeSelector } from '../../../dropdowns/ModeSelector';
import { ToolsModal } from '../../modals/ToolPopover';
import { SearchControls } from '../../search/SearchControls';
import { ModelSelectorPopover } from '../ModelSelectorPopover';
import { Wrench, Cloud, Key, Globe } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/primitives/tooltip';
import { HIDE_MODEL_SELECTOR } from '@/constants';
import { ENV } from '@/utils/env';
import { createLogger } from '~logger';
import { useSettingsStore, useToolsStore, type SettingsState, type ToolsState } from '@/stores';
import { useWebMCPTools } from '@/hooks/webmcp';
import { useBridgeHeartbeat } from '@/hooks/cliMode';
import { McpServerIcon } from '@/components/ui/tools/icons/McpIconMapper';

import { useCliModeStore } from '@/stores/cliMode/cliModeStore';
import type { CliModeState } from '@/stores/cliMode/types';
import { BridgePairingDrawer } from '../../../../cliMode/BridgePairingDrawer';
import type { AIMode, ModelState } from '@/ai/types/types';
import type { WorkflowDefinition } from '@/workflows/types';
import type { McpToolWithServer, ToolMode } from '@/stores/tools/types';

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
    // Get ToolsMode (chat/agent/adaptive/custom) - different from AIProviderMode (local/remote)
    const toolsMode = useToolsStore((s: ToolsState) => s.currentMode);
    const isAdaptiveMode = toolsMode === 'adaptive';

    // Get MCP tools data for server icons
    const mcpTools = useToolsStore((s: ToolsState) => s.mcpTools);
    const mcpDisabledTools = useToolsStore((s: ToolsState) => s.mcpDisabledTools);

    // Backend mode state
    const useBackendMode = useSettingsStore((s: SettingsState) => s.useBackendMode);

    // CLI Mode bridge state
    const bridgeStatus = useCliModeStore((s: CliModeState) => s.bridgeStatus);
    const checkBridgeHealth = useCliModeStore((s: CliModeState) => s.checkBridgeHealth);

    const [showPairingDrawer, setShowPairingDrawer] = useState(false);
    const [previousMode, setPreviousMode] = useState<ToolMode | null>(null);
    const setMode = useToolsStore((s: ToolsState) => s.setMode);

    // Track mode changes to store previous mode and show pairing drawer immediately
    const prevToolsModeRef = React.useRef<ToolMode | null>(null);
    useEffect(() => {
        // When entering cli mode
        if (toolsMode === 'cli' && prevToolsModeRef.current !== 'cli') {
            // Store previous mode for reverting if pairing is cancelled
            if (prevToolsModeRef.current) {
                setPreviousMode(prevToolsModeRef.current);
            }
            // Check bridge health and show pairing if not already paired
            checkBridgeHealth().then(() => {
                // Need to check bridgeToken since bridgeStatus may not have updated yet
                const currentStore = useCliModeStore.getState();
                if (currentStore.bridgeStatus === 'needs-pairing' || !currentStore.bridgeToken) {
                    setShowPairingDrawer(true);
                }
            });
        }
        prevToolsModeRef.current = toolsMode as ToolMode;
    }, [toolsMode, checkBridgeHealth]);

    // Also show pairing drawer if bridge status changes to needs-pairing while in cli mode
    useEffect(() => {
        if (toolsMode === 'cli' && bridgeStatus === 'needs-pairing') {
            setShowPairingDrawer(true);
        }
    }, [toolsMode, bridgeStatus]);

    // Bridge heartbeat - polls bridge health every 30s when in cli mode
    const handleBridgeDisconnect = useCallback(() => {
        log.warn('Bridge disconnected (detected by heartbeat)');
        // Show pairing drawer if bridge goes offline
        if (toolsMode === 'cli') {
            setShowPairingDrawer(true);
        }
    }, [toolsMode]);

    useBridgeHeartbeat({
        enabled: toolsMode === 'cli',
        onDisconnect: handleBridgeDisconnect,
    });

    // Handle drawer close - revert to previous mode if not paired
    const handlePairingDrawerClose = () => {
        setShowPairingDrawer(false);
        // If still not paired, revert to previous mode
        const currentBridgeToken = useCliModeStore.getState().bridgeToken;
        if (!currentBridgeToken && previousMode) {
            setMode(previousMode);
            setPreviousMode(null);
        }
    };

    // Get unique enabled MCP server IDs
    const enabledMcpServers = useMemo(() => {
        const serverMap = new Map<string, { serverId: string; serverName: string }>();
        mcpTools.forEach((tool: McpToolWithServer) => {
            // Only include servers that have at least one enabled tool
            const disabledList = mcpDisabledTools[tool.serverId] || [];
            if (!disabledList.includes(tool.name)) {
                serverMap.set(tool.serverId, { serverId: tool.serverId, serverName: tool.serverName });
            }
        });
        return Array.from(serverMap.values());
    }, [mcpTools, mcpDisabledTools]);

    // Get WebMCP tools data including favicon
    const { tools: webMcpTools } = useWebMCPTools();
    const webMcpFavicon = webMcpTools[0]?.favicon;
    const [faviconError, setFaviconError] = useState(false);

    // Debug logging for tools display
    log.info('🔧 ComposerToolbar render', {
        totalEnabledCount,
        mcpToolsCount,
        webMcpToolsCount,
        enabledMcpServers: enabledMcpServers.map(s => s.serverId),
        activeWorkflow: activeWorkflow?.name || null,
        isAdaptiveMode,
        toolsMode,
        aiProviderMode: modelState.mode
    });

    const setUseBackendMode = useSettingsStore((s: SettingsState) => s.setUseBackendMode);

    // Hide model picker when toolbar is crowded (MCP servers + WebMCP taking space)
    const shouldHideModelPicker = enabledMcpServers.length > 0 || webMcpToolsCount > 0;

    const getTooltipText = () => {
        if (activeWorkflow) return "Tools are managed by the active workflow";
        if (isTooManyTools) return "Too many tools enabled - may slow AI responses";
        return "Manage enabled tools";
    };

    return (
        <div className="flex items-center shrink-0" style={{ gap: '8px' }}>
            {!ENV.HIDE_LOCAL_MODE && (
                <ModeSelector
                    modelState={modelState}
                    onModeChange={onModeChange}
                    showModeDropdown={showModeDropdown}
                    onToggleDropdown={onToggleModeDropdown}
                    onError={onError}
                />
            )}

            {/* CLI Mode: Pairing Drawer (rendered before tools, but it's a modal overlay) */}
            {toolsMode === 'cli' && (
                <BridgePairingDrawer
                    isOpen={showPairingDrawer}
                    onClose={handlePairingDrawerClose}
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
                                {totalEnabledCount - webMcpToolsCount - mcpToolsCount}
                            </span>
                            {/* MCP Server Icons */}
                            {enabledMcpServers.length > 0 && (
                                <>
                                    <span style={{ fontSize: '10px', fontWeight: 400, opacity: 0.5, margin: '0 2px' }}>+</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                        {enabledMcpServers.slice(0, 3).map((server) => (
                                            <Tooltip key={server.serverId}>
                                                <TooltipTrigger asChild>
                                                    <span style={{ display: 'flex', alignItems: 'center' }}>
                                                        <McpServerIcon serverId={server.serverId} size={12} />
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent side="top">
                                                    {server.serverName}
                                                </TooltipContent>
                                            </Tooltip>
                                        ))}
                                        {enabledMcpServers.length > 3 && (
                                            <span style={{ fontSize: '9px', fontWeight: 400, opacity: 0.6 }}>
                                                +{enabledMcpServers.length - 3}
                                            </span>
                                        )}
                                    </div>
                                    <span style={{ fontSize: '10px', fontWeight: 400, opacity: 0.7 }}>
                                        {mcpToolsCount}
                                    </span>
                                </>
                            )}
                            {/* WebMCP Section */}
                            {webMcpToolsCount > 0 && (
                                <>
                                    <span style={{ fontSize: '10px', fontWeight: 400, opacity: 0.5, margin: '0 2px' }}>+</span>
                                    {webMcpFavicon && !faviconError ? (
                                        <img
                                            src={webMcpFavicon}
                                            alt=""
                                            width={12}
                                            height={12}
                                            style={{ opacity: 0.9, borderRadius: '2px' }}
                                            onError={() => setFaviconError(true)}
                                        />
                                    ) : (
                                        <Globe size={12} style={{ opacity: 0.7 }} />
                                    )}
                                    <span style={{ fontSize: '10px', fontWeight: 400, opacity: 0.7 }}>
                                        {webMcpToolsCount}
                                    </span>
                                </>
                            )}
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
                isAdaptiveMode={isAdaptiveMode}
                isCliMode={false}
            />

            {/* Model Selector - Gemini icon with model popover (hidden when toolbar is crowded, in backend mode, or in cli mode) */}
            {/* In backend mode, model is fixed to gemini-2.5-flash by the server */}
            {/* In cli mode, the agent selector is shown instead */}
            {!HIDE_MODEL_SELECTOR && !shouldHideModelPicker && !useBackendMode && toolsMode !== 'cli' && (
                <ModelSelectorPopover
                    isOpen={isModelSelectorOpen}
                    onOpenChange={setIsModelSelectorOpen}
                />
            )}

            {/* Backend Mode Toggle - Icon only, expands on hover (hidden in cli mode) */}
            {toolsMode !== 'cli' && (
                <>
                    <div className="flex items-center gap-1 border-l border-border/50 pl-2 ml-2">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    onClick={() => setUseBackendMode(!useBackendMode)}
                                    className="cursor-pointer backend-mode-btn"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0px',
                                        padding: '6px',
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
                                        transition: 'all 0.2s ease',
                                        overflow: 'hidden',
                                    }}
                                >
                                    {useBackendMode ? <Cloud size={14} /> : <Key size={14} />}
                                    <span
                                        className="whitespace-nowrap"
                                        style={{
                                            display: 'inline-block',
                                            maxWidth: '0px',
                                            opacity: 0,
                                            overflow: 'hidden',
                                            transition: 'max-width 0.2s ease, opacity 0.2s ease, margin-left 0.2s ease',
                                            marginLeft: '0px',
                                        }}
                                    >
                                        {useBackendMode ? 'Cloud' : 'BYOK'}
                                    </span>
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[210px] p-3">
                                <div className="flex flex-col gap-1.5">
                                    {useBackendMode ? (
                                        <>
                                            <div className="font-semibold text-sm flex items-center gap-1.5">
                                                <Cloud size={14} className="text-violet-500" />
                                                Cloud Backend
                                            </div>
                                            <div className="text-xs text-muted-foreground leading-normal">
                                                Using Cognito's hosted API. No API key required to get started.
                                            </div>
                                            <div className="text-[10px] text-amber-500/90 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded-sm w-fit">
                                                Rate limits apply
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="font-semibold text-sm flex items-center gap-1.5">
                                                <Key size={14} className="text-emerald-500" />
                                                BYOK Mode
                                            </div>
                                            <div className="text-xs text-muted-foreground leading-normal">
                                                Using your own API key for unlimited usage and higher rate limits.
                                            </div>
                                            <div className="text-[10px] text-emerald-600/90 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded-sm flex items-start gap-1.5">
                                                <span className="w-1 h-1 rounded-full bg-emerald-500 input-pulse mt-1 shrink-0" />
                                                <span className="leading-tight">Your API key never leaves your device</span>
                                            </div>
                                        </>
                                    )}
                                    <div className="text-[10px] text-muted-foreground/60 pt-1 border-t border-border/50 mt-0.5">
                                        Click to switch modes
                                    </div>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    <style>{`
                .backend-mode-btn:hover span {
                    max-width: 50px !important;
                    opacity: 1 !important;
                    margin-left: 6px !important;
                }
            `}</style>
                </>
            )}
        </div>
    );
};

