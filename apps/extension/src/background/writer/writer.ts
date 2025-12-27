/**
 * Writer Client
 * Handles text generation using the modular provider architecture
 * 
 * Supports Google AI, Vertex AI, and OpenAI providers
 * Provider-specific features (Gemini tools, function calling) are handled per-provider
 */

import { getActiveProvider } from '@/utils/credentials';
import { createLogger } from '~logger';
import {
    getProvider,
    streamWithProvider,
    generateWithProvider,
    performWebSearch,
    enrichPromptWithSearch,
} from '../providers';
import {
    getMemorySearchTool,
    hasFunctionCall,
    extractFunctionCall,
    executeMemorySearch,
    type GeminiContentPart,
} from '../supermemory';
import { searchMemories, formatMemoriesForPrompt } from '../supermemory';
import type { WritePageContext, WriteTone } from '@/types';
import { PLATFORM_INSTRUCTIONS, TONE_INSTRUCTIONS } from '@cognito/shared';

const log = createLogger('Writer', 'BACKGROUND');

/**
 * Options for text generation
 */
export interface WriterOptions {
    tone?: WriteTone;
    maxTokens?: number;
    pageContext?: WritePageContext;
    // Gemini Tool options (Only applicable to Gemini)
    enableUrlContext?: boolean;    // Enable URL fetching/analysis tool
    enableGoogleSearch?: boolean;  // Enable Google Search grounding tool
    // Supermemory integration - AI-driven function calling
    enableSupermemorySearch?: boolean; // Enable AI to decide when to search memories
    // Attachment support - multimodal content
    attachment?: {
        base64Data: string;
        mimeType: string;
        fileName: string;
        fileSize: number;
    };
}

// PLATFORM_INSTRUCTIONS and TONE_INSTRUCTIONS are imported from @cognito/shared

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

export class Writer {

    /**
     * Build system prompt with context and tone instructions
     */
    private buildSystemPrompt(options?: WriterOptions): string {
        const platform = options?.pageContext?.platform || 'Web';
        const tone = options?.tone || 'professional';

        const platformInstruction = platform in PLATFORM_INSTRUCTIONS
            ? PLATFORM_INSTRUCTIONS[platform as keyof typeof PLATFORM_INSTRUCTIONS]
            : PLATFORM_INSTRUCTIONS['Web'];
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
     * Build request parts for multimodal content (Gemini format)
     */
    private buildGeminiRequestParts(prompt: string, options?: WriterOptions): GeminiRequestPart[] {
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
     * Build message content for OpenAI (including multimodal)
     * 
     * OpenAI supports:
     * - Images: Use type: 'image_url' with data URL
     * - PDFs: Use type: 'file' with base64 data (Responses API) or inline in prompt
     * 
     * @see https://platform.openai.com/docs/guides/images-vision
     * @see https://platform.openai.com/docs/guides/pdf-files
     */
    private buildOpenAIMessageContent(prompt: string, options?: WriterOptions): any[] {
        const content: any[] = [{ type: 'text', text: prompt }];

        if (options?.attachment) {
            if (options.attachment.mimeType.startsWith('image/')) {
                // Image attachments - use image_url format
                content.push({
                    type: 'image_url',
                    image_url: {
                        url: `data:${options.attachment.mimeType};base64,${options.attachment.base64Data}`
                    }
                });
            } else if (options.attachment.mimeType === 'application/pdf') {
                // PDF attachments - use input_file format
                // Note: This requires the Responses API or Chat Completions with file support
                content.push({
                    type: 'file',
                    file: {
                        filename: options.attachment.fileName,
                        file_data: `data:application/pdf;base64,${options.attachment.base64Data}`
                    }
                });
            }
            // Note: Other file types (text/plain) are not supported by OpenAI
            // They would need to be handled differently (e.g., extract text and include inline)
        }

        return content;
    }

    /**
     * Build message content for Anthropic/Claude (including multimodal)
     * 
     * Claude supports:
     * - Images: Use type: 'image' with base64 source
     * - PDFs: Use type: 'document' with base64 source
     * 
     * @see https://platform.claude.com/docs/en/build-with-claude/vision
     * @see https://platform.claude.com/docs/en/build-with-claude/pdf-support
     */
    private buildAnthropicMessageContent(prompt: string, options?: WriterOptions): any[] {
        const content: any[] = [];

        // Claude best practice: attachments should come before text
        if (options?.attachment) {
            if (options.attachment.mimeType.startsWith('image/')) {
                // Image attachments - use image format with base64 source
                content.push({
                    type: 'image',
                    source: {
                        type: 'base64',
                        media_type: options.attachment.mimeType,
                        data: options.attachment.base64Data
                    }
                });
            } else if (options.attachment.mimeType === 'application/pdf') {
                // PDF attachments - use document format with base64 source
                content.push({
                    type: 'document',
                    source: {
                        type: 'base64',
                        media_type: 'application/pdf',
                        data: options.attachment.base64Data
                    }
                });
            }
            // Note: Other file types (text/plain) are not supported by Claude
        }

        // Add text prompt after attachments
        content.push({ type: 'text', text: prompt });

        return content;
    }

    /**
     * Non-streaming generation
     */
    async generate(prompt: string, options?: WriterOptions): Promise<string> {
        const activeProvider = await getActiveProvider();
        const provider = await getProvider();
        const config = await provider.getConfig(false);
        const systemPrompt = this.buildSystemPrompt(options);
        const maxTokens = options?.maxTokens || 1024;

        // Check if advanced features are enabled (Gemini-only)
        const hasAdvancedFeatures = options?.enableUrlContext ||
            options?.enableGoogleSearch ||
            options?.enableSupermemorySearch ||
            options?.attachment;

        // For simple generation without advanced features, use the provider abstraction
        if (!hasAdvancedFeatures && activeProvider === 'openai') {
            log.info('Using OpenAI provider for simple generation', { model: config.modelName });
            return generateWithProvider(systemPrompt, prompt, {
                maxTokens,
                temperature: 0.7,
                topP: 0.95,
            });
        }

        if (activeProvider === 'openai') {
            // OpenAI Implementation with attachments and web search
            let enrichedPrompt = prompt;

            // Handle web search for OpenAI (using Responses API pre-search)
            if (options?.enableGoogleSearch) {
                log.info('Using OpenAI web search for generation');
                const webSearchResult = await performWebSearch('openai', prompt);
                if (webSearchResult.type === 'presearch' && webSearchResult.result.success) {
                    enrichedPrompt = enrichPromptWithSearch(prompt, webSearchResult.result);
                    log.debug('Enriched prompt with web search results', {
                        citationCount: webSearchResult.result.citations.length,
                    });
                }
            }

            // Note: URL context is NOT available for OpenAI - Gemini-specific feature
            if (options?.enableUrlContext) {
                log.warn('URL context not available for OpenAI provider - feature will be skipped');
            }

            const body = {
                model: config.modelName,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: this.buildOpenAIMessageContent(enrichedPrompt, options) }
                ],
                temperature: 0.7,
                max_completion_tokens: maxTokens,
                top_p: 0.95,
            };

            log.info('Making OpenAI API call', { provider: 'openai', model: config.modelName });

            const response = await fetch(config.url, {
                method: 'POST',
                headers: config.headers,
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        }

        if (activeProvider === 'anthropic') {
            // Anthropic/Claude Implementation with attachments
            log.info('Using Anthropic provider for generation', { model: config.modelName });

            // Note: Anthropic doesn't have built-in web search or URL context
            // If these are enabled, log a warning
            if (options?.enableGoogleSearch) {
                log.warn('Web search not available for Anthropic provider - feature will be skipped');
            }
            if (options?.enableUrlContext) {
                log.warn('URL context not available for Anthropic provider - feature will be skipped');
            }

            const body = {
                model: config.modelName,
                max_tokens: maxTokens,
                system: systemPrompt,
                messages: [
                    { role: 'user', content: this.buildAnthropicMessageContent(prompt, options) }
                ],
                temperature: 0.7,
                top_p: 0.95,
            };

            log.info('Making Anthropic API call', { provider: 'anthropic', model: config.modelName });

            const response = await fetch(config.url, {
                method: 'POST',
                headers: config.headers,
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            // Anthropic returns content as an array of blocks
            const textBlock = data.content?.find((block: any) => block.type === 'text');
            return textBlock?.text || '';
        }

        // Gemini/Vertex Implementation

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
        const useMemoryFunctionCalling = options?.enableSupermemorySearch && !hasBuiltInTools;
        if (useMemoryFunctionCalling) {
            tools.push(getMemorySearchTool());
        }

        // If memory search is enabled WITH built-in tools, pre-search
        let enrichedPrompt = prompt;
        if (options?.enableSupermemorySearch && hasBuiltInTools) {
            const searchResult = await searchMemories({
                query: prompt,
                limit: 5,
                threshold: 0.5,
            });

            if (searchResult.success && searchResult.results.length > 0) {
                const memoryContext = formatMemoriesForPrompt(searchResult.results);
                enrichedPrompt = `${prompt}\n${memoryContext}`;
            }
        }

        const contents: Array<{ role: string; parts: GeminiContentPart[] }> = [{
            role: 'user',
            parts: this.buildGeminiRequestParts(enrichedPrompt, options) as GeminiContentPart[],
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
            ...(tools.length > 0 && { tools }),
        };

        log.info('Making Gemini/Vertex API call', { provider: config.type });

        // Function calling loop
        const MAX_FUNCTION_CALLS = 3;
        let functionCallCount = 0;

        while (functionCallCount < MAX_FUNCTION_CALLS) {
            const response = await fetch(config.url, {
                method: 'POST',
                headers: config.headers,
                body: JSON.stringify({ ...baseBody, contents }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`${config.type} API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            const candidate = data?.candidates?.[0];

            if (useMemoryFunctionCalling && hasFunctionCall(candidate)) {
                functionCallCount++;
                const functionCall = extractFunctionCall(candidate);

                if (functionCall) {
                    const result = await executeMemorySearch(functionCall);

                    contents.push({
                        role: 'model',
                        parts: candidate.content?.parts || [],
                    });

                    contents.push({
                        role: 'user',
                        parts: [{
                            functionResponse: {
                                name: functionCall.name,
                                response: { result: result.formattedResult },
                            },
                        }],
                    });
                    continue;
                }
            }

            const text = candidate?.content?.parts?.[0]?.text;
            if (!text) throw new Error('No text generated');
            return text;
        }

        // Final request without tools
        const finalTools = tools.filter(t => !('function_declarations' in t));
        const finalBody = {
            ...baseBody,
            contents,
            ...(finalTools.length > 0 ? { tools: finalTools } : {}),
        };

        const finalResponse = await fetch(config.url, {
            method: 'POST',
            headers: config.headers,
            body: JSON.stringify(finalBody),
        });

        if (!finalResponse.ok) {
            const errorText = await finalResponse.text();
            throw new Error(`${config.type} API error: ${finalResponse.status} - ${errorText}`);
        }

        const finalData = await finalResponse.json();
        return finalData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    /**
     * Streaming generation
     */
    async *generateStream(prompt: string, options?: WriterOptions): AsyncGenerator<string, void, unknown> {
        const activeProvider = await getActiveProvider();
        const provider = await getProvider();
        const config = await provider.getConfig(true);
        const systemPrompt = this.buildSystemPrompt(options);
        const maxTokens = options?.maxTokens || 1024;

        // Check if advanced features are enabled (Gemini-only)
        const hasAdvancedFeatures = options?.enableUrlContext ||
            options?.enableGoogleSearch ||
            options?.attachment;

        // For simple streaming without advanced features, use the provider abstraction
        if (!hasAdvancedFeatures && activeProvider === 'openai') {
            log.info('Using OpenAI provider for simple streaming', { model: config.modelName });
            yield* streamWithProvider(systemPrompt, prompt, {
                maxTokens,
                temperature: 0.7,
                topP: 0.95,
            });
            return;
        }

        if (activeProvider === 'openai') {
            // OpenAI Streaming with attachments and web search
            let enrichedPrompt = prompt;

            // Handle web search for OpenAI (using Responses API pre-search)
            if (options?.enableGoogleSearch) {
                log.info('Using OpenAI web search for streaming generation');
                const webSearchResult = await performWebSearch('openai', prompt);
                if (webSearchResult.type === 'presearch' && webSearchResult.result.success) {
                    enrichedPrompt = enrichPromptWithSearch(prompt, webSearchResult.result);
                    log.debug('Enriched prompt with web search results', {
                        citationCount: webSearchResult.result.citations.length,
                    });
                }
            }

            // Note: URL context is NOT available for OpenAI - Gemini-specific feature
            if (options?.enableUrlContext) {
                log.warn('URL context not available for OpenAI provider - feature will be skipped');
            }

            const body = {
                model: config.modelName,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: this.buildOpenAIMessageContent(enrichedPrompt, options) }
                ],
                temperature: 0.7,
                max_completion_tokens: maxTokens,
                top_p: 0.95,
                stream: true,
            };

            const response = await fetch(config.url, {
                method: 'POST',
                headers: config.headers,
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response body');

            const decoder = new TextDecoder();
            let buffer = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6).trim();
                            if (data && data !== '[DONE]') {
                                try {
                                    const parsed = JSON.parse(data);
                                    const text = parsed.choices?.[0]?.delta?.content;
                                    if (text) yield text;
                                } catch { }
                            }
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }
            return;
        }

        if (activeProvider === 'anthropic') {
            // Anthropic non-streaming with attachments (send full response when done)
            log.info('Using Anthropic provider for generation', { model: config.modelName });

            // Note: Anthropic doesn't have built-in web search or URL context
            if (options?.enableGoogleSearch) {
                log.warn('Web search not available for Anthropic provider - feature will be skipped');
            }
            if (options?.enableUrlContext) {
                log.warn('URL context not available for Anthropic provider - feature will be skipped');
            }

            const body = {
                model: config.modelName,
                max_tokens: maxTokens,
                system: systemPrompt,
                messages: [
                    { role: 'user', content: this.buildAnthropicMessageContent(prompt, options) }
                ],
                temperature: 0.7,
                top_p: 0.95,
            };

            const response = await fetch(config.url, {
                method: 'POST',
                headers: config.headers,
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            // Anthropic returns content as an array of blocks
            const textBlock = data.content?.find((block: any) => block.type === 'text');
            const fullText = textBlock?.text || '';

            // Yield the full response at once
            if (fullText) yield fullText;
            return;
        }

        // Gemini/Vertex Streaming
        const tools: Array<Record<string, unknown>> = [];
        if (options?.enableUrlContext) tools.push({ url_context: {} });
        if (options?.enableGoogleSearch) tools.push({ google_search: {} });

        const parts = this.buildGeminiRequestParts(prompt, options);

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
            ...(tools.length > 0 && { tools }),
        };

        const response = await fetch(config.url, {
            method: 'POST',
            headers: config.headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`${config.type} API error: ${response.status} - ${errorText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();
                        if (data && data !== '[DONE]') {
                            try {
                                const parsed = JSON.parse(data);
                                const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                                if (text) yield text;
                            } catch { }
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }
}

// Export singleton instance
export const writer = new Writer();

// Backward compatibility aliases
export const geminiWriter = writer;
export const GeminiWriter = Writer;
