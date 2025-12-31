import { createLogger } from '~logger';
import type { CodeModeChatParams, BridgeEvent, ApplyPatchResult } from './types';

const log = createLogger('codeBridgeClient', 'AI_CHAT');

/**
 * Parse SSE event data
 */
function parseSSEEvent(eventType: string, data: string): BridgeEvent | null {
  try {
    const parsed = JSON.parse(data);
    
    switch (eventType) {
      case 'text':
        return { type: 'text', content: parsed.content };
      case 'patch_proposal':
        return {
          type: 'patch_proposal',
          patchId: parsed.patchId,
          unifiedDiff: parsed.unifiedDiff,
          summary: parsed.summary,
        };
      case 'tool_call':
        return {
          type: 'tool_call',
          toolName: parsed.toolName,
          toolCallId: parsed.toolCallId,
          args: parsed.args,
        };
      case 'tool_result':
        return {
          type: 'tool_result',
          toolCallId: parsed.toolCallId,
          result: parsed.result,
        };
      case 'error':
        return { type: 'error', error: parsed.error };
      case 'done':
        return { type: 'done' };
      default:
        log.warn('Unknown SSE event type', { eventType });
        return null;
    }
  } catch (err) {
    log.error('Failed to parse SSE event', err);
    return null;
  }
}

/**
 * Stream chat with the code bridge
 */
export async function* streamCodeBridgeChat(
  baseUrl: string,
  token: string,
  params: CodeModeChatParams,
  abortSignal?: AbortSignal
): AsyncGenerator<BridgeEvent> {
  log.info('Starting code bridge chat stream', { agent: params.agent.name });

  const response = await fetch(`${baseUrl}/code/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(params),
    signal: abortSignal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEventType = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE format
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          const data = line.slice(6);
          const event = parseSSEEvent(currentEventType, data);
          if (event) {
            yield event;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Apply a patch via the bridge
 */
export async function applyPatch(
  baseUrl: string,
  token: string,
  patchId: string
): Promise<ApplyPatchResult> {
  log.info('Applying patch', { patchId });

  const response = await fetch(`${baseUrl}/code/patch/apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ patchId }),
  });

  const result = await response.json();

  if (!response.ok) {
    return {
      applied: false,
      filesChanged: result.filesChanged || [],
      error: result.error || `HTTP ${response.status}`,
    };
  }

  return result;
}

/**
 * Check bridge health
 */
export async function checkBridgeHealth(baseUrl: string): Promise<{
  ok: boolean;
  version?: string;
  cwd?: string;
  error?: string;
}> {
  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { ok: true, version: data.version, cwd: data.cwd };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
