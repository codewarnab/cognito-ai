/**
 * Model Settings Utility
 * Manages AI model configuration and conversation mode restrictions
 */

import type { AIMode, RemoteModelType } from '../ai/types/types';
import type { AIProvider } from './providerTypes';

const STORAGE_KEYS = {
  MODEL_CONFIG: 'ai_model_config',
  CONVERSATION_MODE: 'conversation_mode', // Track mode conversation started with
};

export interface StoredModelConfig {
  mode: AIMode;
  remoteModel: RemoteModelType;
  conversationStartMode?: AIMode; // Track initial mode for switching restrictions
  preferredProvider?: AIProvider; // Preferred AI provider (google or vertex)
}

/**
 * Get current model configuration from storage
 */
export async function getModelConfig(): Promise<StoredModelConfig> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.MODEL_CONFIG);
  return result[STORAGE_KEYS.MODEL_CONFIG] || {
    mode: 'local', // Default to local
    remoteModel: 'gemini-2.5-flash',
  };
}

/**
 * Update model configuration in storage
 */
export async function setModelConfig(config: Partial<StoredModelConfig>): Promise<void> {
  const current = await getModelConfig();
  await chrome.storage.local.set({
    [STORAGE_KEYS.MODEL_CONFIG]: { ...current, ...config }
  });
}

/**
 * Set the mode the conversation started with
 */
export async function setConversationStartMode(mode: AIMode): Promise<void> {
  const config = await getModelConfig();
  config.conversationStartMode = mode;
  await chrome.storage.local.set({ [STORAGE_KEYS.MODEL_CONFIG]: config });
}

/**
 * Clear conversation start mode (when starting new conversation)
 */
export async function clearConversationStartMode(): Promise<void> {
  const config = await getModelConfig();
  delete config.conversationStartMode;
  await chrome.storage.local.set({ [STORAGE_KEYS.MODEL_CONFIG]: config });
}

/**
 * Check if mode switch is allowed based on conversation history
 * Rules:
 * - Local ΓåÆ Remote: Always allowed (upgrading capabilities)
 * - Remote ΓåÆ Local: NOT allowed (downgrading mid-conversation)
 * - No conversation started: Always allowed
 */
export async function canSwitchMode(fromMode: AIMode, toMode: AIMode): Promise<boolean> {
  const config = await getModelConfig();
  const startMode = config.conversationStartMode;

  // If no conversation started yet, allow any switch
  if (!startMode) return true;

  // Local ΓåÆ Remote: Always allowed (upgrading capabilities)
  if (fromMode === 'local' && toMode === 'remote') return true;

  // Remote ΓåÆ Local: NOT allowed (downgrading mid-conversation)
  if (fromMode === 'remote' && toMode === 'local') return false;

  // Same mode: Always allowed
  return true;
}

/**
 * Get preferred AI provider from model config
 * @returns Preferred provider or null if not set
 */
export async function getPreferredProvider(): Promise<AIProvider | null> {
  const config = await getModelConfig();
  return config.preferredProvider || null;
}

/**
 * Set preferred AI provider
 * @param provider Provider to prefer (google or vertex)
 */
export async function setPreferredProvider(provider: AIProvider): Promise<void> {
  const config = await getModelConfig();
  config.preferredProvider = provider;
  await chrome.storage.local.set({ [STORAGE_KEYS.MODEL_CONFIG]: config });
}

/**
 * Clear preferred provider preference
 */
export async function clearPreferredProvider(): Promise<void> {
  const config = await getModelConfig();
  delete config.preferredProvider;
  await chrome.storage.local.set({ [STORAGE_KEYS.MODEL_CONFIG]: config });
}
