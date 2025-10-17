/**
 * AI System Type Definitions
 * Using AI SDK v5 with custom types for Chrome Extension
 */

import type { UIMessage } from 'ai';

// ============================================================================
// Custom Message Types with Data Parts
// ============================================================================

/**
 * Custom UI Message type with extension-specific data parts
 */
export type AIMessageWithData = UIMessage<
  never, // metadata type
  {
    // Status updates during streaming
    status: {
      status: 'processing' | 'completed' | 'error';
      timestamp: number;
    };
    // Browser context information
    context: {
      tabUrl?: string;
      tabTitle?: string;
      selectedText?: string;
    };
    // Notification data (transient)
    notification: {
      message: string;
      level: 'info' | 'warning' | 'error';
    };
  }
>;

// ============================================================================
// Message Protocol Types for Chrome Extension Communication
// ============================================================================

/**
 * Start streaming AI response
 */
export interface AIStreamStartMessage {
  type: 'AI_STREAM_START';
  payload: {
    id: string;
    messages: UIMessage[];
    trigger?: 'submit-message' | 'regenerate-message';
    messageId?: string;
  };
}

/**
 * Stream chunk (SSE data)
 */
export interface AIStreamChunkMessage {
  type: 'AI_STREAM_CHUNK';
  payload: any;
}

/**
 * Stream completed successfully
 */
export interface AIStreamEndMessage {
  type: 'AI_STREAM_END';
}

/**
 * Stream error
 */
export interface AIStreamErrorMessage {
  type: 'AI_STREAM_ERROR';
  payload: {
    error: string;
  };
}

/**
 * Abort stream request
 */
export interface AIStreamAbortMessage {
  type: 'AI_STREAM_ABORT';
  payload?: {
    id: string;
  };
}

/**
 * Union type for all AI stream messages
 */
export type AIStreamMessage =
  | AIStreamStartMessage
  | AIStreamChunkMessage
  | AIStreamEndMessage
  | AIStreamErrorMessage
  | AIStreamAbortMessage;

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * AI configuration options
 */
export interface AIConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Stream state
 */
export interface StreamState {
  id: string;
  controller: AbortController;
  startTime: number;
  status: 'active' | 'completed' | 'error' | 'aborted';
}
