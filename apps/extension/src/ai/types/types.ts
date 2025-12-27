/**
 * Type definitions for AI Logic
 * Shared types for local and remote AI implementations
 * 
 * ## Mode Types in Extension
 * 
 * | Type | Values | Purpose | Store |
 * |------|--------|---------|-------|
 * | AIProviderMode | local/remote | Where AI runs | useModelStore.mode |
 * | ToolsMode | chat/agent/adaptive/custom | Available tools | useToolsStore.currentMode |
 * | ChatMode | text/voice | Input method | useUINavigationStore.chatMode |
 * | Backend Mode | boolean | Use hosted API | useSettingsStore.useBackendMode |
 */

import type { UIMessage } from 'ai';
import type { AIProvider } from '@/utils/credentials';

/**
 * AI Provider Mode - where the AI inference runs
 * 
 * - `local`: Uses Chrome's built-in AI (on-device Gemini Nano)
 * - `remote`: Uses cloud API (Gemini Pro/Flash)
 * 
 * When `remote` is selected, the API call routing depends on Backend Mode:
 * - Backend Mode ON: Uses hosted Vercel backend (no API key needed)
 * - Backend Mode OFF: BYOK - direct Google AI API calls (requires API key)
 */
export type AIProviderMode = 'local' | 'remote';

/**
 * AIMode - alias for AIProviderMode
 * 
 * Many files import `AIMode` instead of `AIProviderMode`.
 * Both refer to the same concept: where AI inference runs.
 */
export type AIMode = AIProviderMode;

// Remote model options - must match presets.ts model IDs
export type RemoteModelType =
  // Google Gemini
  | 'gemini-3-pro-preview'
  | 'gemini-3-flash-preview'     // Default - Gemini 3 Flash
  | 'gemini-2.5-pro'
  | 'gemini-2.5-flash'
  | 'gemini-2.5-flash-lite'
  | 'gemini-2.5-flash-image'
  // Anthropic Claude
  | 'claude-opus-4-5'
  | 'claude-opus-4-1'
  | 'claude-sonnet-4-5'
  | 'claude-haiku-4-5'
  // xAI Grok
  | 'grok-4'
  | 'grok-4-1-fast-reasoning'
  | 'grok-4-1-fast-non-reasoning'
  | 'grok-4-fast-reasoning'
  | 'grok-4-fast-non-reasoning'
  | 'grok-code-fast-1'
  | 'grok-3'
  // OpenAI
  | 'gpt-5.2'
  | 'gpt-5.1'
  | 'gpt-5-mini'
  | 'gpt-5-nano'
  | 'gpt-4.1'
  | 'gpt-4.1-mini'
  | 'gpt-4.1-nano'

// Model configuration
export interface ModelConfig {
  mode: AIProviderMode;
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
  mode: AIProviderMode;
  remoteModel: RemoteModelType;
  hasApiKey: boolean;
  conversationStartMode?: AIProviderMode | null;
  isLoading?: boolean;
  provider?: AIProvider;
}
