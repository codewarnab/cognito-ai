/**
 * CompactToolRenderer - Default renderer for tool calls using CompactToolCard
 * Provides consistent, space-efficient UI for all tool executions
 */

import { CompactToolCard } from '../components/ui/CompactToolCard';
import type { ToolUIState } from './ToolUIContext';

export function CompactToolRenderer({ state }: { state: ToolUIState }) {
    const { toolName, state: toolState, input, output, errorText } = state;

    // Map tool state to UI state
    const uiState =
        toolState === 'input-streaming' || toolState === 'input-available'
            ? 'loading'
            : toolState === 'output-available'
                ? 'success'
                : 'error';

    return (
        <CompactToolCard
            toolName={toolName}
            state={uiState}
            input={input}
            output={output}
            errorText={errorText}
        />
    );
}
