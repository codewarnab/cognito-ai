/**
 * Type definitions for AI Logic
 * Shared types for local and remote AI implementations
 */

import type { UIMessage } from 'ai';
import type { AIProvider } from '../../utils/providerTypes';

// AI Mode types
export type AIMode = 'local' | 'remote';

// Remote model options
export type RemoteModelType =
  | 'gemini-2.5-flash'           // Default
  | 'gemini-2.5-flash-lite'
  | 'gemini-2.5-pro'
  | 'gemini-2.5-flash-image';

// Model configuration
export interface ModelConfig {
  mode: AIMode;
  remoteModel?: RemoteModelType;
}

// AI Response params
export interface AIStreamParams {
  messages: UIMessage[];
  abortSignal?: AbortSignal;
  initialPageContext?: string;
  onError?: (error: Error) => void;
  modelConfig: ModelConfig;
}

// Tool capabilities
export interface ToolCapabilities {
  extensionTools: boolean;    // Basic Chrome extension tools
  mcpTools: boolean;          // MCP server tools
  agentTools: boolean;        // YouTube agent, etc.
  interactionTools: boolean;  // Advanced page interactions
}

export interface ModelState {
  mode: AIMode;
  remoteModel: RemoteModelType;
  hasApiKey: boolean;
  conversationStartMode?: AIMode;
  provider?: AIProvider;
}
