/**
 * Tool Call Renderer for AI SDK v6
 * Renders tool calls from AI messages using registered tool UI renderers
 * 
 * IMPORTANT: This component handles the AI SDK v6 tool execution flow:
 * - tool-call part: Tool invocation (input available, waiting for result)
 * - tool-result part: Tool completion (output available)
 * 
 * For MCP tools with longer wait times, we need to properly handle the loading state
 * and avoid showing both loading and success icons simultaneously.
 */

import { useMemo } from 'react';
import { useToolUI } from './ToolUIContext';
import type { ToolUIState } from './ToolUIContext';
import { createLogger } from '~logger';
import { CompactToolRenderer } from './CompactToolRenderer';

const log = createLogger('ToolPartRenderer', 'UI_CHAT_COMPONENTS');

interface ToolPartRendererProps {
  part: any; // Tool part from AI SDK v6 message
  messageId: string;
  addToolOutput?: (params: { tool: string; toolCallId: string; output: any }) => void;
}

/**
 * Renders a single tool part
 * Handles AI SDK v6 tool call formats
 */
export function ToolPartRenderer({ part, messageId, addToolOutput }: ToolPartRendererProps) {
  const { renderTool, hasRenderer } = useToolUI();

  const toolState = useMemo(() => {
    try {
      // Extract tool name and ID from the part
      let toolName: string | undefined;
      let toolCallId: string | undefined;
      let input: any;
      let output: any;
      let state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error' = 'input-available';

      // Handle AI SDK v6 tool-call parts (tool is executing, no result yet)
      // Supports both 'tool-call' (legacy) and 'tool-input-available' (AI SDK v6)
      if (part.type === 'tool-call' || part.type === 'tool-input-available') {
        toolName = part.toolName;
        toolCallId = part.toolCallId;
        input = part.args || part.input;
        // Check if this is still executing (no result) or completed
        // If there's no result, it's still loading
        state = 'input-available'; // This means "executing/loading"
      }
      // Handle tool-result parts (tool execution completed)
      // Supports both 'tool-result' (legacy) and 'tool-output-available' (AI SDK v6)
      else if (part.type === 'tool-result' || part.type === 'tool-output-available') {
        toolName = part.toolName;
        toolCallId = part.toolCallId;
        output = part.result || part.output;

        const isDenied =
          !!output &&
          typeof output === 'object' &&
          'denied' in output &&
          (output as any).denied === true;

        // Check if this is an error result
        if (isDenied || part.isError || (output && typeof output === 'object' && (output as any).error)) {
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
        errorText:
          part.errorText ||
          ((output && typeof output === 'object' && (output as any).denied === true)
            ? ((output as any).message as string | undefined) || 'Action denied by user'
            : part.isError
              ? String(output)
              : undefined),
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
    return <>{renderTool(toolState, { addToolOutput })}</>;
  }

  // Default fallback renderer for tools without custom UI
  return <CompactToolRenderer state={toolState} messageId={messageId} addToolOutput={addToolOutput} />;
}

