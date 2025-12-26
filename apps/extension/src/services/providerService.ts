import { getSetting, setSetting } from '@/db/settings';
import type { AIProviderConfig, TestProviderConnectionPayload, TestProviderConnectionResponse } from '@cognito/shared/types';
import { createLogger } from '~logger';

const log = createLogger('ProviderService', 'BACKGROUND_SERVICE');

export const getProvidersConfig = async (): Promise<AIProviderConfig | undefined> => {
    return await getSetting('providersConfig');
};

export const setProvidersConfig = async (config: AIProviderConfig): Promise<void> => {
    await setSetting('providersConfig', config);
    log.info('Providers config updated');
};

export const testProviderConnection = async (payload: TestProviderConnectionPayload): Promise<TestProviderConnectionResponse> => {
    const { provider } = payload;
    const { name, api_key } = provider as any; // Cast to access common fields

    if (!api_key && name !== 'ollama') { // Ollama might not need a key, others usually do
        return { success: false, error: 'API key is missing' };
    }

    try {
        let response;
        switch (name) {
            case 'openai':
                response = await fetch('https://api.openai.com/v1/models', {
                    headers: { 'Authorization': `Bearer ${api_key}` }
                });
                break;
            case 'anthropic':
                response = await fetch('https://api.anthropic.com/v1/models', {
                    headers: {
                        'x-api-key': api_key,
                        'anthropic-version': '2023-06-01'
                    }
                });
                break;
            case 'google_gemini':
                response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${api_key}`);
                break;
            case 'deepseek':
                response = await fetch('https://api.deepseek.com/models', {
                    headers: { 'Authorization': `Bearer ${api_key}` }
                });
                break;
            case 'groq':
                response = await fetch('https://api.groq.com/openai/v1/models', {
                    headers: { 'Authorization': `Bearer ${api_key}` }
                });
                break;
            case 'xai':
                response = await fetch('https://api.x.ai/v1/models', {
                    headers: { 'Authorization': `Bearer ${api_key}` }
                });
                break;
            case 'ollama':
                // Expect base_url for Ollama
                const baseUrl = (provider as any).base_url || 'http://localhost:11434';
                // Ensure no trailing slash for consistent appending
                const cleanBaseUrl = baseUrl.replace(/\/$/, '');
                response = await fetch(`${cleanBaseUrl}/api/tags`);
                break;
            // Add other providers as needed
            default:
                // For unknown or custom providers, if they have a base_url, try a generic check?
                // Or just return success for now if we can't test.
                // But better to return error if we don't know how to test.
                if ((provider as any).base_url) {
                    // Try a generic OpenAI-compatible models endpoint?
                    const baseUrl = (provider as any).base_url.replace(/\/$/, '');
                    response = await fetch(`${baseUrl}/models`, {
                        headers: { 'Authorization': `Bearer ${api_key}` }
                    });
                } else {
                    return { success: false, error: `Testing not implemented for provider: ${name}` };
                }
        }

        if (response.ok) {
            return { success: true };
        } else {
            const text = await response.text();
            return { success: false, error: `API request failed: ${response.status} ${response.statusText} - ${text.substring(0, 100)}` };
        }

    } catch (error) {
        log.error(`Failed to test connection for ${name}`, error);
        return { success: false, error: error instanceof Error ? error.message : 'Connection failed' };
    }
};
