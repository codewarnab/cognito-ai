/**
 * Stream Helper Utilities
 * Utilities for writing to AI response streams
 */

import { generateId } from 'ai';
import { createLogger } from '~logger';
import { formatErrorInline } from '../../errors/errorMessages';
import { isRetryableError, APIError, NetworkError } from '../../errors/errorTypes';
import { parseGeminiError } from '../errors/handlers';

const log = createLogger('StreamHelpers', 'AI_CHAT');

/**
 * Write error message to stream with formatting
 * Now ensures a complete message structure for proper AI SDK handling
 */
export function writeErrorToStream(
  writer: any,
  error: Error,
  context?: string
): void {
  // Parse error into our error types
  const appError = error instanceof APIError || error instanceof NetworkError
    ? error
    : parseGeminiError(error);

  // Format error message for inline display
  const errorMarkdown = formatErrorInline(appError);

  // Write a complete assistant message with the error content
  // This prevents the AI SDK from trying to access undefined properties
  const messageId = 'error-msg-' + generateId();

  // Write text content
  writer.write({
    type: 'text-delta',
    id: messageId,
    delta: `${errorMarkdown}\n`,
  });

  log.error(`AI Stream Error [${context || 'unknown'}]:`, {
    errorCode: appError instanceof APIError ? appError.errorCode : 'UNKNOWN',
    message: appError.message,
    retryable: isRetryableError(appError),
  });
}

/**
 * Write status message to stream
 */
export function writeStatusToStream(
  writer: any,
  status: string,
  data?: any,
  transient: boolean = true
): void {
  writer.write({
    type: 'data-status',
    id: 'status-' + generateId(),
    data: { status, timestamp: Date.now(), ...data },
    transient,
  });
}

/**
 * Write download progress to stream
 */
export function writeDownloadProgressToStream(
  writer: any,
  modelType: 'language' | 'summarizer',
  percentage: number
): void {
  writer.write({
    type: 'data-status',
    id: `${modelType}-model-download-` + generateId(),
    data: {
      status: 'downloading',
      model: modelType,
      progress: percentage,
      message: `Downloading ${modelType === 'language' ? 'Language Model' : 'Summarizer'}... ${percentage}%`,
      timestamp: Date.now(),
    },
    transient: true,
  });
}

/**
 * Write retry status to stream
 */
export function writeRetryStatusToStream(
  writer: any,
  attempt: number,
  maxAttempts: number,
  delay: number,
  message: string
): void {
  writer.write({
    type: 'data-status',
    id: 'retry-status-' + generateId(),
    data: {
      status: 'retrying',
      message,
      attempt,
      maxAttempts,
      delay,
      timestamp: Date.now(),
    },
    transient: true,
  });
}

/**
 * Write countdown status to stream
 */
export function writeCountdownToStream(
  writer: any,
  remainingSeconds: number,
  attempt: number
): void {
  writer.write({
    type: 'data-status',
    id: 'countdown-' + generateId(),
    data: {
      status: 'countdown',
      remainingSeconds,
      attempt,
      timestamp: Date.now(),
    },
    transient: true,
  });
}

/**
 * Create error feedback for unavailable tool calls
 * Returns a message that helps the AI understand what went wrong and what tools are available
 */
export function createToolNotFoundFeedback(
  attemptedTool: string,
  availableTools: string[],
  error?: string
): string {
  const toolList = availableTools.length > 0
    ? availableTools.slice(0, 20).join(', ') + (availableTools.length > 20 ? '...' : '')
    : 'No tools available';

  return `ERROR: Tool "${attemptedTool}" is not available.\n\n` +
    `Available tools: ${toolList}\n\n` +
    `Please choose from the available tools listed above and try again with a valid tool name.` +
    (error ? `\n\nTechnical details: ${error}` : '');
}

/**
 * Create error feedback for invalid tool arguments (Zod validation failures)
 * Returns a message that helps the AI understand what parameter types are expected
 */
export function createInvalidToolArgumentsFeedback(
  attemptedTool: string,
  errorMessage: string
): string {
  // Try to extract and format the validation details
  let validationDetails = '';
  try {
    const jsonMatch = errorMessage.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const errors = JSON.parse(jsonMatch[0]);
      if (Array.isArray(errors)) {
        validationDetails = errors.map((err: any) =>
          `- Parameter "${err.path?.join('.')}" : expected ${err.expected}, received ${err.received || 'invalid value'}`
        ).join('\n');
      }
    }
  } catch {
    // If parsing fails, use a generic message
    validationDetails = 'Check parameter types against the tool schema';
  }

  return `ERROR: Invalid arguments for tool "${attemptedTool}".\n\n` +
    `Validation errors:\n${validationDetails || 'Parameter type mismatch'}\n\n` +
    `Please fix the parameter types and try again. Common fixes:\n` +
    `- String parameters must be quoted strings (e.g., "5" not 5)\n` +
    `- Number parameters must be unquoted numbers (e.g., 5 not "5")\n` +
    `- Boolean parameters must be true/false (not "true"/"false")\n` +
    `- Array parameters must be proper arrays (e.g., ["a", "b"])`;
}

