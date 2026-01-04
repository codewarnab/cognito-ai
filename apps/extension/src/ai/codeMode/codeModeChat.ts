/**
 * Code Mode Chat - Streams AI responses from the local code bridge
 */

import { createUIMessageStream, generateId } from 'ai';
import { createLogger } from '~logger';
import { useCodeModeStore } from '@/stores/codeMode/codeModeStore';
import { streamCodeBridgeChat, type BridgeEvent } from '@/services/codeBridge';
import type { UIMessage } from 'ai';

const log = createLogger('codeModeChat', 'CODE_MODE_CHAT');

export interface CodeModeChatParams {
  messages: UIMessage[];
  abortSignal?: AbortSignal;
  onError?: (error: Error) => void;
}

/**
 * Convert UI messages to the format expected by the bridge
 */
function convertMessages(messages: UIMessage[]): Array<{
  role: 'user' | 'assistant';
  content: Array<{ type: 'text'; text: string }>;
}> {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.parts
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => ({ type: 'text' as const, text: p.text })),
    }));
}

/**
 * Stream AI response from the code bridge
 * Returns a UIMessageStream compatible with useChat
 */
export async function streamCodeModeChat(params: CodeModeChatParams) {
  const { messages, abortSignal, onError } = params;

  log.info('Starting code mode chat', { messageCount: messages.length });

  // Get bridge state
  const state = useCodeModeStore.getState();
  const { bridgeBaseUrl, bridgeToken, bridgeStatus, selectedAgentName, availableAgents, elementContext } = state;

  // Validate bridge connection
  if (bridgeStatus !== 'connected' || !bridgeToken) {
    const error = new Error('Bridge not connected. Please pair with the bridge first.');
    onError?.(error);
    throw error;
  }

  // Find selected agent
  const agent = availableAgents.find((a) => a.name === selectedAgentName);
  if (!agent) {
    const error = new Error(`Agent "${selectedAgentName}" not found`);
    onError?.(error);
    throw error;
  }

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      try {
        // Send initial status
        writer.write({
          type: 'data-status',
          id: 'status-' + generateId(),
          data: { status: 'processing', timestamp: Date.now() },
          transient: true,
        });

        // Convert messages
        const bridgeMessages = convertMessages(messages);

        // Stream from bridge
        const eventStream = streamCodeBridgeChat(
          bridgeBaseUrl,
          bridgeToken,
          {
            messages: bridgeMessages,
            elementContext: elementContext || undefined,
            agent: {
              name: agent.name,
              command: agent.command,
              args: agent.args,
            },
          },
          abortSignal
        );

        let textBuffer = '';
        const messageId = 'msg-' + generateId();
        let hasStartedText = false;

        for await (const event of eventStream) {
          // Handle status events - update store for LoadingIndicator
          if (event.type === 'status') {
            log.debug('Status update', { message: event.message });
            useCodeModeStore.getState().setAgentStatus(event.message);
            continue;
          }

          // Handle text events with proper start/delta/end pattern
          if (event.type === 'text' && event.content) {
            if (!hasStartedText) {
              log.info('Starting text stream', { messageId });
              // Clear status when text starts
              useCodeModeStore.getState().setAgentStatus(null);
              writer.write({
                type: 'text-start',
                id: messageId,
              });
              hasStartedText = true;
            }

            textBuffer += event.content;
            writer.write({
              type: 'text-delta',
              id: messageId,
              delta: event.content,
            });
          } else {
            // Handle non-text events (errors, tool calls, etc.)
            handleBridgeEvent(event, writer);
          }
        }

        // Send text-end if we sent any text
        if (hasStartedText) {
          log.info('Ending text stream', { messageId, textLength: textBuffer.length });
          writer.write({
            type: 'text-end',
            id: messageId,
          });
        }

        // Send completion status
        writer.write({
          type: 'data-status',
          id: 'status-' + generateId(),
          data: { status: 'complete', timestamp: Date.now() },
          transient: false,
        });
      } catch (error) {
        log.error('Code mode chat error', error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isAgentStartError = errorMessage.includes('Agent not started') ||
          errorMessage.includes('Failed to start agent') ||
          errorMessage.includes('AGENT_START_FAILED');

        writer.write({
          type: 'data-status',
          id: 'status-' + generateId(),
          data: {
            status: 'error',
            errorCode: isAgentStartError ? 'AGENT_START_FAILED' : 'BRIDGE_ERROR',
            timestamp: Date.now(),
          },
          transient: false,
        });

        // Build helpful error message
        let displayMessage = `\n\n❌ **Error:** ${errorMessage}\n\n`;

        if (isAgentStartError) {
          displayMessage += `### Troubleshooting\n\n`;
          displayMessage += `1. **Check if the agent CLI is installed** - Run the command in your terminal to verify\n`;
          displayMessage += `2. **Verify the agent supports ACP mode** - Not all CLI agents support the Agent Communication Protocol yet\n`;
          displayMessage += `3. **Check your API key** - Make sure the required environment variable is set\n`;
          displayMessage += `4. **Try a different agent** - Select another agent from the dropdown\n`;
        } else {
          displayMessage += `Make sure the code bridge is running and you're paired.\n`;
        }

        // Write error as text with proper start/delta/end pattern
        const errorId = 'error-' + generateId();
        writer.write({ type: 'text-start', id: errorId });
        writer.write({ type: 'text-delta', id: errorId, delta: displayMessage });
        writer.write({ type: 'text-end', id: errorId });

        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    },
  });

  return stream;
}

/**
 * Handle individual bridge events (non-text events only)
 * Text events are handled inline with text-start/text-delta/text-end pattern
 */
function handleBridgeEvent(
  event: BridgeEvent,
  writer: any
): void {
  switch (event.type) {
    case 'text':
      // Text events are handled inline with proper text-start/text-delta/text-end
      // This case should not be reached, but kept for safety
      break;

    case 'patch_proposal':
      // Write patch proposal as a special tool call
      writer.write({
        type: 'tool-input-available',
        toolCallId: event.patchId,
        toolName: 'propose_patch',
        input: {
          patchId: event.patchId,
          unifiedDiff: event.unifiedDiff,
          summary: event.summary,
        },
      });
      break;

    case 'tool_call':
      writer.write({
        type: 'tool-input-available',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        input: event.args,
      });
      break;

    case 'tool_result':
      writer.write({
        type: 'tool-output-available',
        toolCallId: event.toolCallId,
        output: event.result,
      });
      break;

    case 'error': {
      const errorMessage = event.error;
      const isAgentStartError = errorMessage.includes('Agent not started') ||
        errorMessage.includes('Failed to start agent') ||
        errorMessage.includes('AGENT_START_FAILED');

      let displayMessage = `\n\n❌ **Error:** ${errorMessage}\n\n`;

      if (isAgentStartError) {
        displayMessage += `### Troubleshooting\n\n`;
        displayMessage += `1. **Check if the agent CLI is installed** - Run the command in your terminal to verify\n`;
        displayMessage += `2. **Verify the agent supports ACP mode** - Not all CLI agents support the Agent Communication Protocol yet\n`;
        displayMessage += `3. **Check your API key** - Make sure the required environment variable is set\n`;
        displayMessage += `4. **Try a different agent** - Select another agent from the dropdown\n`;
      }

      // Write error as text (need text-start/delta/end)
      const errorId = 'error-' + generateId();
      writer.write({ type: 'text-start', id: errorId });
      writer.write({ type: 'text-delta', id: errorId, delta: displayMessage });
      writer.write({ type: 'text-end', id: errorId });
      break;
    }

    case 'done':
      // Stream complete - nothing to do, completion is handled in the main loop
      break;
  }
}
