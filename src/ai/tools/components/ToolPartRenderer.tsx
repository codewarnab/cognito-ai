/**
 * Tool Call Renderer for AI SDK v5
 * Renders tool calls from AI messages using registered tool UI renderers
 * 
 * IMPORTANT: This component handles the AI SDK v5 tool execution flow:
 * - tool-call part: Tool invocation (input available, waiting for result)
 * - tool-result part: Tool completion (output available)
 * 
 * For MCP tools with longer wait times, we need to properly handle the loading state
 * and avoid showing both loading and success icons simultaneously.
 */

import { useMemo } from 'react';
import { useToolUI } from './ToolUIContext';
import type { ToolUIState } from './ToolUIContext';
import { createLogger } from '../../../logger';
import { CompactToolRenderer } from './CompactToolRenderer';

const log = createLogger('ToolPartRenderer');

interface ToolPartRendererProps {
  part: any; // Tool part from AI SDK v5 message
  messageId: string;
}

/**
 * Renders a single tool part
 * Handles AI SDK v5 tool call formats
 */
export function ToolPartRenderer({ part, messageId }: ToolPartRendererProps) {
  const { renderTool, hasRenderer } = useToolUI();

  const toolState = useMemo(() => {
    try {
      // Extract tool name and ID from the part
      let toolName: string | undefined;
      let toolCallId: string | undefined;
      let input: any;
      let output: any;
      let state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error' = 'input-available';

      // Handle AI SDK v5 tool-call parts (tool is executing, no result yet)
      if (part.type === 'tool-call') {
        toolName = part.toolName;
        toolCallId = part.toolCallId;
        input = part.args || part.input;
        // Check if this is still executing (no result) or completed
        // If there's no result, it's still loading
        state = 'input-available'; // This means "executing/loading"
      }
      // Handle tool-result parts (tool execution completed)
      else if (part.type === 'tool-result') {
        toolName = part.toolName;
        toolCallId = part.toolCallId;
        output = part.result || part.output;

        // Check if this is an error result
        if (part.isError || (output && typeof output === 'object' && output.error)) {
          state = 'output-error';
        } else {
          state = 'output-available'; // Success
        }

        // For tool-result, we also want to show the input if available
        // This is important because tool-result parts may not include input
        input = part.args || part.input;
      }
      // Handle generic tool parts with type prefix
      else if (part.type?.startsWith('tool-')) {
        toolName = part.type.substring(5); // Remove 'tool-' prefix
        toolCallId = part.toolCallId;
        input = part.input;
        output = part.output;
        state = part.state || 'input-available';
      }
      // Handle dynamic tools
      else if (part.type === 'dynamic-tool') {
        toolName = part.toolName;
        toolCallId = part.toolCallId;
        input = part.input;
        output = part.output;
        state = part.state || 'input-available';
      }

      if (!toolName) {
        log.warn('Could not extract tool name from part:', part);
        return null;
      }

      return {
        toolCallId: toolCallId || `${messageId}-${toolName}`,
        toolName,
        state,
        input,
        output,
        errorText: part.errorText || (part.isError ? String(output) : undefined),
      } as ToolUIState;
    } catch (error) {
      log.error('Error processing tool part:', error, part);
      return null;
    }
  }, [part, messageId]);

  if (!toolState) {
    return null;
  }

  // Check if we have a custom renderer
  if (hasRenderer(toolState.toolName)) {
    return <>{renderTool(toolState)}</>;
  }

  // Default fallback renderer for tools without custom UI
  return <CompactToolRenderer state={toolState} messageId={messageId} />;
}
