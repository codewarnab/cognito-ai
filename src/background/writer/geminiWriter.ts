/**
 * Gemini Writer Client
 * Handles text generation using Gemini API with support for both Google AI and Vertex AI providers
 */

import {
    getGoogleApiKey,
    getVertexCredentials,
    hasGoogleApiKey,
    hasVertexCredentials,
} from '@/utils/credentials';
import { GEMINI_MODELS } from '~/constants';
import { createLogger } from '~logger';
import { generateVertexAccessToken } from '../summarizer/vertexAuth';
import { parseGeminiSSE } from './streamParser';
import type { WritePageContext, WriteTone } from '@/types';

const log = createLogger('GeminiWriter', 'BACKGROUND');

/**
 * Options for text generation
 */
export interface WriterOptions {
    tone?: WriteTone;
    maxTokens?: number;
    pageContext?: WritePageContext;
}

/**
 * Provider configuration for API calls
 */
interface ProviderInfo {
    type: 'google' | 'vertex';
    url: string;
    headers: Record<string, string>;
}

/**
 * Platform-specific writing instructions
 */
const PLATFORM_INSTRUCTIONS: Record<string, string> = {
    Gmail: `You are writing an email. Be clear, professional, and include appropriate greetings/closings when appropriate.`,
    LinkedIn: `You are writing for a professional network. Be engaging, business-appropriate, and thoughtful.`,
    Twitter: `You are writing a tweet. Be concise (under 280 chars if possible), engaging, and consider hashtags if appropriate.`,
    GitHub: `You are writing for developers. Be technical, clear, and follow markdown conventions when helpful.`,
    Slack: `You are writing a workplace message. Be concise, friendly, and professional.`,
    Discord: `You are writing a chat message. Be casual and conversational.`,
    Web: `You are writing general web content. Be clear and helpful.`,
};

/**
 * Tone-specific instructions
 */
const TONE_INSTRUCTIONS: Record<WriteTone, string> = {
    professional: 'Use a professional, business-appropriate tone. Be clear, respectful, and focused.',
    casual: 'Use a casual, relaxed tone. Be friendly and conversational.',
    formal: 'Use a formal tone. Be precise, respectful, and proper.',
    friendly: 'Use a warm, friendly tone. Be approachable and personable.',
};

export class GeminiWriter {
    private model = GEMINI_MODELS.LITE;

    // Gemini API (Google AI) base URL - preferred when API key is available
    private googleBaseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    // Vertex AI base URL template
    private vertexBaseUrlTemplate = 'https://{location}-aiplatform.googleapis.com/v1';

    /**
     * Get provider info for API calls
     * Priority: Google AI (API key) > Vertex AI (service account)
     * 
     * Rationale: Google AI has simpler auth and better rate limits for extensions
     */
    private async getProviderInfo(streaming: boolean = false): Promise<ProviderInfo> {
        // Check Google AI first (preferred)
        if (await hasGoogleApiKey()) {
            const apiKey = await getGoogleApiKey();
            log.debug('Using Google AI (Gemini API) provider');
            const endpoint = streaming ? 'streamGenerateContent?alt=sse' : 'generateContent';
            return {
                type: 'google',
                url: `${this.googleBaseUrl}/models/${this.model}:${endpoint}?key=${apiKey}`,
                headers: {
                    'Content-Type': 'application/json',
                },
            };
        }

        // Fall back to Vertex AI
        if (await hasVertexCredentials()) {
            const credentials = await getVertexCredentials();
            if (!credentials) {
                throw new Error('Vertex credentials not found');
            }

            const accessToken = await generateVertexAccessToken(credentials);
            const vertexBaseUrl = this.vertexBaseUrlTemplate.replace('{location}', credentials.location);

            log.debug('Using Vertex AI provider', { location: credentials.location });
            return {
                type: 'vertex',
                url: `${vertexBaseUrl}/projects/${credentials.projectId}/locations/${credentials.location}/publishers/google/models/${this.model}:streamGenerateContent?alt=sse`,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
            };
        }

        throw new Error('No AI provider configured. Please add your Google API key or Vertex AI credentials in settings.');
    }

    /**
     * Build system prompt with context and tone instructions
     */
    private buildSystemPrompt(options?: WriterOptions): string {
        const platform = options?.pageContext?.platform || 'Web';
        const tone = options?.tone || 'professional';

        const platformInstruction = PLATFORM_INSTRUCTIONS[platform] || PLATFORM_INSTRUCTIONS['Web'];
        const toneInstruction = TONE_INSTRUCTIONS[tone];

        let contextInfo = '';
        if (options?.pageContext) {
            contextInfo = `\n\nContext: Writing on ${options.pageContext.domain}`;
            if (options.pageContext.title) {
                contextInfo += ` - Page: "${options.pageContext.title}"`;
            }
            if (options.pageContext.fieldType) {
                contextInfo += ` - Field type: ${options.pageContext.fieldType}`;
            }
        }

        return `You are a helpful writing assistant. Generate content based on the user's request.

${platformInstruction}

${toneInstruction}
${contextInfo}

Important guidelines:
- Generate ONLY the requested content, no explanations or meta-commentary
- Match the appropriate length for the platform and request
- Be accurate and don't make up facts
- If the request is unclear, provide a reasonable interpretation
- Format appropriately for the context (e.g., markdown for GitHub, plain text for emails)`;
    }

    /**
     * Non-streaming generation
     * Makes a single API call and returns the complete text
     */
    async generate(prompt: string, options?: WriterOptions): Promise<string> {
        const provider = await this.getProviderInfo(false);
        const systemPrompt = this.buildSystemPrompt(options);
        const maxTokens = options?.maxTokens || 1024;

        const body = {
            contents: [{
                role: 'user',
                parts: [{ text: prompt }]
            }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: maxTokens,
                topP: 0.95,
            }
        };

        log.info('Making non-streaming API call', {
            promptLength: prompt.length,
            provider: provider.type,
            platform: options?.pageContext?.platform,
        });

        const response = await fetch(provider.url, {
            method: 'POST',
            headers: provider.headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            log.error('API error', { status: response.status, error: errorText });
            throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        log.debug('API response received', { data });

        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            log.error('No text in response', { data });
            throw new Error('No text generated');
        }

        log.info('Generation complete', { textLength: text.length });
        return text;
    }

    /**
     * Streaming generation using Gemini API SSE
     * Supports both Google AI and Vertex AI providers
     * Returns an async generator that yields text chunks
     */
    async *generateStream(prompt: string, options?: WriterOptions): AsyncGenerator<string, void, unknown> {
        const provider = await this.getProviderInfo();
        const systemPrompt = this.buildSystemPrompt(options);
        const maxTokens = options?.maxTokens || 1024;

        const body = {
            contents: [{
                role: 'user',
                parts: [{ text: prompt }]
            }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: maxTokens,
                topP: 0.95,
            }
        };

        log.debug('Starting write stream', {
            promptLength: prompt.length,
            provider: provider.type,
            platform: options?.pageContext?.platform,
            tone: options?.tone,
        });

        const response = await fetch(provider.url, {
            method: 'POST',
            headers: provider.headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            log.error('API error', { status: response.status, provider: provider.type, error: errorText });
            throw new Error(`${provider.type === 'google' ? 'Gemini' : 'Vertex'} API error: ${response.status} - ${errorText}`);
        }

        // Use the stream parser to handle SSE response
        yield* parseGeminiSSE(response);
    }
}

// Export singleton instance
export const geminiWriter = new GeminiWriter();
