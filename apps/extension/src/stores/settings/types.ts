/**
 * Settings Store Types
 */

/** Available backend models */
export type BackendModel = 'gemini-2.0-flash' | 'gemini-1.5-flash' | 'gemini-1.5-pro';

/** Backend model options for UI */
export const BACKEND_MODEL_OPTIONS: Array<{
  value: BackendModel;
  label: string;
  description: string;
}> = [
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', description: 'Fast & capable' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', description: 'Balanced' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', description: 'Most capable (higher quota usage)' },
];

export interface SettingsState {
  // Provider settings
  hasAnyProviderConfigured: boolean;
  googleApiKey: string | null;
  anthropicApiKey: string | null;
  openaiApiKey: string | null;

  // Model preferences
  preferredModel: string;
  preferredMode: 'local' | 'remote' | 'agent' | 'adaptive';

  // Feature flags
  enableVoiceMode: boolean;
  enableNotificationSound: boolean;
  showSearchToggle: boolean;

  // Tool settings
  enabledBuiltInTools: string[];

  // Logger settings
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logCategories: string[];

  // UI preferences
  theme: 'dark' | 'light' | 'system';
  compactMode: boolean;

  // Backend mode settings
  useBackendMode: boolean;
  backendModel: BackendModel;

  // Hydration state
  isHydrated: boolean;

  // Actions
  setApiKey: (provider: 'google' | 'anthropic' | 'openai', key: string | null) => Promise<void>;
  setPreferredModel: (model: string) => void;
  setPreferredMode: (mode: SettingsState['preferredMode']) => void;
  toggleTool: (toolId: string, enabled: boolean) => void;
  setLogLevel: (level: SettingsState['logLevel']) => void;
  setTheme: (theme: SettingsState['theme']) => void;
  setCompactMode: (compact: boolean) => void;
  setEnableVoiceMode: (enabled: boolean) => void;
  setEnableNotificationSound: (enabled: boolean) => void;
  setUseBackendMode: (value: boolean) => void;
  setBackendModel: (model: BackendModel) => void;
  loadFromStorage: () => Promise<void>;

  // Computed helpers
  hasGoogleApiKey: () => boolean;
  needsProviderSetup: () => boolean;
}
