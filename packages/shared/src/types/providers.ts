/**
 * @cognito/shared - Providers Types
 * Matching types from @matrixages/ai-sdk-panel for extension storage
 */

export interface AIProviderConfig {
    providers: Array<ConfigProvider>;
    custom_providers?: Array<Provider>;
}

export type ConfigProvider = PresetProvider | SpecialProvider;

// Standard Provider (API Key based)
export interface Provider {
    name: string;
    api_key: string;
    base_url: string;
    enabled: boolean;
    models: Array<Model>;
    headers?: string;
}

// Preset Provider (no base_url required, supported by ai-sdk)
export interface PresetProvider extends Omit<Provider, 'base_url'> {
    api_key: string;
    base_url?: string;
}

// Special Provider (with custom fields for complex auth)
export interface SpecialProvider extends Partial<Omit<Provider, 'name' | 'enabled'>> {
    name: string;
    enabled: boolean;
    custom_fields?: Record<string, string>;
}

// Model Definition
export interface Model {
    name: string;
    id: string;
    enabled: boolean;
    fid?: string;
    desc?: string;
    features?: Features;
    fee?: { output?: number; input?: number };
}

// Model Features
export interface Features {
    vision?: boolean;
    voice?: boolean;
    function_calling?: boolean;
    structured_output?: boolean;
    reasoning?: boolean;
    reasoning_optional?: boolean;
    web_search?: boolean;
    image_input?: boolean;
    image_output?: boolean;
    embedding?: boolean;
    reranking?: boolean;
}

export type ProviderName = 'openai' | 'anthropic' | 'google_gemini' | 'vertex' | 'xai' | 'deepseek' | 'groq' | 'ollama' | string;
