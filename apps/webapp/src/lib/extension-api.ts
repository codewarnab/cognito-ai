import type {
    ExternalMessage,
    ExternalResponse,
    LifecycleMessageType,
    SettingsMessageType,
    ProviderMessageType,
    CreateReminderPayload,
    DeleteReminderPayload,
    UpdateReminderPayload,
    Reminder,
    SetProviderPayload,
    ClearProviderPayload,
    GetProviderConfigResponse,
    GetProvidersConfigResponse,
    SetProvidersConfigPayload,
    TestProviderConnectionPayload,
    TestProviderConnectionResponse,
    TestProviderConnectionResponse as TestResponse, // Alias if needed, or just use TestProviderConnectionResponse
    ConfigProvider,
    AIProviderConfig,
    AIProvider,
    // Settings types
    AIConfigSettings,
    SearchSettingsWithKeys,
    AskAIButtonSettings,
    TextSummarizerSettings,
    TextRewriterSettings,
    WriteCommandSettings,
    SupermemorySettings,
    ResearchWorkflowSettings,
    TTSSettings,
    VoiceSettings,
    VoiceName,
    PreviewVoiceResponse,
    DeleteAllChatsResponse,
} from '@cognito/shared';

const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID;

class ExtensionAPI {
    private static instance: ExtensionAPI;

    static getInstance(): ExtensionAPI {
        if (!this.instance) {
            this.instance = new ExtensionAPI();
        }
        return this.instance;
    }

    async isAvailable(): Promise<boolean> {
        return typeof chrome !== 'undefined' && !!chrome.runtime?.sendMessage;
    }

    async isInstalled(): Promise<boolean> {
        try {
            const response = await this.sendMessage({ type: 'PING' });
            return response.success;
        } catch {
            return false;
        }
    }

    async sendMessage<T>(message: ExternalMessage): Promise<ExternalResponse<T>> {
        if (!await this.isAvailable()) {
            throw new Error('Chrome extension API not available');
        }

        if (!EXTENSION_ID) {
            // For development, we might want to allow this or throw a specific error
            console.warn('Extension ID not configured (NEXT_PUBLIC_EXTENSION_ID)');
            // If we are on localhost, maybe we can try sending to a hardcoded dev ID if known, 
            // but for now let's just warn and throw or fail.
            throw new Error('Extension ID not configured');
        }

        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(EXTENSION_ID!, message, (response: ExternalResponse<T>) => {
                if (chrome.runtime.lastError) {
                    // If the extension is not installed or ID is wrong, this will trigger
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }

    // Convenience methods - Settings
    async getAllSettings() {
        return this.sendMessage({ type: 'GET_ALL_SETTINGS' as SettingsMessageType });
    }

    async setSettings(settings: unknown) { // Use proper type when available
        return this.sendMessage({ type: 'SET_SETTINGS' as SettingsMessageType, payload: settings });
    }

    // Convenience methods - Lifecycle
    async openSidePanel() {
        return this.sendMessage({ type: 'OPEN_SIDEPANEL' as LifecycleMessageType });
    }

    // Convenience methods - Provider Config
    async getProviderConfig() {
        return this.sendMessage<GetProviderConfigResponse>({ type: 'GET_PROVIDER_CONFIG' as ProviderMessageType });
    }

    async setProviderConfig(payload: SetProviderPayload) {
        return this.sendMessage({ type: 'SET_PROVIDER_CONFIG' as ProviderMessageType, payload });
    }

    async clearProviderConfig(provider: AIProvider) {
        const payload: ClearProviderPayload = { provider };
        return this.sendMessage({ type: 'CLEAR_PROVIDER_CONFIG' as ProviderMessageType, payload });
    }

    // New Multi-Provider Methods
    async getProvidersConfig() {
        return this.sendMessage<GetProvidersConfigResponse>({ type: 'GET_PROVIDERS_CONFIG' });
    }

    async setProvidersConfig(config: AIProviderConfig) {
        return this.sendMessage({ type: 'SET_PROVIDERS_CONFIG', payload: config as SetProvidersConfigPayload });
    }

    async testProviderConnection(provider: ConfigProvider) {
        return this.sendMessage<TestProviderConnectionResponse>({
            type: 'TEST_PROVIDER_CONNECTION',
            payload: { provider } as TestProviderConnectionPayload
        });
    }

    async getReminders() {
        return this.sendMessage<Reminder[]>({ type: 'GET_REMINDERS' });
    }

    async createReminder(payload: CreateReminderPayload) {
        return this.sendMessage<Reminder>({ type: 'CREATE_REMINDER', payload });
    }

    async updateReminder(id: string, updates: Partial<Omit<Reminder, 'id' | 'createdAt'>>) {
        const payload: UpdateReminderPayload = { id, updates };
        return this.sendMessage<Reminder>({ type: 'UPDATE_REMINDER', payload });
    }

    async deleteReminder(id: string) {
        return this.sendMessage({ type: 'DELETE_REMINDER', payload: { id } as DeleteReminderPayload });
    }

    // =================================================================
    // Feature Settings - AI Config
    // =================================================================
    async getAIConfig() {
        return this.sendMessage<AIConfigSettings>({ type: 'GET_AI_CONFIG' });
    }

    async setAIConfig(payload: Partial<AIConfigSettings>) {
        return this.sendMessage({ type: 'SET_AI_CONFIG', payload });
    }

    // =================================================================
    // Feature Settings - Search
    // =================================================================
    async getSearchSettings() {
        return this.sendMessage<SearchSettingsWithKeys>({ type: 'GET_SEARCH_SETTINGS' });
    }

    async setSearchSettings(payload: Partial<SearchSettingsWithKeys>) {
        return this.sendMessage({ type: 'SET_SEARCH_SETTINGS', payload });
    }

    // =================================================================
    // Feature Settings - Ask AI Button
    // =================================================================
    async getAskAISettings() {
        return this.sendMessage<AskAIButtonSettings>({ type: 'GET_ASK_AI_SETTINGS' });
    }

    async setAskAISettings(payload: Partial<AskAIButtonSettings> & { action?: string; domain?: string }) {
        return this.sendMessage({ type: 'SET_ASK_AI_SETTINGS', payload });
    }

    // =================================================================
    // Feature Settings - Text Summarizer
    // =================================================================
    async getSummarizerSettings() {
        return this.sendMessage<TextSummarizerSettings>({ type: 'GET_SUMMARIZER_SETTINGS' });
    }

    async setSummarizerSettings(payload: Partial<TextSummarizerSettings>) {
        return this.sendMessage({ type: 'SET_SUMMARIZER_SETTINGS', payload });
    }

    // =================================================================
    // Feature Settings - Text Rewriter
    // =================================================================
    async getRewriterSettings() {
        return this.sendMessage<TextRewriterSettings>({ type: 'GET_REWRITER_SETTINGS' });
    }

    async setRewriterSettings(payload: Partial<TextRewriterSettings>) {
        return this.sendMessage({ type: 'SET_REWRITER_SETTINGS', payload });
    }

    // =================================================================
    // Feature Settings - Write Command
    // =================================================================
    async getWriteSettings() {
        return this.sendMessage<WriteCommandSettings>({ type: 'GET_WRITE_SETTINGS' });
    }

    async setWriteSettings(payload: Partial<WriteCommandSettings>) {
        return this.sendMessage({ type: 'SET_WRITE_SETTINGS', payload });
    }

    // =================================================================
    // Feature Settings - Supermemory
    // =================================================================
    async getSupermemorySettings() {
        return this.sendMessage<SupermemorySettings>({ type: 'GET_SUPERMEMORY_SETTINGS' });
    }

    async setSupermemorySettings(payload: Partial<SupermemorySettings>) {
        return this.sendMessage({ type: 'SET_SUPERMEMORY_SETTINGS', payload });
    }

    // =================================================================
    // Feature Settings - Research
    // =================================================================
    async getResearchSettings() {
        return this.sendMessage<ResearchWorkflowSettings>({ type: 'GET_RESEARCH_SETTINGS' });
    }

    async setResearchSettings(payload: Partial<ResearchWorkflowSettings>) {
        return this.sendMessage({ type: 'SET_RESEARCH_SETTINGS', payload });
    }

    // =================================================================
    // Feature Settings - TTS
    // =================================================================
    async getTTSSettings() {
        return this.sendMessage<TTSSettings>({ type: 'GET_TTS_SETTINGS' });
    }

    async setTTSSettings(payload: Partial<TTSSettings>) {
        return this.sendMessage({ type: 'SET_TTS_SETTINGS', payload });
    }

    // =================================================================
    // Feature Settings - Voice
    // =================================================================
    async getVoiceSettings() {
        return this.sendMessage<VoiceSettings>({ type: 'GET_VOICE_SETTINGS' });
    }

    async setVoiceSettings(payload: Partial<VoiceSettings>) {
        return this.sendMessage({ type: 'SET_VOICE_SETTINGS', payload });
    }

    async previewVoice(voiceName: VoiceName, text?: string) {
        return this.sendMessage<PreviewVoiceResponse>({
            type: 'PREVIEW_VOICE',
            payload: { voiceName, text }
        });
    }

    // =================================================================
    // Data Operations
    // =================================================================
    async deleteAllChats() {
        return this.sendMessage<DeleteAllChatsResponse>({ type: 'DELETE_ALL_CHATS' });
    }

    // =================================================================
    // Logger Config Sync
    // =================================================================
    async getLoggerConfig() {
        return this.sendMessage<{ config: import('@cognito/shared').LoggerConfig }>({ type: 'LOGGER_CONFIG_REQUEST' });
    }

    async updateLoggerConfig(config: import('@cognito/shared').LoggerConfig) {
        return this.sendMessage({ type: 'LOGGER_CONFIG_UPDATE', payload: { config } });
    }
}

export const extensionAPI = ExtensionAPI.getInstance();

