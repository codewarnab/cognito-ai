/**
 * Custom renderer for executeTools that displays each sub-tool call
 * using CompactToolCard, making them look identical to normal tool calls.
 * 
 * Phase 5: Enhanced with motion animations for smooth transitions
 * - Loading state with animated indicator
 * - Staggered animation for tool cards appearing
 * - Smooth transitions between states
 */

import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CompactToolCard } from '@/components/ui/tools/cards';
import { LoadingCheckIcon, type LoadingCheckIconHandle } from '@assets/icons/chat/loading-check';
import type { ToolUIState } from '@/ai/tools/components';
import type { TrackedToolCall } from '@/ai/tools/meta/types';
import { useExecuteToolsLiveStore } from '@/ai/tools/meta/executeToolsLiveStore';
import { approveSandboxToolCall, denySandboxToolCall } from '@/ai/tools/meta/executeToolsApproval';
import { TOOLS_REQUIRING_APPROVAL } from '@/ai/setup/remoteMode';
import { useApprovalStore } from '@/stores/approval';
import { extractDomainFromInput, supportsWebsiteApproval } from '@/ai/tools/approvalConfig';
import {
    getMcpApprovalOptions,
    getMcpApprovalReason,
    getMcpServerId,
    getWebmcpApprovalOptions,
    getWebmcpApprovalReason,
    getWebmcpDomain,
    isMcpAutoApproved,
    isMcpTool,
    isWebmcpAutoApproved,
    isWebmcpTool,
} from '@/ai/tools/mcpApprovalConfig';
import type { ApprovalOption } from '@/components/ui/tools/cards/ApprovalDropdown';

interface ExecuteToolsRendererProps {
    state: ToolUIState;
}

// Animation variants for the container
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.08, // Stagger each tool card by 80ms
            delayChildren: 0.1,
        },
    },
};

// Animation variants for individual tool cards
const cardVariants = {
    hidden: {
        opacity: 0,
        y: -8,
        scale: 0.95,
    },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            duration: 0.25,
            ease: [0.25, 0.46, 0.45, 0.94] as const, // Custom easing for smooth feel
        },
    },
};

// Animation variants for loading state
const loadingVariants = {
    initial: { opacity: 0, y: -4 },
    animate: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.2, ease: 'easeOut' as const },
    },
    exit: {
        opacity: 0,
        y: -4,
        transition: { duration: 0.15, ease: 'easeIn' as const },
    },
};

function ExecuteToolsToolCallCard({ call }: { call: TrackedToolCall }) {
    const { toolName, callId, input, output, errorText, state } = call;

    // Approval store integration (for built-in tools)
    const initializeApprovalStore = useApprovalStore((s) => s.initialize);
    const isBuiltinAutoApproved = useApprovalStore((s) => s.isAutoApproved);
    const getBuiltinApprovalReason = useApprovalStore((s) => s.getApprovalReason);
    const addSessionApproval = useApprovalStore((s) => s.addSessionApproval);
    const addWebsiteApproval = useApprovalStore((s) => s.addWebsiteApproval);
    const addAlwaysApproval = useApprovalStore((s) => s.addAlwaysApproval);

    // Initialize approval store on mount
    useEffect(() => {
        initializeApprovalStore();
    }, [initializeApprovalStore]);

    // Tool type detection
    const isMcp = isMcpTool(toolName);
    const isWebmcp = isWebmcpTool(toolName);
    const isBuiltinApproval = TOOLS_REQUIRING_APPROVAL.includes(toolName);
    const requiresApproval = isMcp || isWebmcp || isBuiltinApproval;

    // Domain/Server extraction (built-in tools may need current tab URL)
    const [currentTabUrl, setCurrentTabUrl] = useState<string | null>(null);

    useEffect(() => {
        const fetchCurrentTabUrl = async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab?.url) {
                    setCurrentTabUrl(tab.url);
                }
            } catch {
                // ignore
            }
        };

        if (requiresApproval && state === 'pending-approval' && isBuiltinApproval) {
            fetchCurrentTabUrl();
        }
    }, [requiresApproval, state, isBuiltinApproval]);

    const mcpServerId = isMcp ? getMcpServerId(toolName) : null;
    const webmcpDomain = isWebmcp ? getWebmcpDomain(toolName) : null;
    const builtinDomain = isBuiltinApproval
        ? extractDomainFromInput(toolName, input, currentTabUrl ?? undefined)
        : null;
    const showWebsiteOption = isBuiltinApproval && supportsWebsiteApproval(toolName) && !!builtinDomain;

    // Auto-approval check (mirrors CompactToolRenderer)
    const hasAutoExecutedRef = useRef(false);
    const [autoApprovalReason, setAutoApprovalReason] = useState<string | null>(null);

    useEffect(() => {
        if (!requiresApproval || state !== 'pending-approval' || hasAutoExecutedRef.current) {
            return;
        }

        let isApproved = false;
        let reason: string | null = null;

        if (isMcp && mcpServerId) {
            isApproved = isMcpAutoApproved(toolName);
            reason = getMcpApprovalReason(toolName);
        } else if (isWebmcp && webmcpDomain) {
            isApproved = isWebmcpAutoApproved(toolName);
            reason = getWebmcpApprovalReason(toolName);
        } else if (isBuiltinApproval) {
            isApproved = isBuiltinAutoApproved(toolName, builtinDomain ?? undefined);
            reason = getBuiltinApprovalReason(toolName, builtinDomain ?? undefined);
        }

        if (isApproved) {
            if (reason) setAutoApprovalReason(reason);
            hasAutoExecutedRef.current = true;
            approveSandboxToolCall(callId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        requiresApproval,
        state,
        toolName,
        isMcp,
        isWebmcp,
        isBuiltinApproval,
        mcpServerId,
        webmcpDomain,
        builtinDomain,
    ]);

    const onApprove = state === 'pending-approval' ? () => approveSandboxToolCall(callId) : undefined;
    const onDeny = state === 'pending-approval' ? () => denySandboxToolCall(callId) : undefined;

    // Built-in tool dropdown options
    const onApproveSession =
        state === 'pending-approval' && isBuiltinApproval
            ? () => {
                  addSessionApproval(toolName);
                  approveSandboxToolCall(callId);
              }
            : undefined;

    const onApproveWebsite =
        state === 'pending-approval' && isBuiltinApproval && showWebsiteOption
            ? () => {
                  if (!builtinDomain) return;
                  addWebsiteApproval(toolName, builtinDomain);
                  approveSandboxToolCall(callId);
              }
            : undefined;

    const onApproveAlways =
        state === 'pending-approval' && isBuiltinApproval
            ? () => {
                  addAlwaysApproval(toolName);
                  approveSandboxToolCall(callId);
              }
            : undefined;

    // MCP/WebMCP dropdown options
    let approvalOptions: ApprovalOption[] = [];
    if (state === 'pending-approval') {
        if (isMcp && mcpServerId) {
            approvalOptions = getMcpApprovalOptions(toolName, mcpServerId, () => approveSandboxToolCall(callId));
        } else if (isWebmcp && webmcpDomain) {
            approvalOptions = getWebmcpApprovalOptions(toolName, webmcpDomain, () => approveSandboxToolCall(callId));
        }
    }

    const isMcpOrWebmcp = isMcp || isWebmcp;

    return (
        <CompactToolCard
            toolName={toolName}
            state={state}
            input={input}
            output={output}
            errorText={errorText}
            // Approval handlers
            onApprove={onApprove}
            onDeny={onDeny}
            // Built-in tool auto-approve handlers (not used for MCP/WebMCP)
            onApproveSession={!isMcpOrWebmcp ? onApproveSession : undefined}
            onApproveWebsite={!isMcpOrWebmcp ? onApproveWebsite : undefined}
            onApproveAlways={!isMcpOrWebmcp ? onApproveAlways : undefined}
            showWebsiteOption={!isMcpOrWebmcp && showWebsiteOption}
            websiteLabel={builtinDomain ?? undefined}
            // MCP/WebMCP approval options
            approvalOptions={isMcpOrWebmcp ? approvalOptions : undefined}
            // Auto-approval indicator
            autoApprovalReason={autoApprovalReason ?? undefined}
        />
    );
}

export function ExecuteToolsRenderer({ state }: ExecuteToolsRendererProps) {
    const { state: toolState, output, input } = state;
    const loadingIconRef = useRef<LoadingCheckIconHandle>(null);
    const liveToolCalls = useExecuteToolsLiveStore((s) => s.toolCalls);
    const isWaitingForApproval = liveToolCalls.some((call) => call.state === 'pending-approval');

    // Start loading animation when in loading state
    useEffect(() => {
        if (isWaitingForApproval) {
            // Paused on HITL approval, so don't animate "executing"
            loadingIconRef.current?.stopAnimation();
            return;
        }

        if (toolState === 'input-available' || toolState === 'input-streaming') {
            loadingIconRef.current?.startAnimation();
        } else {
            loadingIconRef.current?.stopAnimation();
        }
    }, [toolState, isWaitingForApproval]);

    // Extract tool calls from completed output
    const toolCalls: TrackedToolCall[] = output?.toolCalls || [];
    const isLoading = toolState === 'input-available' || toolState === 'input-streaming';
    const isComplete = toolState === 'output-available' || toolState === 'output-error';

    return (
        <AnimatePresence mode="wait">
            {/* Loading state */}
            {isLoading && (
                <motion.div
                    key="loading"
                    variants={loadingVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex flex-col gap-2 py-[6px]"
                >
                    <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                        {isWaitingForApproval ? (
                            <div className="w-4 h-4 rounded-full flex items-center justify-center text-amber-500 shrink-0">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 6v6l4 2" />
                                </svg>
                            </div>
                        ) : (
                            <LoadingCheckIcon ref={loadingIconRef} size={16} />
                        )}
                        <span>{isWaitingForApproval ? 'Waiting for approval...' : 'Executing code...'}</span>
                    </div>

                    {/* Live tool calls while sandbox is running (includes HITL approval) */}
                    {liveToolCalls.length > 0 && (
                        <motion.div
                            className="flex flex-col gap-1"
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                        >
                            {liveToolCalls.map((call) => (
                                <motion.div key={call.callId} variants={cardVariants}>
                                    <ExecuteToolsToolCallCard call={call} />
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </motion.div>
            )}

            {/* Completed state - no tool calls */}
            {isComplete && toolCalls.length === 0 && (
                <motion.div
                    key="no-tools"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                    <CompactToolCard
                        toolName="executeTools"
                        state={toolState === 'output-available' ? 'success' : 'error'}
                        input={input}
                        output={output}
                        errorText={toolState === 'output-error' ? output?.error : undefined}
                    />
                </motion.div>
            )}

            {/* Completed state - with tool calls (staggered animation) */}
            {isComplete && toolCalls.length > 0 && (
                <motion.div
                    key="tool-cards"
                    className="flex flex-col gap-1"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    {toolCalls.map((call) => (
                        <motion.div key={call.callId} variants={cardVariants}>
                            <ExecuteToolsToolCallCard call={call} />
                        </motion.div>
                    ))}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
