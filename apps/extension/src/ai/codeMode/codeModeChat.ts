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
        const assistantId = generateId();

        for await (const event of eventStream) {
          handleBridgeEvent(event, writer, assistantId, textBuffer, (newText) => {
            textBuffer = newText;
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

        writer.write({
          type: 'data-status',
          id: 'status-' + generateId(),
          data: {
            status: 'error',
            errorCode: 'BRIDGE_ERROR',
            timestamp: Date.now(),
          },
          transient: false,
        });

        // Write error as text
        writer.write({
          type: 'text-delta',
          id: 'error-' + generateId(),
          delta: `\n\n❌ **Error:** ${error instanceof Error ? error.message : 'Unknown error'}\n\nMake sure the code bridge is running and you're paired.`,
        });

        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    },
  });

  return stream;
}

/**
 * Handle individual bridge events
 */
function handleBridgeEvent(
  event: BridgeEvent,
  writer: any,
  _assistantId: string,
  textBuffer: string,
  setTextBuffer: (text: string) => void
): void {
  switch (event.type) {
    case 'text':
      // Stream text delta
      writer.write({
        type: 'text-delta',
        id: 'text-' + generateId(),
        delta: event.content,
      });
      setTextBuffer(textBuffer + event.content);
      break;

    case 'patch_proposal':
      // Write patch proposal as a special tool result
      writer.write({
        type: 'tool-call',
        toolCallId: event.patchId,
        toolName: 'propose_patch',
        args: {
          patchId: event.patchId,
          unifiedDiff: event.unifiedDiff,
          summary: event.summary,
        },
      });
      break;

    case 'tool_call':
      writer.write({
        type: 'tool-call',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
      });
      break;

    case 'tool_result':
      writer.write({
        type: 'tool-result',
        toolCallId: event.toolCallId,
        result: event.result,
      });
      break;

    case 'error':
      writer.write({
        type: 'text-delta',
        id: 'error-' + generateId(),
        delta: `\n\n❌ **Error:** ${event.error}`,
      });
      break;

    case 'done':
      // Stream complete
      break;
  }
}
