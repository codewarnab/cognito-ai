/**
 * Gemini Summarizer Client
 * Handles text summarization using Gemini API with support for both Google AI and Vertex AI providers
 * 
 * Includes caching to avoid re-summarizing identical text selections
 */

import {
    getGoogleApiKey,
    getVertexCredentials,
    hasGoogleApiKey,
    hasVertexCredentials,
} from '@/utils/credentials';
import { GEMINI_MODELS } from '~/constants';
import { createLogger } from '~logger';
import { generateVertexAccessToken } from './vertexAuth';
import { LRUCache } from '~/utils/cache/LRUCache';
import { SUMMARY_TYPE_INSTRUCTIONS, SUMMARY_LENGTH_TOKENS } from '@cognito/shared';

const log = createLogger('GeminiSummarizer', 'BACKGROUND');

// ============================================================================
// Summary Cache - 30-minute TTL, max 30 entries
// ============================================================================

interface CachedSummary {
    summary: string;
    options: SummarizerOptions;
}

const summaryCache = new LRUCache<string, CachedSummary>({
    maxSize: 30,
    ttlMs: 30 * 60 * 1000, // 30 minutes
});

/**
 * Create a simple hash of text for cache key
 * Uses first 100 chars + length + options for uniqueness
 */
function createSummaryCacheKey(text: string, options: SummarizerOptions): string {
    const textHash = `${text.substring(0, 100)}::${text.length}`;
    return `${textHash}::${options.summaryType}::${options.summaryLength}`;
}

export interface SummarizerOptions {
    summaryType: 'key-points' | 'tl-dr' | 'headline' | 'teaser';
    summaryLength: 'short' | 'medium' | 'long';
    pageContext?: {
        title: string;
        url: string;
        domain: string;
    };
}

/**
 * Provider configuration for API calls
 */
interface ProviderInfo {
    type: 'google' | 'vertex';
    url: string;
    headers: Record<string, string>;
}

// SUMMARY_TYPE_INSTRUCTIONS and SUMMARY_LENGTH_TOKENS are imported from @cognito/shared

export class GeminiSummarizer {
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
    private async getProviderInfo(): Promise<ProviderInfo> {
        // Check Google AI first (preferred)
        if (await hasGoogleApiKey()) {
            const apiKey = await getGoogleApiKey();
            log.debug('Using Google AI (Gemini API) provider');
            return {
                type: 'google',
                url: `${this.googleBaseUrl}/models/${this.model}:streamGenerateContent?alt=sse&key=${apiKey}`,
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

    private buildSystemPrompt(options: SummarizerOptions): string {
        const typeInstruction = SUMMARY_TYPE_INSTRUCTIONS[options.summaryType] || SUMMARY_TYPE_INSTRUCTIONS['tl-dr'];

        let contextInfo = '';
        if (options.pageContext) {
            contextInfo = `\n\nContext: This text was selected from "${options.pageContext.title}" (${options.pageContext.domain}).`;
        }

        const formatInstructions: Record<string, string> = {
            'key-points': 'Use bullet points (- item) for each key point',
            'tl-dr': 'Use **bold** for key terms, keep mostly plain text',
            'headline': 'Plain text, single line only',
            'teaser': 'Use *italics* for emphasis if needed',
        };

        const formatInstruction = formatInstructions[options.summaryType] || formatInstructions['tl-dr'];

        return `You are a helpful text summarizer. Your task is to summarize the selected text clearly and concisely.

${typeInstruction}${contextInfo}

Important:
- Focus only on the selected text
- Be accurate and don't add information not present in the text
- Use clear, easy-to-understand language
- Format: ${formatInstruction}`;
    }

    /**
     * Streaming summarization using Gemini API SSE
     * Supports both Google AI and Vertex AI providers
     */
    async *summarizeStream(
        text: string,
        options: SummarizerOptions
    ): AsyncGenerator<string, void, unknown> {
        const provider = await this.getProviderInfo();

        const systemPrompt = this.buildSystemPrompt(options);
        const maxTokens = SUMMARY_LENGTH_TOKENS[options.summaryLength] || 250;

        const body = {
            contents: [{
                role: 'user',
                parts: [{ text: `Please summarize the following text:\n\n${text}` }]
            }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: maxTokens,
                topP: 0.9,
            }
        };

        log.debug('Starting summary stream', {
            textLength: text.length,
            provider: provider.type,
            options
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

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Process complete SSE lines
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();
                        if (data && data !== '[DONE]') {
                            try {
                                const parsed = JSON.parse(data);
                                const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                                if (text) {
                                    yield text;
                                }
                            } catch {
                                // Skip malformed JSON
                            }
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    /**
     * Non-streaming summarization (for quick summaries)
     * Uses cache to avoid re-summarizing identical text
     */
    async summarize(text: string, options: SummarizerOptions): Promise<string> {
        // Check cache first
        const cacheKey = createSummaryCacheKey(text, options);
        const cached = summaryCache.get(cacheKey);
        if (cached) {
            log.info('📦 Summary cache hit');
            return cached.summary;
        }

        let result = '';
        for await (const chunk of this.summarizeStream(text, options)) {
            result += chunk;
        }

        // Cache successful result
        if (result) {
            summaryCache.set(cacheKey, { summary: result, options });
            log.debug('📦 Cached summary');
        }

        return result;
    }
}

export const geminiSummarizer = new GeminiSummarizer();
