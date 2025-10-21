/**
 * CompactToolRenderer - Default renderer for tool calls using CompactToolCard
 * Provides consistent, space-efficient UI for all tool executions
 */

import { CompactToolCard } from '../components/ui/CompactToolCard';
import type { ToolUIState } from './ToolUIContext';

export function CompactToolRenderer({ state }: { state: ToolUIState }) {
    const { toolName, state: toolState, input, output, errorText } = state;

    // Map tool state to UI state
    // Special handling: if output exists but has success:false, treat as error
    const uiState =
        toolState === 'input-streaming' || toolState === 'input-available'
            ? 'loading'
            : toolState === 'output-available'
                ? (output && output.success === false) ? 'error' : 'success'
                : 'error';

    // Use output.error as errorText if output.success is false
    const displayErrorText = (output && output.success === false && output.error)
        ? output.error
        : errorText;

    return (
        <CompactToolCard
            toolName={toolName}
            state={uiState}
            input={input}
            output={output}
            errorText={displayErrorText}
        />
    );
}
