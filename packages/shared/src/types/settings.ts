/**
 * @cognito/shared - Settings Types
 * 
 * Shared settings interfaces for extension and webapp communication.
 * These types mirror the extension's internal settings but are exposed
 * for the webapp to read/write via external messaging.
 */

// =============================================================================
// Voice & Audio Settings
// =============================================================================

/** Gemini Live voice options */
export type VoiceName = 'Aoede' | 'Orus' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Orion';

/** Text-to-speech provider options */
export type TTSProvider = 'gemini' | 'web-native';

/** Voice settings for Gemini Live */
export interface VoiceSettings {
    voiceName: VoiceName;
}

/** TTS and suggestions settings */
export interface TTSSettings {
    ttsProvider: TTSProvider;
    suggestionsEnabled: boolean;
}

// =============================================================================
// Search Settings
// =============================================================================

/** Available search provider types */
export type SearchProviderType = 'tavily';

/** Search depth options */
export type SearchDepth = 'basic' | 'advanced';

/** Search feature settings */
export interface SearchSettings {
    /** Whether web search is enabled */
    enabled: boolean;
    /** Default search provider */
    defaultProvider: SearchProviderType;
    /** Default search depth */
    defaultSearchDepth: SearchDepth;
    /** Maximum results to return */
    maxResults: number;
    /** Whether to include images in results */
    includeImages: boolean;
}

/** API keys for search providers */
export interface SearchApiKeys {
    tavily?: string;
}

/** Combined search settings with API keys */
export interface SearchSettingsWithKeys extends SearchSettings {
    apiKeys: SearchApiKeys;
}

// =============================================================================
// Ask AI Button Settings
// =============================================================================

/** Ask AI button visibility settings */
export interface AskAIButtonSettings {
    /** Domains where button is hidden */
    hiddenDomains: string[];
    /** Session-based hide (cleared on browser restart) */
    hiddenForSession: boolean;
    /** Global disable */
    permanentlyHidden: boolean;
}

// =============================================================================
// Text Summarizer Settings
// =============================================================================

/** Summary type options */
export type SummaryTypeOption = 'key-points' | 'tl-dr' | 'headline' | 'teaser';

/** Summary length options */
export type SummaryLengthOption = 'short' | 'medium' | 'long';

/** Text summarizer settings */
export interface TextSummarizerSettings {
    enabled: boolean;
    minTextLength: number;
    summaryType: SummaryTypeOption;
    summaryLength: SummaryLengthOption;
}

// =============================================================================
// Text Rewriter Settings
// =============================================================================

/** Rewrite preset options - aligned with extension's RewritePreset */
export type RewritePresetOption = 'shorter' | 'longer' | 'professional' | 'casual' | 'improve' | 'simplify' | 'enthusiastic' | 'conversational';

/** Text rewriter settings */
export interface TextRewriterSettings {
    /** Whether the rewrite feature is enabled */
    enabled: boolean;
    /** Whether to show preset buttons in the tooltip */
    showPresets: boolean;
    /** Default preset to use (null = show all options) */
    defaultPreset: RewritePresetOption | null;
    /** Minimum text length to trigger rewrite tooltip */
    minSelectionLength: number;
    /** Enable URL fetching/analysis tool */
    enableUrlContext: boolean;
    /** Enable Google Search grounding tool */
    enableGoogleSearch: boolean;
    /** Enable Supermemory semantic search for context */
    enableSupermemorySearch: boolean;
}

// =============================================================================
// Write Command Settings
// =============================================================================

/** Write tone options */
export type WriteToneOption = 'professional' | 'casual' | 'formal' | 'friendly';

/** Write command settings */
export interface WriteCommandSettings {
    enabled: boolean;
    defaultTone: WriteToneOption;
    includePageContext: boolean;
    maxOutputTokens: number;
    /** Enable URL fetching/analysis tool */
    enableUrlContext: boolean;
    /** Enable Google Search grounding tool */
    enableGoogleSearch: boolean;
    /** Enable Supermemory semantic search */
    enableSupermemorySearch: boolean;
}

// =============================================================================
// Supermemory Settings
// =============================================================================

/** Supermemory integration settings */
export interface SupermemorySettings {
    /** Supermemory API key */
    apiKey: string;
    /** Whether Supermemory is enabled */
    enabled: boolean;
    /** Auto-extract facts from conversations */
    autoExtraction: boolean;
    /** Learn from content features (summarizer, rewriter, etc.) */
    contentMemory: boolean;
}

// =============================================================================
// Research Workflow Settings
// =============================================================================

/** Research workflow settings */
export interface ResearchWorkflowSettings {
    /** Minimum number of sources to visit before completing research */
    minimumSources: number;
    /** Maximum number of steps allowed for research */
    stepCount: number;
}

// =============================================================================
// AI Configuration Settings
// =============================================================================

/** AI configuration settings */
export interface AIConfigSettings {
    /** Maximum number of tool calls (steps) per response (1-50) */
    maxToolCallLimit: number;
}

// =============================================================================
// Message Payloads
// =============================================================================

/** Payload for PREVIEW_VOICE message */
export interface PreviewVoicePayload {
    voiceName: VoiceName;
    text?: string;
}

/** Response for PREVIEW_VOICE message */
export interface PreviewVoiceResponse {
    /** Base64-encoded audio data */
    audioData: string;
    /** Audio MIME type (e.g., 'audio/wav') */
    mimeType: string;
}

/** Response for DELETE_ALL_CHATS message */
export interface DeleteAllChatsResponse {
    /** Number of messages deleted */
    messagesDeleted: number;
    /** Number of threads deleted */
    threadsDeleted: number;
}
