/**
 * Gemini Rewriter Client
 * Non-streaming text rewriting using Gemini API with optional tools (URL Context, Google Search)
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
import type { RewritePreset } from '@/types';

const log = createLogger('GeminiRewriter', 'BACKGROUND');

/**
 * Preset-specific rewrite instructions
 */
const PRESET_PROMPTS: Record<RewritePreset, string> = {
    shorter: 'Make this text shorter and more concise while preserving the key meaning',
    longer: 'Expand this text with more detail and elaboration',
    professional: 'Rewrite this in a more professional and formal tone',
    casual: 'Rewrite this in a more casual and friendly tone',
    improve: 'Improve this text by fixing grammar, clarity, and flow',
    simplify: 'Simplify this text for easier understanding',
    enthusiastic: 'Rewrite this in a more enthusiastic and positive tone',
    conversational: 'Rewrite this in a more natural, conversational style',
};

/**
 * Options for text rewriting
 */
export interface RewriterOptions {
    preset?: RewritePreset;
    instruction?: string;
    enableUrlContext?: boolean;
    enableGoogleSearch?: boolean;
}

/**
 * Provider configuration for API calls
 */
interface ProviderInfo {
    type: 'google' | 'vertex';
    url: string;
    headers: Record<string, string>;
}

export class GeminiRewriter {
    private model = GEMINI_MODELS.LITE;

    // Gemini API (Google AI) base URL
    private googleBaseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    // Vertex AI base URL template
    private vertexBaseUrlTemplate = 'https://{location}-aiplatform.googleapis.com/v1';

    /**
     * Get provider info for API calls
     * Priority: Google AI (API key) > Vertex AI (service account)
     */
    private async getProviderInfo(): Promise<ProviderInfo> {
        // Check Google AI first (preferred)
        if (await hasGoogleApiKey()) {
            const apiKey = await getGoogleApiKey();
            log.debug('Using Google AI (Gemini API) provider');
            return {
                type: 'google',
                url: `${this.googleBaseUrl}/models/${this.model}:generateContent?key=${apiKey}`,
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
                url: `${vertexBaseUrl}/projects/${credentials.projectId}/locations/${credentials.location}/publishers/google/models/${this.model}:generateContent`,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
            };
        }

        throw new Error('No AI provider configured. Please add your Google API key in settings.');
    }

    /**
     * Non-streaming rewrite generation
     * Uses single API call with optional Gemini tools
     */
    async rewrite(text: string, options: RewriterOptions = {}): Promise<string> {
        const { preset, instruction, enableUrlContext, enableGoogleSearch } = options;

        // Build the instruction prompt
        const rewriteInstruction = preset
            ? PRESET_PROMPTS[preset]
            : (instruction || 'Improve this text');

        const prompt = `${rewriteInstruction}\n\nText to rewrite:\n${text}`;

        const systemPrompt = `You are a text rewriting assistant. 
Rewrite the given text according to the instruction.
Output ONLY the rewritten text, no explanations or meta-commentary.
Preserve the original formatting style unless instructed otherwise.
Maintain the same language as the input text.`;

        // Build tools array based on options
        const tools: Array<Record<string, unknown>> = [];
        if (enableUrlContext) {
            tools.push({ url_context: {} });
        }
        if (enableGoogleSearch) {
            tools.push({ google_search: {} });
        }

        // Get API configuration
        const provider = await this.getProviderInfo();

        const body: Record<string, unknown> = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: Math.max(text.length * 2, 500),
                topP: 0.95,
            },
        };

        // Add tools if any are enabled
        if (tools.length > 0) {
            body.tools = tools;
        }

        log.debug('Making rewrite API call', {
            textLength: text.length,
            preset,
            hasInstruction: !!instruction,
            provider: provider.type,
            tools: tools.length > 0 ? tools.map(t => Object.keys(t)[0]) : undefined,
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
        const rewrittenText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rewrittenText) {
            log.error('No text in response', { data });
            throw new Error('No text generated');
        }

        log.info('Rewrite complete', {
            inputLength: text.length,
            outputLength: rewrittenText.length,
            preset,
        });

        return rewrittenText;
    }
}

// Export singleton instance
export const geminiRewriter = new GeminiRewriter();
