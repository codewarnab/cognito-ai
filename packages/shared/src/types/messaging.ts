import type { AIProvider, ProviderConfig, VertexCredentials } from './provider.js';
import type { AIProviderConfig, ConfigProvider } from './providers.js';
import type { UpdateReminderPayload, Reminder } from './reminder.js';
import type { LoggerConfig } from './logger.js';

// Re-export reminder types for convenience
export type { UpdateReminderPayload, Reminder } from './reminder.js';

// Lifecycle
export type LifecycleMessageType = 'PING' | 'OPEN_SIDEPANEL';

// Onboarding
export type OnboardingMessageType = 'GET_ONBOARDING_STATUS' | 'SET_ONBOARDING_COMPLETE';

// Settings - General
export type SettingsMessageType =
    | 'GET_ALL_SETTINGS'
    | 'SET_SETTINGS';

// Provider
export type ProviderMessageType =
    | 'GET_PROVIDER_CONFIG'
    | 'SET_PROVIDER_CONFIG'
    | 'CLEAR_PROVIDER_CONFIG'
    | 'VALIDATE_API_KEY'
    | 'GET_PROVIDERS_CONFIG'
    | 'SET_PROVIDERS_CONFIG'
    | 'TEST_PROVIDER_CONNECTION';

// Reminders
export type ReminderMessageType =
    | 'GET_REMINDERS'
    | 'CREATE_REMINDER'
    | 'UPDATE_REMINDER'
    | 'DELETE_REMINDER';

// Feature-specific settings
export type FeatureSettingsMessageType =
    | 'GET_SEARCH_SETTINGS'
    | 'SET_SEARCH_SETTINGS'
    | 'GET_ASK_AI_SETTINGS'
    | 'SET_ASK_AI_SETTINGS'
    | 'GET_SUMMARIZER_SETTINGS'
    | 'SET_SUMMARIZER_SETTINGS'
    | 'GET_REWRITER_SETTINGS'
    | 'SET_REWRITER_SETTINGS'
    | 'GET_WRITE_SETTINGS'
    | 'SET_WRITE_SETTINGS'
    | 'GET_SUPERMEMORY_SETTINGS'
    | 'SET_SUPERMEMORY_SETTINGS'
    | 'GET_RESEARCH_SETTINGS'
    | 'SET_RESEARCH_SETTINGS'
    | 'GET_TTS_SETTINGS'
    | 'SET_TTS_SETTINGS'
    | 'GET_VOICE_SETTINGS'
    | 'SET_VOICE_SETTINGS'
    | 'GET_AI_CONFIG'
    | 'SET_AI_CONFIG';

// Data operations
export type DataOperationsMessageType =
    | 'DELETE_ALL_CHATS'
    | 'PREVIEW_VOICE';

// Logger config sync (webapp → extension)
export type LoggerMessageType =
    | 'LOGGER_CONFIG_UPDATE'
    | 'LOGGER_CONFIG_REQUEST';

export type ExternalMessageType =
    | LifecycleMessageType
    | OnboardingMessageType
    | SettingsMessageType
    | ProviderMessageType
    | ReminderMessageType
    | FeatureSettingsMessageType
    | DataOperationsMessageType
    | LoggerMessageType;

export interface ExternalMessage<T = unknown> {
    type: ExternalMessageType;
    payload?: T;
}

export interface ExternalResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    version?: string;
}

// Payload Types

// Re-export provider types for convenience
export type { AIProvider, ProviderConfig, VertexCredentials } from './provider.js';

/** Response payload for GET_PROVIDER_CONFIG */
export interface GetProviderConfigResponse {
    config: ProviderConfig | null;
    hasGoogle: boolean;
    hasVertex: boolean;
}

/** Payload for SET_PROVIDER_CONFIG */
export interface SetProviderPayload {
    provider: AIProvider;
    googleApiKey?: string;
    vertexCredentials?: VertexCredentials;
}

/** Payload for CLEAR_PROVIDER_CONFIG */
export interface ClearProviderPayload {
    provider: AIProvider;
}

/** Response payload for GET_PROVIDERS_CONFIG */
export interface GetProvidersConfigResponse {
    config: AIProviderConfig;
    /** Currently selected model ID in the extension */
    selectedModel?: string;
    /** Currently selected provider ID (google_gemini, vertex, anthropic, etc.) */
    selectedProvider?: string;
}

/** Payload for SET_PROVIDERS_CONFIG */
export type SetProvidersConfigPayload = AIProviderConfig;

/** Payload for TEST_PROVIDER_CONNECTION */
export interface TestProviderConnectionPayload {
    providerName: string; // Just the name, extension looks up config? Or pass config?
    // The plan says "Test provider API key" in 4.1. "const result = await extensionAPI.testProviderConnection(provider.name);"
    // But 4.3 says "testProviderConnection(provider)" passing the whole object?
    // "testProviderConnection(provider.name)" implies backend looks it up? But if I am editing it, it might not be saved yet?
    // Usually "Test Connection" tests the *current input values*.
    // So passing the provider config to test is safer.
    provider: ConfigProvider;
}

export interface TestProviderConnectionResponse {
    success: boolean;
    error?: string;
}

export interface CreateReminderPayload {
    title: string;
    when: number;
    generatedTitle?: string;
    generatedDescription?: string;
    repeat?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
}

export interface DeleteReminderPayload {
    id: string;
}

// Logger config sync payloads
/** Payload for LOGGER_CONFIG_UPDATE message */
export interface LoggerConfigUpdatePayload {
    config: LoggerConfig;
}

/** Response for LOGGER_CONFIG_REQUEST message */
export interface LoggerConfigResponse {
    config: LoggerConfig;
}

// Re-export specific settings types if needed, or define AllSettingsPayload here
// For now, using 'unknown' or 'any' in GET_ALL_SETTINGS response inside the implementation is fine,
// but defining a strict type is better.
// Since we don't have access to all internal setting types here easily (unless we move them to shared),
// we will define what we can. Ideally, all setting interfaces should be in shared.

// TODO: Move all Settings interfaces to shared package in a later step or now?
// The plan says "Phase 1: ... TypeScript types added to @cognito/shared".
// It lists many interfaces in "Complete Storage Key Inventory".
// I should probably add them to `settings.ts` in shared and import them here.

