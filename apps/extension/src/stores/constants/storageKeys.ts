/**
 * Centralized Storage Keys
 *
 * All Chrome storage keys used by stores should be defined here
 * to prevent typos and enable easy refactoring.
 */

export const STORAGE_KEYS = {
  // Settings store
  SETTINGS: 'cognito_settings',

  // Model store
  MODEL_CONFIG: 'ai_model_config',

  // Approval store
  TOOL_APPROVAL: 'toolApprovalPreferences',

  // Legacy keys (for migration)
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
