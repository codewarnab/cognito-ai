/**
 * Gemini Asker Client
 * Handles Q&A generation using Gemini API with gemini-2.5-flash model
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
import {
    getMemorySearchTool,
    hasFunctionCall,
    extractFunctionCall,
    executeMemorySearch,
    type GeminiContentPart,
} from '../supermemory';
import { searchMemories, formatMemoriesForPrompt } from '../supermemory';
import type { AskPageContext, AskMessage, AskAttachmentPayload } from '@/types';

const log = createLogger('GeminiAsker', 'BACKGROUND');

/**
 * Options for answer generation
 */
export interface AskerOptions {
    maxTokens?: number;
    pageContext?: AskPageContext;
    conversationHistory?: AskMessage[];
    enableUrlContext?: boolean;
    enableGoogleSearch?: boolean;
    enableSupermemorySearch?: boolean;
    attachment?: AskAttachmentPayload;
}

/**
 * Provider configuration
 */
interface ProviderInfo {
    type: 'google' | 'vertex';
    url: string;
    headers: Record<string, string>;
}

export class GeminiAsker {
    // Use FLASH model for better reasoning (not LITE)
    private model = GEMINI_MODELS.FLASH;

    private googleBaseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    private vertexBaseUrlTemplate = 'https://{location}-aiplatform.googleapis.com/v1';

    /**
     * Get provider info for API calls
     */
    private async getProviderInfo(): Promise<ProviderInfo> {
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

        throw new Error('No AI provider configured. Please add your Google API key or Vertex AI credentials in settings.');
    }

    /**
     * Build system prompt for Q&A
     */
    private buildSystemPrompt(options?: AskerOptions): string {
        let contextInfo = '';
        
        if (options?.pageContext) {
            contextInfo = `\n\nCurrent Page Context:
- URL: ${options.pageContext.url}
- Title: ${options.pageContext.title}
- Domain: ${options.pageContext.domain}`;

            if (options.pageContext.metaDescription) {
                contextInfo += `\n- Description: ${options.pageContext.metaDescription}`;
            }

            if (options.pageContext.selectedText) {
                contextInfo += `\n\nUser's Selected Text:\n"${options.pageContext.selectedText}"`;
            }

            if (options.pageContext.visibleContent) {
                contextInfo += `\n\nPage Content (excerpt):\n${options.pageContext.visibleContent}`;
            }
        }

        let attachmentInstructions = '';
        if (options?.attachment) {
            const isImage = options.attachment.mimeType.startsWith('image/');
            attachmentInstructions = isImage
                ? `\n\nThe user has attached an image. Analyze it carefully and incorporate your observations into your answer.`
                : `\n\nThe user has attached a document. Read and analyze its contents carefully. Use the information from the document to inform your answer.`;
        }

        return `You are a helpful AI assistant integrated into a Chrome extension. The user is asking questions while browsing the web.
${contextInfo}

Guidelines:
- Be accurate and helpful - this is Q&A, not content generation
- Use the page context when relevant to the question
- If the user selected text, it's likely related to their question
- Support follow-up questions by maintaining conversation context
- Use markdown formatting for better readability (headers, lists, code blocks)
- Cite sources when using external information
- Be concise but thorough - adjust length based on question complexity
- If you're unsure about something, say so
- For code questions, provide working examples with explanations${attachmentInstructions}`;
    }

    /**
     * Build conversation contents from history
     */
    private buildConversationContents(
        question: string,
        options?: AskerOptions
    ): Array<{ role: string; parts: GeminiContentPart[] }> {
        const contents: Array<{ role: string; parts: GeminiContentPart[] }> = [];

        // Add conversation history
        if (options?.conversationHistory) {
            for (const msg of options.conversationHistory) {
                const parts: GeminiContentPart[] = [];
                
                // Add attachment if present (for user messages)
                if (msg.role === 'user' && msg.attachment) {
                    parts.push({
                        inlineData: {
                            mimeType: msg.attachment.mimeType,
                            data: msg.attachment.base64Data,
                        },
                    });
                }
                
                parts.push({ text: msg.content });
                
                contents.push({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts,
                });
            }
        }

        // Add current question with attachment if present
        const currentParts: GeminiContentPart[] = [];
        
        if (options?.attachment) {
            currentParts.push({
                inlineData: {
                    mimeType: options.attachment.mimeType,
                    data: options.attachment.base64Data,
                },
            });
        }
        
        currentParts.push({ text: question });
        
        contents.push({
            role: 'user',
            parts: currentParts,
        });

        return contents;
    }

    /**
     * Non-streaming generation with function calling
     */
    async generateAnswer(question: string, options?: AskerOptions): Promise<string> {
        const provider = await this.getProviderInfo();
        const systemPrompt = this.buildSystemPrompt(options);
        const maxTokens = options?.maxTokens || 2048;

        const hasBuiltInTools = options?.enableUrlContext || options?.enableGoogleSearch;

        const tools: Array<Record<string, unknown>> = [];
        if (options?.enableUrlContext) {
            tools.push({ url_context: {} });
        }
        if (options?.enableGoogleSearch) {
            tools.push({ google_search: {} });
        }

        const useMemoryFunctionCalling = options?.enableSupermemorySearch && !hasBuiltInTools;
        if (useMemoryFunctionCalling) {
            tools.push(getMemorySearchTool());
        }

        let enrichedQuestion = question;
        if (options?.enableSupermemorySearch && hasBuiltInTools) {
            log.info('Using pre-search for memories (built-in tools detected)');
            try {
                const searchResult = await searchMemories({
                    query: question,
                    limit: 5,
                    threshold: 0.5,
                });

                if (searchResult.success && searchResult.results.length > 0) {
                    const memoryContext = formatMemoriesForPrompt(searchResult.results);
                    enrichedQuestion = `${question}\n${memoryContext}`;
                }
            } catch (err) {
                log.warn('Memory pre-search failed, continuing without memories', err);
            }
        }

        const contents = this.buildConversationContents(enrichedQuestion, options);

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

        log.info('Making ask request', {
            questionLength: enrichedQuestion.length,
            provider: provider.type,
            historyLength: options?.conversationHistory?.length || 0,
            hasAttachment: !!options?.attachment,
            tools: tools.length > 0 ? tools.map(t => Object.keys(t)[0]) : undefined,
        });

        // Function calling loop
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

            if (useMemoryFunctionCalling && hasFunctionCall(candidate)) {
                functionCallCount++;
                const functionCall = extractFunctionCall(candidate);

                if (functionCall) {
                    log.info('AI requested memory search', {
                        functionName: functionCall.name,
                        iteration: functionCallCount,
                    });

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
            if (!text) {
                log.error('No text in response', { data });
                throw new Error('No answer generated');
            }

            log.info('Answer generated', {
                textLength: text.length,
                functionCallsUsed: functionCallCount,
            });
            return text;
        }

        // Fallback if max function calls reached
        log.warn('Max function calls reached, making final request');
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
            throw new Error('No answer generated after function calls');
        }

        return text;
    }
}

export const geminiAsker = new GeminiAsker();
