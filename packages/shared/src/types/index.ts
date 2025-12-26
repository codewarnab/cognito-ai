/**
 * @cognito/shared - Types
 * Re-exports all shared types
 */

// Writer types
export type { WriteTone, WritePageContext, WritePlatform } from './writer.js';

// Rewriter types
export type { RewritePreset, RewritePageContext } from './rewriter.js';

// Summarizer types
export type { SummaryType, SummaryLength, SummaryPageContext } from './summarizer.js';

// Transcript types
export type {
    TranscriptSegment,
    TranscriptRequestBody,
    TranscriptResponse,
    TranscriptLegacyResponse,
    VideoInfo,
} from './transcript.js';

// Chat types
export type {
    AIChatMessage,
    AIChatRequestBody,
    AIChatErrorResponse,
    ChatMode,
} from './chat.js';

// Provider types
export type {
    AIProvider,
    VertexCredentials,
    ProviderConfig,
} from './provider.js';

// New Provider types (multi-provider support)
export type {
    AIProviderConfig,
    ConfigProvider,
    Provider,
    PresetProvider,
    SpecialProvider,
    Model,
    Features,
    ProviderName,
} from './providers.js';

// Messaging types
export type {
    ExternalMessageType,
    ExternalMessage,
    ExternalResponse,
    SetProviderPayload,
    GetProviderConfigResponse,
    ClearProviderPayload,
    CreateReminderPayload,
    DeleteReminderPayload,
    LifecycleMessageType,
    OnboardingMessageType,
    SettingsMessageType,
    ProviderMessageType,
    ReminderMessageType,
    FeatureSettingsMessageType,
    DataOperationsMessageType,
    GetProvidersConfigResponse,
    SetProvidersConfigPayload,
    TestProviderConnectionPayload,
    TestProviderConnectionResponse,
    LoggerConfigUpdatePayload,
    LoggerConfigResponse,
} from './messaging.js';

// Reminder types
export type {
    RepeatFrequency,
    Reminder,
    UpdateReminderPayload,
} from './reminder.js';

// Logger types
export type {
    LogCategory,
    LogSubCategory,
    MCPClientSubCategory,
    MCPToolsSubCategory,
    MCPExecutionSubCategory,
    MCPAuthSubCategory,
    MCPSSESubCategory,
    WEBMCPSubCategory,
    ToolsRegistrySubCategory,
    ToolsExecutionSubCategory,
    ToolsValidationSubCategory,
    ToolsIntegrationSubCategory,
    AIChatSubCategory,
    AIPromptsSubCategory,
    VoiceRecordingSubCategory,
    VoiceClientSubCategory,
    VoiceUISubCategory,
    VoiceAudioSubCategory,
    UIChatSubCategory,
    UIVoiceSubCategory,
    UISettingsSubCategory,
    UIThreadsSubCategory,
    UISidepanelSubCategory,
    UIRemindersSubCategory,
    LoggerConfig,
    LoggerPresetName,
    LoggerCategoryGroup,
    CategoryWithSubCategories,
} from './logger.js';
export { LOGGER_CONFIG_KEY, LOGGER_CATEGORY_GROUPS, LOGGER_SUBCATEGORY_GROUPS, hasSubCategories } from './logger.js';

// Settings types (for webapp <-> extension communication)
export type {
    VoiceName,
    TTSProvider,
    VoiceSettings,
    TTSSettings,
    SearchProviderType,
    SearchDepth,
    SearchSettings,
    SearchApiKeys,
    SearchSettingsWithKeys,
    AskAIButtonSettings,
    SummaryTypeOption,
    SummaryLengthOption,
    TextSummarizerSettings,
    RewritePresetOption,
    TextRewriterSettings,
    WriteToneOption,
    WriteCommandSettings,
    SupermemorySettings,
    ResearchWorkflowSettings,
    AIConfigSettings,
    PreviewVoicePayload,
    PreviewVoiceResponse,
    DeleteAllChatsResponse,
} from './settings.js';

