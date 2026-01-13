/**
 * Code Mode Chat - Streams AI responses from the local code bridge
 */

import { createUIMessageStream, generateId } from 'ai';
import { createLogger } from '~logger';
import { useCliModeStore } from '@/stores/cliMode/cliModeStore';
import { useToolsStore } from '@/stores';
import { streamCodeBridgeChat, type BridgeEvent, type CliBridgeToolsMode } from '@/services/codeBridge';
import type { UIMessage } from 'ai';

const log = createLogger('cliModeChat', 'CLI_MODE_CHAT');

export interface CliModeChatParams {
  messages: UIMessage[];
  abortSignal?: AbortSignal;
  onError?: (error: Error) => void;
  /** Initial page context captured at thread start */
  initialPageContext?: string;
}

/**
 * Convert UI messages to the format expected by the bridge
 */
function convertMessages(messages: UIMessage[]): Array<{
  role: 'user' | 'assistant';
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; data: string; mimeType: string }
    | { type: 'audio'; data: string; mimeType: string }
    | { type: 'resource'; data: string; mimeType: string; name: string }
  >;
}> {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.parts
        .map((p) => {
          if (p.type === 'text') {
            return { type: 'text' as const, text: p.text };
          }

          if (p.type === 'file') {
            // Handle file attachments (images, audio, PDF, etc.)
            // url is typically a data URL like "data:image/png;base64,..."
            const dataUrl = (p as any).url || '';
            const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

            if (matches) {
              const mimeType = matches[1];
              const data = matches[2]; // Raw base64

              if (mimeType.startsWith('image/')) {
                return { type: 'image' as const, data, mimeType };
              }

              if (mimeType.startsWith('audio/')) {
                return { type: 'audio' as const, data, mimeType };
              }

              // Fallback for PDFs and other documents
              return {
                type: 'resource' as const,
                data,
                mimeType,
                name: (p as any).name || 'attachment'
              };
            }
          }

          return null;
        })
        .filter((p): p is NonNullable<typeof p> => p !== null),
    }));
}

/**
 * Stream AI response from the code bridge
 * Returns a UIMessageStream compatible with useChat
 */
export async function streamCliModeChat(params: CliModeChatParams) {
  const { messages, abortSignal, onError, initialPageContext } = params;

  log.info('Starting cli mode chat', { messageCount: messages.length, hasPageContext: !!initialPageContext });

  // Get bridge state
  const state = useCliModeStore.getState();
  const { bridgeBaseUrl, bridgeToken, bridgeStatus, selectedAgentName } = state;

  // Validate bridge connection
  if (bridgeStatus !== 'connected' || !bridgeToken) {
    const error = new Error('Bridge not connected. Start the code bridge and wait for auto-connect.');
    onError?.(error);
    throw error;
  }

  // Find selected agent (fetch on-demand if needed)
  let agent = useCliModeStore.getState().availableAgents.find((a) => a.name === selectedAgentName);
  if (!agent) {
    try {
      await useCliModeStore.getState().fetchAvailableAgents();
      agent = useCliModeStore.getState().availableAgents.find((a) => a.name === selectedAgentName);
    } catch {
      // ignore; handled below
    }
  }
  if (!agent) {
    const error = new Error(`Agent "${selectedAgentName}" not found`);
    onError?.(error);
    throw error;
  }

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const messageId = 'msg-' + generateId();
      let hasStartedText = false;
      let textBuffer = '';

      try {
        // Send initial status
        writer.write({
          type: 'data-status',
          id: 'status-' + generateId(),
          data: { status: 'processing', timestamp: Date.now() },
          transient: true,
        });

        // Convert messages and prepend page context if available
        let bridgeMessages = convertMessages(messages);

        // Prepend page context to first user message if available
        if (initialPageContext && bridgeMessages.length > 0) {
          const firstUserMsgIndex = bridgeMessages.findIndex(m => m.role === 'user');
          if (firstUserMsgIndex !== -1) {
            const pageContextText = `[INITIAL PAGE CONTEXT - Captured at conversation start]\n${initialPageContext}\n\nNote: This is the page context from when this conversation started.\n\n`;

            // Get the first user message (we know it exists since index !== -1)
            const firstUserMsg = bridgeMessages[firstUserMsgIndex]!;
            const firstTextPartIndex = firstUserMsg.content.findIndex(p => p.type === 'text');

            if (firstTextPartIndex !== -1) {
              // Prepend to existing text part
              const textPart = firstUserMsg.content[firstTextPartIndex] as { type: 'text'; text: string };
              textPart.text = pageContextText + textPart.text;
            } else {
              // Add new text part at beginning
              firstUserMsg.content.unshift({ type: 'text', text: pageContextText });
            }

            log.info('Prepended page context to first user message', { contextLength: initialPageContext.length });
          }
        }

        // Get enabled tools from store
        const { enabledMap } = useToolsStore.getState();
        const enabledTools = Object.entries(enabledMap)
          .filter(([_, enabled]) => enabled)
          .map(([name]) => name);

        const rawToolsMode = useToolsStore.getState().currentMode;
        // Bridge protocol supports chat/agent/adaptive/custom (CLI provider selection is separate).
        const toolsMode: CliBridgeToolsMode = rawToolsMode;

        log.info('Sending enabled tools to bridge', { count: enabledTools.length, toolsMode });

        // Stream from bridge
        const eventStream = streamCodeBridgeChat(
          bridgeBaseUrl,
          bridgeToken,
          {
            messages: bridgeMessages,
            // elementContext removed
            agent: {
              name: agent.name,
              command: agent.command,
              args: agent.args,
            },
            enabledTools,
            toolsMode,
          },
          abortSignal
        );

        for await (const event of eventStream) {
          // Handle status events - update store for LoadingIndicator
          if (event.type === 'status') {
            log.debug('Status update', { message: event.message });
            useCliModeStore.getState().setAgentStatus(event.message);
            continue;
          }

          // Handle text events with proper start/delta/end pattern
          if (event.type === 'text' && event.content) {
            if (!hasStartedText) {
              log.info('Starting text stream', { messageId });
              // Clear status when text starts
              useCliModeStore.getState().setAgentStatus(null);
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
        // Treat user abort as a normal cancellation (no error card)
        const isAbort =
          abortSignal?.aborted ||
          (error instanceof DOMException && error.name === 'AbortError') ||
          (error instanceof Error && error.name === 'AbortError');

        if (isAbort) {
          log.info('Cli mode chat aborted', {
            aborted: abortSignal?.aborted,
            name: (error as any)?.name,
            message: (error as any)?.message,
          });

          // Clear any “agent is doing something…” status
          useCliModeStore.getState().setAgentStatus(null);

          // Ensure we close any in-progress text message properly
          // (UIMessageStream expects start/delta/end for a given id)
          if (hasStartedText) {
            writer.write({ type: 'text-end', id: messageId });
          }

          // End stream quietly
          writer.write({
            type: 'data-status',
            id: 'status-' + generateId(),
            data: { status: 'complete', timestamp: Date.now() },
            transient: false,
          });
          return;
        }

        log.error('Cli mode chat error', error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isAgentStartError = errorMessage.includes('Agent not started') ||
          errorMessage.includes('Failed to start agent') ||
          errorMessage.includes('AGENT_START_FAILED');

        // Build helpful error message
        let displayMessage = `\n\n❌ **Error:** ${errorMessage}\n\n`;

        if (isAgentStartError) {
          displayMessage += `### Troubleshooting\n\n`;
          displayMessage += `1. **Check if the agent CLI is installed** - Run the command in your terminal to verify\n`;
          displayMessage += `2. **Verify the agent supports ACP mode** - Not all CLI agents support the Agent Communication Protocol yet\n`;
          displayMessage += `3. **Check your API key** - Make sure the required environment variable is set\n`;
          displayMessage += `4. **Try a different agent** - Select another agent from the dropdown\n`;
        } else {
          displayMessage += `Make sure the code bridge is running and the extension is connected.\n`;
        }

        // Render as structured error status for the UI (error card).
        writer.write({
          type: 'data-status',
          id: 'error-status-' + generateId(),
          data: {
            status: 'error',
            title: isAgentStartError ? 'Agent failed to start' : 'Bridge error',
            errorCode: isAgentStartError ? 'AGENT_START_FAILED' : 'BRIDGE_ERROR',
            userMessage: isAgentStartError
              ? 'The selected agent could not be started.'
              : 'Unable to reach the code bridge.',
            technicalDetails: displayMessage,
            retryable: true,
            timestamp: Date.now(),
          },
          transient: false,
        });

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

      // Render as structured error status for the UI (error card).
      writer.write({
        type: 'data-status',
        id: 'error-status-' + generateId(),
        data: {
          status: 'error',
          title: isAgentStartError ? 'Agent failed to start' : 'Bridge error',
          errorCode: isAgentStartError ? 'AGENT_START_FAILED' : 'BRIDGE_ERROR',
          userMessage: isAgentStartError
            ? 'The selected agent could not be started.'
            : 'Unable to reach the code bridge.',
          technicalDetails: displayMessage,
          retryable: true,
          timestamp: Date.now(),
        },
        transient: false,
      });
      break;
    }

    case 'done':
      // Stream complete - nothing to do, completion is handled in the main loop
      break;
  }
}
