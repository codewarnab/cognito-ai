/**
 * CompactToolRenderer - Default renderer for tool calls using CompactToolCard
 * Provides consistent, space-efficient UI for all tool executions
 * 
 * Includes human-in-the-loop approval for:
 * - Built-in sensitive tools (navigateTo, executeScript, etc.)
 * - MCP server tools (all require approval)
 * - WebMCP website tools (all require approval)
 * 
 * Auto-approve options:
 * - Session approval (in-memory, resets on browser restart)
 * - Website/Server/Domain approval (persisted)
 * - Always/Tool approval (persisted, permanent)
 */

import { useMemo, useState, useEffect, useRef } from 'react';
import { CompactToolCard } from '@/components/ui/tools/cards';
import type { ToolUIState } from './ToolUIContext';
import { useToolUI } from './ToolUIContext';
import { TOOLS_REQUIRING_APPROVAL } from '../../setup/remoteMode';
import { getTool } from '../registryUtils';
import { createLogger } from '~logger';
import { useApprovalStore } from '@/stores/approval';
import { useToolsStore } from '@/stores';
import { extractDomainFromInput, supportsWebsiteApproval } from '../approvalConfig';
import {
    isMcpTool,
    isWebmcpTool,
    getWebmcpDomain,
    getMcpApprovalOptions,
    getWebmcpApprovalOptions,
    isWebmcpAutoApproved,
    getWebmcpApprovalReason,
} from '../mcpApprovalConfig';
import { getOriginalToolName, sanitizeToolName } from '@/utils/mcp/toolNameSanitizer';
import { getMcpToolExecutor, getToolServerId, registerMcpToolExecutor } from '@/utils/mcp/toolMetadataStore';
import { getWebMCPToolsFromBackground, getWebmcpToolExecutor } from '../webmcpTools';
import type { ApprovalOption } from '@/components/ui/tools/cards/ApprovalDropdown';
import { approveCliToolCall, denyCliToolCall } from '@/services/codeBridge/cliToolApproval';

const log = createLogger('CompactToolRenderer', 'TOOLS_EXECUTION');

interface CompactToolRendererProps {
    state: ToolUIState;
    messageId?: string;
    addToolOutput?: (params: { tool: string; toolCallId: string; output: any }) => void;
}

export function CompactToolRenderer({ state, messageId, addToolOutput }: CompactToolRendererProps) {
    const { toolName, state: toolState, input, output, errorText, toolCallId } = state;
    const { getCustomRenderers } = useToolUI();

    // Approval state management for human-in-the-loop
    const [approvalState, setApprovalState] = useState<'pending' | 'executing' | 'approved' | 'denied'>('pending');
    const [executionResult, setExecutionResult] = useState<any>(null);
    const [executionError, setExecutionError] = useState<string | null>(null);

    // Approval store integration (for built-in tools)
    const isAutoApproved = useApprovalStore((s) => s.isAutoApproved);
    const isMcpAutoApproved = useApprovalStore((s) => s.isMcpAutoApproved);
    const getMcpApprovalReason = useApprovalStore((s) => s.getMcpApprovalReason);
    const addSessionApproval = useApprovalStore((s) => s.addSessionApproval);
    const addWebsiteApproval = useApprovalStore((s) => s.addWebsiteApproval);
    const addAlwaysApproval = useApprovalStore((s) => s.addAlwaysApproval);
    const initializeApprovalStore = useApprovalStore((s) => s.initialize);
    const getApprovalReason = useApprovalStore((s) => s.getApprovalReason);
    const approvalStoreInitialized = useApprovalStore((s) => s.isInitialized);

    // Tools store integration (for MCP tool metadata rehydration)
    const mcpTools = useToolsStore((s) => s.mcpTools);
    const toolsMode = useToolsStore((s) => s.currentMode);
    const isCliMode = toolsMode === 'cli';

    // Initialize approval store on mount
    useEffect(() => {
        initializeApprovalStore();
    }, [initializeApprovalStore]);

    // ═══════════════════════════════════════════════════════════════════════════
    // Tool Type Detection
    // ═══════════════════════════════════════════════════════════════════════════

    // MCP tool detection can break after sidepanel reload because the in-memory
    // tool metadata registry resets. Use the tools store as a fallback source
    // of truth so pending approvals rehydrate correctly.
    const mcpToolMatch = useMemo(() => {
        if (!mcpTools || mcpTools.length === 0) return null;

        const normalized = toolName.toLowerCase();
        const original = getOriginalToolName(toolName).toLowerCase();
        const sanitized = sanitizeToolName(toolName).toLowerCase();

        return (
            mcpTools.find((t) => {
                const tName = String(t.name ?? '').toLowerCase();
                const tSanitized = sanitizeToolName(String(t.name ?? '')).toLowerCase();
                return (
                    tName === normalized ||
                    tName === original ||
                    tSanitized === normalized ||
                    tSanitized === sanitized
                );
            }) ?? null
        );
    }, [mcpTools, toolName]);

    const mcpServerIdFromStore = mcpToolMatch?.serverId ?? null;

    const isMcp = isMcpTool(toolName) || !!mcpServerIdFromStore;
    const isWebmcp = isWebmcpTool(toolName);
    const isBuiltinApproval = TOOLS_REQUIRING_APPROVAL.includes(toolName);

    // MCP/WebMCP tools all require approval; built-in only if in TOOLS_REQUIRING_APPROVAL
    const requiresApproval = isMcp || isWebmcp || isBuiltinApproval;
    const isWaitingForResult = toolState === 'input-available' && !output;

    // ═══════════════════════════════════════════════════════════════════════════
    // Domain/Server Extraction
    // ═══════════════════════════════════════════════════════════════════════════

    // State for current tab URL (needed for page interaction tools)
    const [currentTabUrl, setCurrentTabUrl] = useState<string | null>(null);

    // Fetch current tab URL for page interaction tools that need it for domain extraction
    useEffect(() => {
        const fetchCurrentTabUrl = async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab?.url) {
                    setCurrentTabUrl(tab.url);
                }
            } catch (error) {
                log.warn('Failed to get current tab URL:', error);
            }
        };

        if (requiresApproval && isWaitingForResult) {
            fetchCurrentTabUrl();
        }
    }, [requiresApproval, isWaitingForResult]);

    // Extract domain/server for approval options
    const mcpServerId = isMcp ? (mcpServerIdFromStore ?? getToolServerId(toolName) ?? null) : null;
    const webmcpDomain = isWebmcp ? getWebmcpDomain(toolName) : null;
    const builtinDomain = isBuiltinApproval ? extractDomainFromInput(toolName, input, currentTabUrl ?? undefined) : null;
    const showWebsiteOption = isBuiltinApproval && supportsWebsiteApproval(toolName) && !!builtinDomain;

    // ═══════════════════════════════════════════════════════════════════════════
    // Auto-Approval Check
    // ═══════════════════════════════════════════════════════════════════════════

    const hasAutoExecutedRef = useRef(false);
    const [autoApprovalReason, setAutoApprovalReason] = useState<string | null>(null);

    useEffect(() => {
        if (!requiresApproval || !isWaitingForResult || approvalState !== 'pending' || hasAutoExecutedRef.current) {
            return;
        }

        let isApproved = false;
        let reason: string | null = null;

        if (isMcp && mcpServerId) {
            isApproved = isMcpAutoApproved(toolName, mcpServerId);
            reason = getMcpApprovalReason(toolName, mcpServerId);
        } else if (isWebmcp && webmcpDomain) {
            isApproved = isWebmcpAutoApproved(toolName);
            reason = getWebmcpApprovalReason(toolName);
        } else if (isBuiltinApproval) {
            isApproved = isAutoApproved(toolName, builtinDomain ?? undefined);
            reason = getApprovalReason(toolName, builtinDomain ?? undefined);
        }

        if (isApproved) {
            if (reason) setAutoApprovalReason(reason);
            log.info('🔓 Auto-executing approved tool:', { toolName, reason, isMcp, isWebmcp, isBuiltinApproval });
            hasAutoExecutedRef.current = true;
            handleApprove();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        requiresApproval,
        isWaitingForResult,
        approvalState,
        toolName,
        mcpServerId,
        webmcpDomain,
        builtinDomain,
        approvalStoreInitialized,
    ]);

    const isPendingApproval = requiresApproval && isWaitingForResult && approvalState === 'pending' && !hasAutoExecutedRef.current;

    // ═══════════════════════════════════════════════════════════════════════════
    // Approval Handlers
    // ═══════════════════════════════════════════════════════════════════════════

    const handleApprove = async () => {
        if (!toolCallId) {
            log.error('🛡️ Cannot approve - no toolCallId');
            return;
        }

        log.info('🛡️ User approved tool execution:', { toolName, toolCallId, input, isMcp, isWebmcp });
        setApprovalState('executing');

        // CLI mode: tool execution is driven by the local cli-bridge.
        // The UI must ONLY signal approval; the bridge will execute and stream back tool_result.
        if (isCliMode) {
            approveCliToolCall(toolCallId);
            return;
        }

        try {
            let result: any;

            if (isMcp) {
                // Execute MCP tool via stored executor
                const lookupNames = [toolName, mcpToolMatch?.name].filter(Boolean) as string[];
                let executor =
                    lookupNames.map((n) => getMcpToolExecutor(n)).find(Boolean) ??
                    undefined;

                // If executor registry was reset (sidepanel reload), rebuild it lazily.
                // We can construct a proxy executor from the MCP tools store (serverId + tool name).
                if (!executor && mcpServerId) {
                    const executableToolName = mcpToolMatch?.name ?? toolName;
                    executor = async (toolInput: any) => {
                        log.info(`🔧 Executing ${executableToolName} via background proxy (rehydrated)`, {
                            serverId: mcpServerId,
                            input: toolInput,
                        });

                        const response = await chrome.runtime.sendMessage({
                            type: `mcp/${mcpServerId}/tool/call`,
                            payload: {
                                name: executableToolName,
                                arguments: toolInput,
                            },
                        });

                        if (!response?.success) {
                            throw new Error(response?.error || 'Tool execution failed');
                        }

                        return response.data;
                    };

                    // Register under the canonical tool name so future lookups work
                    registerMcpToolExecutor(executableToolName, executor);
                }

                if (!executor) {
                    throw new Error(`MCP tool executor not found: ${toolName}`);
                }
                result = await executor(input);
            } else if (isWebmcp) {
                // Execute WebMCP tool via stored executor
                let executor = getWebmcpToolExecutor(toolName);
                // WebMCP executors are also in-memory; rehydrate from background if missing.
                if (!executor) {
                    await getWebMCPToolsFromBackground();
                    executor = getWebmcpToolExecutor(toolName);
                }
                if (!executor) {
                    throw new Error(`WebMCP tool executor not found: ${toolName}`);
                }
                result = await executor(input);
            } else {
                // Execute built-in tool via registry
                const tool = getTool(toolName);
                if (!tool) {
                    throw new Error(`Tool "${toolName}" not found in registry`);
                }
                result = await tool.execute(input);
            }

            setExecutionResult(result);
            setApprovalState('approved');
            log.info('🛡️ Tool execution completed:', { toolName, result });

            // Send result to AI to continue conversation
            addToolOutput?.({
                tool: toolName,
                toolCallId,
                output: result,
            });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            log.error('🛡️ Tool execution failed:', { toolName, error: errorMsg });
            setExecutionError(errorMsg);
            setApprovalState('approved'); // Still transition to approved (with error)

            // Send error result to AI
            addToolOutput?.({
                tool: toolName,
                toolCallId,
                output: { error: true, message: errorMsg },
            });
        }
    };

    const handleDeny = () => {
        if (!toolCallId) {
            log.error('🛡️ Cannot deny - no toolCallId');
            return;
        }

        log.info('🛡️ User denied tool execution:', { toolName, toolCallId });
        setApprovalState('denied');

        if (isCliMode) {
            denyCliToolCall(toolCallId, 'User denied this action.');
            return;
        }

        addToolOutput?.({
            tool: toolName,
            toolCallId,
            output: { denied: true, message: 'User denied this action.' },
        });
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // Built-in Tool Auto-Approval Handlers
    // ═══════════════════════════════════════════════════════════════════════════

    const handleApproveSession = () => {
        log.info('🔓 User enabled session auto-approval:', { toolName });
        addSessionApproval(toolName);
        handleApprove();
    };

    const handleApproveWebsite = () => {
        if (!builtinDomain) return;
        log.info('🌐 User enabled website auto-approval:', { toolName, domain: builtinDomain });
        addWebsiteApproval(toolName, builtinDomain);
        handleApprove();
    };

    const handleApproveAlways = () => {
        log.info('✅ User enabled always auto-approval:', { toolName });
        addAlwaysApproval(toolName);
        handleApprove();
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // MCP/WebMCP Approval Options (for dropdown)
    // ═══════════════════════════════════════════════════════════════════════════

    let approvalOptions: ApprovalOption[] = [];

    if (isPendingApproval) {
        if (isMcp && mcpServerId) {
            approvalOptions = getMcpApprovalOptions(toolName, mcpServerId, handleApprove);
        } else if (isWebmcp && webmcpDomain) {
            approvalOptions = getWebmcpApprovalOptions(toolName, webmcpDomain, handleApprove);
        }
        // Built-in tools use the existing props-based approach
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UI State Mapping
    // ═══════════════════════════════════════════════════════════════════════════

    const hasError = output && (output.success === false || output.error === true || output.error);

    const toolCompleted = toolState === 'output-available' || toolState === 'output-error';

    let uiState: 'loading' | 'success' | 'error' | 'pending-approval';
    if (toolCompleted) {
        // Never let local "executing" state mask a real streamed result.
        if (toolState === 'output-error') {
            uiState = 'error';
        } else {
            uiState = hasError ? 'error' : 'success';
        }
    } else if (isPendingApproval) {
        uiState = 'pending-approval';
    } else if (approvalState === 'executing') {
        uiState = 'loading';
    } else if (approvalState === 'denied') {
        uiState = 'error';
    } else if (approvalState === 'approved') {
        uiState = executionError ? 'error' : 'success';
    } else if (toolState === 'input-streaming' || toolState === 'input-available') {
        uiState = 'loading';
    } else {
        uiState = 'error';
    }

    let displayErrorText = errorText;
    if (approvalState === 'denied') {
        displayErrorText = 'Action denied by user';
    } else if (executionError) {
        displayErrorText = executionError;
    } else if (hasError) {
        displayErrorText = typeof output.error === 'string' ? output.error : output.answer || errorText;
    }

    // In CLI mode, tool execution happens externally (bridge), so always display streamed output.
    const displayOutput = isCliMode ? output : (approvalState === 'approved' ? executionResult : output);
    const customRenderers = getCustomRenderers(toolName);

    // Determine which approval props to pass
    // For MCP/WebMCP, we pass approvalOptions to the card
    // For built-in tools, we use the individual handler props
    const isMcpOrWebmcp = isMcp || isWebmcp;

    return (
        <CompactToolCard
            toolName={toolName}
            state={uiState}
            input={input}
            output={displayOutput}
            errorText={displayErrorText}
            customRenderers={customRenderers}
            messageId={messageId}
            // Approval handlers
            onApprove={isPendingApproval ? handleApprove : undefined}
            onDeny={isPendingApproval ? handleDeny : undefined}
            // Built-in tool auto-approve handlers (not used for MCP/WebMCP)
            onApproveSession={isPendingApproval && !isMcpOrWebmcp ? handleApproveSession : undefined}
            onApproveWebsite={isPendingApproval && !isMcpOrWebmcp && showWebsiteOption ? handleApproveWebsite : undefined}
            onApproveAlways={isPendingApproval && !isMcpOrWebmcp ? handleApproveAlways : undefined}
            showWebsiteOption={!isMcpOrWebmcp && showWebsiteOption}
            websiteLabel={builtinDomain ?? undefined}
            // MCP/WebMCP approval options (passed to dropdown)
            approvalOptions={isMcpOrWebmcp ? approvalOptions : undefined}
            // Auto-approval reason display
            autoApprovalReason={autoApprovalReason ?? undefined}
        />
    );
}
