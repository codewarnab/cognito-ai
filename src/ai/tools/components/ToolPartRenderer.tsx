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

import React, { useMemo } from 'react';
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
  return <CompactToolRenderer state={toolState} />;
}

/**
 * Default tool renderer for tools without custom UI
 */
function DefaultToolRenderer({ state }: { state: ToolUIState }) {
  const { toolName, state: toolState, input, output, errorText } = state;

  // Format arguments for display
  const formatArgs = (args: any): string => {
    if (!args) return '';
    if (typeof args === 'string') return args;
    if (typeof args === 'object') {
      // Try to extract meaningful info
      if (args.query) return args.query;
      if (args.prompt) return args.prompt;
      if (args.url) return args.url;
      if (args.urls && Array.isArray(args.urls)) return args.urls.join(', ');
    }
    return JSON.stringify(args, null, 2);
  };

  // Get icon for tool
  const getToolIcon = (name: string): string => {
    const icons: Record<string, string> = {
      search: '🔍',
      navigate: '🌐',
      browser: '🌐',
      fetch: '📥',
      api: '🔗',
      execute: '⚡',
      compute: '💻',
      analyze: '📊',
      generate: '✨',
      create: '🆕',
      delete: '🗑️',
      update: '✏️',
    };

    for (const [key, icon] of Object.entries(icons)) {
      if (name.toLowerCase().includes(key)) return icon;
    }
    return '🔧';
  };

  return (
    <div className="tool-call-default">
      <div className="tool-call-header">
        <span className="tool-call-icon">{getToolIcon(toolName)}</span>
        <div className="tool-call-info">
          <span className="tool-call-name">{toolName}</span>
          {input && (
            <span className="tool-call-summary">{formatArgs(input)}</span>
          )}
        </div>
        <span className={`tool-call-status tool-call-status-${toolState}`}>
          {toolState === 'input-streaming' && '⏳ Streaming...'}
          {toolState === 'input-available' && '⚙️ Executing...'}
          {toolState === 'output-available' && '✅ Complete'}
          {toolState === 'output-error' && '❌ Error'}
        </span>
      </div>

      {(toolState === 'input-streaming' || toolState === 'input-available') && input && (
        <div className="tool-call-input">
          <div className="tool-call-label">📥 Input:</div>
          <pre className="tool-call-code">{formatArgs(input)}</pre>
        </div>
      )}

      {toolState === 'output-available' && output && (
        <div className="tool-call-output">
          <div className="tool-call-label">📤 Output:</div>
          <pre className="tool-call-code">
            {typeof output === 'string' ? output : JSON.stringify(output, null, 2)}
          </pre>
        </div>
      )}

      {toolState === 'output-error' && errorText && (
        <div className="tool-call-error">
          <div className="tool-call-label">⚠️ Error:</div>
          <div className="tool-call-error-text">{errorText}</div>
        </div>
      )}
    </div>
  );
}

/**
 * Add styles for default tool renderer
 */
const styles = `
.tool-call-default {
  margin: 8px 0;
  padding: 12px;
  border-radius: 8px;
  border-left: 3px solid #666;
}

.tool-call-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-weight: 500;
}

.tool-call-icon {
  font-size: 16px;
}

.tool-call-name {
  font-family: monospace;
  color: #333;
}

.tool-call-status {
  margin-left: auto;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 12px;
  background: #e0e0e0;
}

.tool-call-status-input-streaming,
.tool-call-status-input-available {
  background: #fff3cd;
  color: #856404;
}

.tool-call-status-output-available {
  background: #d4edda;
  color: #155724;
}

.tool-call-status-output-error {
  background: #f8d7da;
  color: #721c24;
}

.tool-call-input,
.tool-call-output,
.tool-call-error {
  margin-top: 8px;
}

.tool-call-label {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  margin-bottom: 4px;
}

.tool-call-code {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px;
  font-size: 12px;
  overflow-x: auto;
  max-height: 200px;
  overflow-y: auto;
}

.tool-call-error-text {
  color: #721c24;
  background: #fff;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  padding: 8px;
  font-size: 13px;
}
`;

// Inject styles into document
if (typeof document !== 'undefined') {
  const styleId = 'tool-renderer-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }
}
