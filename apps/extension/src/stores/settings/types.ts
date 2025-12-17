/**
 * Settings Store Types
 */

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
  loadFromStorage: () => Promise<void>;

  // Computed helpers
  hasGoogleApiKey: () => boolean;
  needsProviderSetup: () => boolean;
}
