/**
 * Tool Call Renderer for AI SDK v5
 * Renders tool calls from AI messages using registered tool UI renderers
 */

import React from 'react';
import { useToolUI } from '../ai/ToolUIContext';
import type { ToolUIState } from '../ai/ToolUIContext';

interface ToolPartRendererProps {
  part: any; // Tool part from AI SDK v5 message
  messageId: string;
}

/**
 * Renders a single tool part
 */
export function ToolPartRenderer({ part, messageId }: ToolPartRendererProps) {
  const { renderTool, hasRenderer } = useToolUI();

  // Extract tool name from part type
  // For static tools: 'tool-openTab' -> 'openTab'
  // For dynamic tools: use toolName directly
  let toolName: string;
  
  if (part.type === 'dynamic-tool') {
    toolName = part.toolName;
  } else if (part.type?.startsWith('tool-')) {
    toolName = part.type.substring(5); // Remove 'tool-' prefix
  } else {
    return null;
  }

  // Build tool UI state
  const toolState: ToolUIState = {
    toolCallId: part.toolCallId || `${messageId}-${toolName}`,
    toolName,
    state: part.state || 'input-available',
    input: part.input,
    output: part.output,
    errorText: part.errorText,
  };

  // Check if we have a custom renderer
  if (hasRenderer(toolName)) {
    return <>{renderTool(toolState)}</>;
  }

  // Default fallback renderer for tools without custom UI
  return <DefaultToolRenderer state={toolState} />;
}

/**
 * Default tool renderer for tools without custom UI
 */
function DefaultToolRenderer({ state }: { state: ToolUIState }) {
  const { toolName, state: toolState, input, output, errorText } = state;

  return (
    <div className="tool-call-default">
      <div className="tool-call-header">
        <span className="tool-call-icon">🔧</span>
        <span className="tool-call-name">{toolName}</span>
        <span className={`tool-call-status tool-call-status-${toolState}`}>
          {toolState === 'input-streaming' && '⏳ Streaming...'}
          {toolState === 'input-available' && '⚙️ Executing...'}
          {toolState === 'output-available' && '✅ Complete'}
          {toolState === 'output-error' && '❌ Error'}
        </span>
      </div>
      
      {(toolState === 'input-streaming' || toolState === 'input-available') && input && (
        <div className="tool-call-input">
          <div className="tool-call-label">Input:</div>
          <pre className="tool-call-code">{JSON.stringify(input, null, 2)}</pre>
        </div>
      )}
      
      {toolState === 'output-available' && output && (
        <div className="tool-call-output">
          <div className="tool-call-label">Output:</div>
          <pre className="tool-call-code">{JSON.stringify(output, null, 2)}</pre>
        </div>
      )}
      
      {toolState === 'output-error' && errorText && (
        <div className="tool-call-error">
          <div className="tool-call-label">Error:</div>
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
  background: #f5f5f5;
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
