/**
 * Vertex AI Provider
 * Direct API integration with Google Cloud's Vertex AI service
 */

import { getVertexCredentials } from '@/utils/credentials';
import { getContentScriptModel } from '~/constants/contentScriptModels';
import { generateVertexAccessToken } from '../summarizer/vertexAuth';
import type {
    IProvider,
    ProviderConfig,
    GenerationOptions,
    BaseRequestBody
} from './types';

/**
 * Vertex-specific request body structure (same as Gemini API)
 */
interface VertexRequestBody extends BaseRequestBody {
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
 * Vertex API response structure (same as Gemini API)
 */
interface VertexResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{ text?: string }>;
        };
    }>;
}

/**
 * Vertex AI Provider Implementation
 */
export class VertexProvider implements IProvider {
    readonly type = 'vertex' as const;

    private readonly baseUrlTemplate = 'https://{location}-aiplatform.googleapis.com/v1';

    async getConfig(streaming: boolean = false): Promise<ProviderConfig> {
        const credentials = await getVertexCredentials();
        if (!credentials) {
            throw new Error('Vertex credentials not found');
        }

        const accessToken = await generateVertexAccessToken(credentials);
        const baseUrl = this.baseUrlTemplate.replace('{location}', credentials.location);
        const modelConfig = getContentScriptModel('vertex');
        const endpoint = streaming ? 'streamGenerateContent?alt=sse' : 'generateContent';

        return {
            type: 'vertex',
            url: `${baseUrl}/projects/${credentials.projectId}/locations/${credentials.location}/publishers/google/models/${modelConfig.model}:${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            modelName: modelConfig.model,
        };
    }

    buildRequestBody(
        systemPrompt: string,
        userPrompt: string,
        options: GenerationOptions
    ): VertexRequestBody {
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
            const parsed: VertexResponse = JSON.parse(data);
            return parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
        } catch {
            return null;
        }
    }

    parseResponse(response: unknown): string {
        const vertexResponse = response as VertexResponse;
        return vertexResponse?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    }
}

/**
 * Create a new Vertex provider instance
 */
export function createVertexProvider(): VertexProvider {
    return new VertexProvider();
}
