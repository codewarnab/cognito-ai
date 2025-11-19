/**
 * Stream Helper Utilities
 * Utilities for writing to AI response streams
 */

import { generateId } from 'ai';
import { createLogger } from '@logger';
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
      timestamp: Date.now()
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
      timestamp: Date.now()
    },
    transient: true,
  });
}
