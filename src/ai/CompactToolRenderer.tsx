/**
 * CompactToolRenderer - Default renderer for tool calls using CompactToolCard
 * Provides consistent, space-efficient UI for all tool executions
 */

import { CompactToolCard } from '../components/ui/CompactToolCard';
import type { ToolUIState } from './ToolUIContext';
import { useToolUI } from './ToolUIContext';

export function CompactToolRenderer({ state }: { state: ToolUIState }) {
    const { toolName, state: toolState, input, output, errorText } = state;
    const { getCustomRenderers } = useToolUI();

    // Map tool state to UI state
    // Special handling: if output exists but has success:false or error:true, treat as error
    const hasError = output && (output.success === false || output.error === true || output.error);
    const uiState =
        toolState === 'input-streaming' || toolState === 'input-available'
            ? 'loading'
            : toolState === 'output-available'
                ? hasError ? 'error' : 'success'
                : 'error';

    // Use output.error as errorText if there's an error in the output
    const displayErrorText = hasError
        ? (typeof output.error === 'string' ? output.error : output.answer || errorText)
        : errorText;

    // Get custom renderers for this tool (if any)
    const customRenderers = getCustomRenderers(toolName);

    return (
        <CompactToolCard
            toolName={toolName}
            state={uiState}
            input={input}
            output={output}
            errorText={displayErrorText}
            customRenderers={customRenderers}
        />
    );
}
