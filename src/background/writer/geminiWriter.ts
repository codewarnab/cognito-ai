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
import {
    getMemorySearchTool,
    hasFunctionCall,
    extractFunctionCall,
    executeMemorySearch,
    type GeminiContentPart,
} from '../supermemory';
import { searchMemories, formatMemoriesForPrompt } from '../supermemory';
import type { WritePageContext, WriteTone } from '@/types';

const log = createLogger('GeminiWriter', 'BACKGROUND');

/**
 * Options for text generation
 */
export interface WriterOptions {
    tone?: WriteTone;
    maxTokens?: number;
    pageContext?: WritePageContext;
    // Gemini Tool options
    enableUrlContext?: boolean;    // Enable URL fetching/analysis tool
    enableGoogleSearch?: boolean;  // Enable Google Search grounding tool
    // Supermemory integration - Phase 6: AI-driven function calling
    enableSupermemorySearch?: boolean; // Enable AI to decide when to search memories
    // Attachment support - multimodal content
    attachment?: {
        base64Data: string;
        mimeType: string;
        fileName: string;
        fileSize: number;
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

/**
 * Content part for Gemini API request
 */
interface GeminiRequestPart {
    text?: string;
    inlineData?: {
        mimeType: string;
        data: string;
    };
}

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

        // Add attachment-specific instructions
        let attachmentInstructions = '';
        if (options?.attachment) {
            const isImage = options.attachment.mimeType.startsWith('image/');
            attachmentInstructions = isImage
                ? `\n\nThe user has attached an image. Analyze it carefully and incorporate what you see into your response. Describe relevant visual elements if they relate to the writing request.`
                : `\n\nThe user has attached a document. Read and analyze its contents carefully. Use the information from the document to inform your response. You can reference specific details, summarize sections, or build upon the document's content as needed.`;
        }

        return `You are a helpful writing assistant. Generate content based on the user's request.

${platformInstruction}

${toneInstruction}
${contextInfo}

Important guidelines:
- Output ONLY the requested content itself with no preamble, introduction, or meta-commentary
- Do NOT add phrases like "Here is...", "Here's...", "Sure, here's...", etc.
- Start directly with the actual content
- BE CONCISE by default - keep responses brief and to the point unless the user explicitly asks for detailed, long, or comprehensive content
- For most requests, aim for 1-3 short paragraphs or less
- Only write longer content when specifically asked (e.g., "write a detailed...", "explain thoroughly...", "comprehensive guide...")
- This applies to ALL requests including those with image or document attachments - stay concise unless explicitly asked for detail
- Match the appropriate length for the platform (tweets should be short, emails moderate, articles can be longer if requested)
- Be accurate and don't make up facts
- If the request is unclear, provide a reasonable interpretation
- You MAY use markdown formatting when appropriate:
  - Use **bold** and *italics* for emphasis
  - Use bullet points/numbered lists for structured content
  - Use code blocks for technical content
  - Use headers sparingly (##, ###) for longer content with sections
- Keep formatting minimal and purposeful - don't over-format simple text
- Match formatting style to the platform context (tweets = minimal, GitHub = more markdown)${attachmentInstructions}`;
    }

    /**
     * Build request parts for multimodal content
     * Attachments are placed before text per Gemini best practices
     */
    private buildRequestParts(prompt: string, options?: WriterOptions): GeminiRequestPart[] {
        const parts: GeminiRequestPart[] = [];

        // Add attachment first (before text, per Gemini best practices)
        if (options?.attachment) {
            parts.push({
                inlineData: {
                    mimeType: options.attachment.mimeType,
                    data: options.attachment.base64Data,
                },
            });
        }

        // Add text prompt
        parts.push({ text: prompt });

        return parts;
    }

    /**
     * Non-streaming generation
     * Makes a single API call and returns the complete text
     * Supports function calling loop for AI-driven memory search
     * 
     * Note: Gemini API limitation - built-in tools (google_search, url_context) cannot
     * be mixed with function calling. When built-in tools are enabled, we pre-search
     * memories and include them in the prompt instead of using function calling.
     */
    async generate(prompt: string, options?: WriterOptions): Promise<string> {
        const provider = await this.getProviderInfo(false);
        const systemPrompt = this.buildSystemPrompt(options);
        const maxTokens = options?.maxTokens || 1024;

        // Check if built-in tools are enabled
        const hasBuiltInTools = options?.enableUrlContext || options?.enableGoogleSearch;

        // Build tools array based on options
        const tools: Array<Record<string, unknown>> = [];
        if (options?.enableUrlContext) {
            tools.push({ url_context: {} });
        }
        if (options?.enableGoogleSearch) {
            tools.push({ google_search: {} });
        }

        // IMPORTANT: Gemini API limitation - cannot mix built-in tools with function calling
        // When built-in tools are enabled, we use pre-search approach instead of function calling
        // Only add memory search function tool if NO built-in tools are enabled
        const useMemoryFunctionCalling = options?.enableSupermemorySearch && !hasBuiltInTools;
        if (useMemoryFunctionCalling) {
            tools.push(getMemorySearchTool());
        }

        // If memory search is enabled WITH built-in tools, do a pre-search and add to prompt
        let enrichedPrompt = prompt;
        if (options?.enableSupermemorySearch && hasBuiltInTools) {
            log.info('Using pre-search for memories (built-in tools detected)');
            const searchResult = await searchMemories({
                query: prompt,
                limit: 5,
                threshold: 0.5,
            });

            if (searchResult.success && searchResult.results.length > 0) {
                const memoryContext = formatMemoriesForPrompt(searchResult.results);
                enrichedPrompt = `${prompt}\n${memoryContext}`;
                log.debug('Added memory context via pre-search', {
                    memoryCount: searchResult.results.length,
                });
            }
        }

        // Build initial conversation contents with multimodal support
        const contents: Array<{ role: string; parts: GeminiContentPart[] }> = [{
            role: 'user',
            parts: this.buildRequestParts(enrichedPrompt, options) as GeminiContentPart[],
        }];

        const baseBody = {
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: maxTokens,
                topP: 0.95,
            },
            // Conditionally add tools if any are enabled
            ...(tools.length > 0 && { tools }),
        };

        log.info('Making non-streaming API call', {
            promptLength: enrichedPrompt.length,
            provider: provider.type,
            platform: options?.pageContext?.platform,
            hasAttachment: !!options?.attachment,
            attachmentType: options?.attachment?.mimeType,
            tools: tools.length > 0 ? tools.map(t => Object.keys(t)[0]) : undefined,
            memoryMode: useMemoryFunctionCalling ? 'function-calling' : (options?.enableSupermemorySearch ? 'pre-search' : 'disabled'),
        });

        // Function calling loop - only used when memory function calling is enabled
        // (i.e., no built-in tools are active)
        const MAX_FUNCTION_CALLS = 3;
        let functionCallCount = 0;

        while (functionCallCount < MAX_FUNCTION_CALLS) {
            const response = await fetch(provider.url, {
                method: 'POST',
                headers: provider.headers,
                body: JSON.stringify({ ...baseBody, contents }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                log.error('API error', { status: response.status, error: errorText });
                throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            const candidate = data?.candidates?.[0];

            // Check if the model wants to call a function (only when using function calling mode)
            if (useMemoryFunctionCalling && hasFunctionCall(candidate)) {
                functionCallCount++;
                const functionCall = extractFunctionCall(candidate);

                if (functionCall) {
                    log.info('AI requested memory search', {
                        functionName: functionCall.name,
                        iteration: functionCallCount,
                    });

                    // Execute the memory search
                    const result = await executeMemorySearch(functionCall);

                    // Add model's function call to conversation
                    contents.push({
                        role: 'model',
                        parts: candidate.content?.parts || [],
                    });

                    // Add function response to conversation
                    contents.push({
                        role: 'user',
                        parts: [{
                            functionResponse: {
                                name: functionCall.name,
                                response: { result: result.formattedResult },
                            },
                        }],
                    });

                    log.debug('Added function response to conversation', {
                        resultSuccess: result.success,
                        resultLength: result.formattedResult.length,
                    });

                    // Continue the loop to get the model's final response
                    continue;
                }
            }

            // No function call - extract and return the text response
            const text = candidate?.content?.parts?.[0]?.text;
            if (!text) {
                log.error('No text in response', { data });
                throw new Error('No text generated');
            }

            log.info('Generation complete', {
                textLength: text.length,
                functionCallsUsed: functionCallCount,
            });
            return text;
        }

        // If we exhausted function calls, try one more time without tools
        log.warn('Max function calls reached, making final request without memory tool');
        const finalTools = tools.filter(t => !('function_declarations' in t));
        const finalBody = {
            ...baseBody,
            contents,
            ...(finalTools.length > 0 ? { tools: finalTools } : {}),
        };

        const finalResponse = await fetch(provider.url, {
            method: 'POST',
            headers: provider.headers,
            body: JSON.stringify(finalBody),
        });

        if (!finalResponse.ok) {
            const errorText = await finalResponse.text();
            throw new Error(`Gemini API error: ${finalResponse.status} - ${errorText}`);
        }

        const finalData = await finalResponse.json();
        const text = finalData?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            throw new Error('No text generated after function calls');
        }

        return text;
    }

    /**
     * Streaming generation using Gemini API SSE
     * Supports both Google AI and Vertex AI providers
     * 
     * Note: Function calling with memory search is handled via pre-search in the handler
     * for streaming, since streaming doesn't support the function call-response loop well.
     * For AI-driven memory search, use the non-streaming generate() method.
     * 
     * Returns an async generator that yields text chunks
     */
    async *generateStream(prompt: string, options?: WriterOptions): AsyncGenerator<string, void, unknown> {
        const provider = await this.getProviderInfo();
        const systemPrompt = this.buildSystemPrompt(options);
        const maxTokens = options?.maxTokens || 1024;

        // Build tools array based on options
        // Note: enableSupermemorySearch is handled differently for streaming - 
        // see handler for pre-search implementation
        const tools: Array<Record<string, unknown>> = [];
        if (options?.enableUrlContext) {
            tools.push({ url_context: {} });
        }
        if (options?.enableGoogleSearch) {
            tools.push({ google_search: {} });
        }

        // Build content parts with multimodal support
        const parts = this.buildRequestParts(prompt, options);

        const body = {
            contents: [{
                role: 'user',
                parts,
            }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: maxTokens,
                topP: 0.95,
            },
            // Conditionally add tools if any are enabled
            ...(tools.length > 0 && { tools }),
        };

        log.debug('Starting write stream', {
            promptLength: prompt.length,
            provider: provider.type,
            platform: options?.pageContext?.platform,
            tone: options?.tone,
            hasAttachment: !!options?.attachment,
            attachmentType: options?.attachment?.mimeType,
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
