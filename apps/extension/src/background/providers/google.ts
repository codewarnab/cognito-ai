/**
 * Google AI (Gemini API) Provider
 * Direct API integration with Google's Generative AI service
 */

import { getGoogleApiKey } from '@/utils/credentials';
import { getLightweightModel } from '@/ai/core/lightweightModels';
import type {
    IProvider,
    ProviderConfig,
    GenerationOptions,
    BaseRequestBody
} from './types';

/**
 * Gemini-specific request body structure
 */
interface GeminiRequestBody extends BaseRequestBody {
    contents: Array<{
        role: string;
        parts: Array<{ text: string }>;
    }>;
    systemInstruction?: {
        parts: Array<{ text: string }>;
    };
    generationConfig: {
        temperature: number;
        maxOutputTokens: number;
        topP: number;
    };
}

/**
 * Gemini API response structure
 */
interface GeminiResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{ text?: string }>;
        };
    }>;
}

/**
 * Google AI (Gemini API) Provider Implementation
 */
export class GoogleProvider implements IProvider {
    readonly type = 'google' as const;

    private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    async getConfig(streaming: boolean = false): Promise<ProviderConfig> {
        const apiKey = await getGoogleApiKey();
        if (!apiKey) {
            throw new Error('Google API key not found');
        }

        const modelConfig = getLightweightModel('google');
        const endpoint = streaming ? 'streamGenerateContent' : 'generateContent';
        const queryParams = streaming ? `alt=sse&key=${apiKey}` : `key=${apiKey}`;

        return {
            type: 'google',
            url: `${this.baseUrl}/models/${modelConfig.model}:${endpoint}?${queryParams}`,
            headers: {
                'Content-Type': 'application/json',
            },
            modelName: modelConfig.model,
        };
    }

    buildRequestBody(
        systemPrompt: string,
        userPrompt: string,
        options: GenerationOptions
    ): GeminiRequestBody {
        return {
            contents: [{
                role: 'user',
                parts: [{ text: userPrompt }]
            }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            generationConfig: {
                temperature: options.temperature ?? 0.3,
                maxOutputTokens: options.maxTokens,
                topP: options.topP ?? 0.9,
            }
        };
    }

    parseStreamChunk(data: string): string | null {
        try {
            const parsed: GeminiResponse = JSON.parse(data);
            return parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
        } catch {
            return null;
        }
    }

    parseResponse(response: unknown): string {
        const geminiResponse = response as GeminiResponse;
        return geminiResponse?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    }
}

/**
 * Create a new Google provider instance
 */
export function createGoogleProvider(): GoogleProvider {
    return new GoogleProvider();
}
