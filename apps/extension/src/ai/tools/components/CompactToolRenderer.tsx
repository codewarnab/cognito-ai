/**
 * CompactToolRenderer - Default renderer for tool calls using CompactToolCard
 * Provides consistent, space-efficient UI for all tool executions
 * 
 * Includes human-in-the-loop approval for sensitive tools
 */

import { useState } from 'react';
import { CompactToolCard } from '@/components/ui/tools/cards';
import type { ToolUIState } from './ToolUIContext';
import { useToolUI } from './ToolUIContext';
import { TOOLS_REQUIRING_APPROVAL } from '../../setup/remoteMode';
import { getTool } from '../registryUtils';
import { createLogger } from '~logger';

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

    // Check if this tool requires approval and is waiting for result
    const requiresApproval = TOOLS_REQUIRING_APPROVAL.includes(toolName);
    const isWaitingForResult = toolState === 'input-available' && !output;
    const isPendingApproval = requiresApproval && isWaitingForResult && approvalState === 'pending';

    const handleApprove = async () => {
        if (!toolCallId) {
            log.error('🛡️ Cannot approve - no toolCallId');
            return;
        }

        log.info('🛡️ User approved tool execution:', { toolName, toolCallId, input });
        setApprovalState('executing');

        try {
            const tool = getTool(toolName);
            if (!tool) {
                throw new Error(`Tool "${toolName}" not found in registry`);
            }

            const result = await tool.execute(input);
            setExecutionResult(result);
            setApprovalState('approved');
            log.info('🛡️ Tool execution completed:', { toolName, result });

            // Send result to AI to continue conversation
            log.info('🛡️ Calling addToolOutput:', {
                hasAddToolOutput: !!addToolOutput,
                tool: toolName,
                toolCallId,
                output: result
            });
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

        // Send denial to AI
        addToolOutput?.({
            tool: toolName,
            toolCallId,
            output: { denied: true, message: 'User denied this action.' },
        });
    };

    // Map tool state to UI state
    // Special handling for approval flow and output errors
    const hasError = output && (output.success === false || output.error === true || output.error);

    let uiState: 'loading' | 'success' | 'error' | 'pending-approval';
    if (isPendingApproval) {
        uiState = 'pending-approval';
    } else if (approvalState === 'executing') {
        uiState = 'loading';
    } else if (approvalState === 'denied') {
        uiState = 'error';
    } else if (approvalState === 'approved') {
        // After approval, show success/error based on execution result
        uiState = executionError ? 'error' : 'success';
    } else if (toolState === 'input-streaming' || toolState === 'input-available') {
        uiState = 'loading';
    } else if (toolState === 'output-available') {
        uiState = hasError ? 'error' : 'success';
    } else {
        uiState = 'error';
    }

    // Use output.error as errorText if there's an error in the output
    let displayErrorText = errorText;
    if (approvalState === 'denied') {
        displayErrorText = 'Action denied by user';
    } else if (executionError) {
        displayErrorText = executionError;
    } else if (hasError) {
        displayErrorText = typeof output.error === 'string' ? output.error : output.answer || errorText;
    }

    // Use execution result if we ran execution locally
    const displayOutput = approvalState === 'approved' ? executionResult : output;

    // Get custom renderers for this tool (if any)
    const customRenderers = getCustomRenderers(toolName);

    return (
        <CompactToolCard
            toolName={toolName}
            state={uiState}
            input={input}
            output={displayOutput}
            errorText={displayErrorText}
            customRenderers={customRenderers}
            messageId={messageId}
            onApprove={isPendingApproval ? handleApprove : undefined}
            onDeny={isPendingApproval ? handleDeny : undefined}
        />
    );
}
