import { createLogger } from '~logger';
import type { CodeModeChatParams, BridgeEvent, ApplyPatchResult } from './types';

const log = createLogger('codeBridgeClient', 'CODE_MODE_BRIDGE');

/**
 * Retry configuration for transient network failures
 */
interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
};

/**
 * Check if an error is retryable (transient network failures)
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof TypeError) {
    // Network errors (fetch failures, CORS issues when offline, etc.)
    return true;
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    // User-initiated abort - don't retry
    return false;
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Retry on network-related errors
    if (
      message.includes('network') ||
      message.includes('failed to fetch') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('econnrefused') ||
      message.includes('econnreset')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Delay execution for a given number of milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with automatic retries and exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  context: string = 'operation'
): Promise<T> {
  let lastError: unknown;
  let delayMs = config.initialDelayMs;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if error is not retryable or we've exhausted retries
      if (!isRetryableError(error) || attempt === config.maxRetries) {
        throw error;
      }

      log.warn(`${context} failed, retrying in ${delayMs}ms`, {
        attempt: attempt + 1,
        maxRetries: config.maxRetries,
        error: error instanceof Error ? error.message : String(error),
      });

      await delay(delayMs);
      delayMs = Math.min(delayMs * config.backoffMultiplier, config.maxDelayMs);
    }
  }

  throw lastError;
}

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
 * Apply a patch via the bridge (with automatic retries)
 */
export async function applyPatch(
  baseUrl: string,
  token: string,
  patchId: string
): Promise<ApplyPatchResult> {
  log.info('Applying patch', { patchId });

  return withRetry(
    async () => {
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
    },
    DEFAULT_RETRY_CONFIG,
    `applyPatch(${patchId})`
  );
}

/**
 * Check bridge health (with automatic retries for transient failures)
 */
export async function checkBridgeHealth(
  baseUrl: string,
  options?: { retryOnFailure?: boolean }
): Promise<{
  ok: boolean;
  version?: string;
  cwd?: string;
  error?: string;
}> {
  const doCheck = async () => {
    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return { ok: true, version: data.version, cwd: data.cwd };
  };

  try {
    if (options?.retryOnFailure) {
      return await withRetry(doCheck, DEFAULT_RETRY_CONFIG, 'checkBridgeHealth');
    }
    return await doCheck();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
