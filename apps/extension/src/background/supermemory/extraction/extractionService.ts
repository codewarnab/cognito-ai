/**
 * Memory Extraction Service
 * Uses Gemini function calling to extract facts from conversations
 * Follows the same provider selection pattern as geminiWriter/geminiRewriter
 */

import { createLogger } from '~logger';
import {
  getGoogleApiKey,
  getVertexCredentials,
  hasGoogleApiKey,
  hasVertexCredentials,
} from '@/utils/credentials';
import { GEMINI_MODELS } from '~/constants';
import { generateVertexAccessToken } from '../../summarizer/vertexAuth';
import { EXTRACTION_SYSTEM_PROMPT, buildExtractionPrompt } from './prompt';
import { getExtractionTool, parseExtractFactsParams, EXTRACT_FACTS_FUNCTION } from './functionDeclaration';
import type { ChatMessage } from '~/types/database/schema';
import type { ExtractedFact, ExtractionResult } from './types';

const log = createLogger('MemoryExtraction', 'BACKGROUND');

/**
 * Provider configuration for API calls
 */
interface ProviderInfo {
  type: 'google' | 'vertex';
  url: string;
  headers: Record<string, string>;
}

/**
 * Memory Extraction Service
 * Extracts facts from conversations using Gemini function calling
 */
class MemoryExtractionService {
  // Use Flash model for cost-effective extraction
  private model = GEMINI_MODELS.FLASH;

  // Gemini API (Google AI) base URL - preferred when API key is available
  private googleBaseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  // Vertex AI base URL template
  private vertexBaseUrlTemplate = 'https://{location}-aiplatform.googleapis.com/v1';

  /**
   * Get provider info for API calls
   * Priority: Google AI (API key) > Vertex AI (service account)
   *
   * Follows same pattern as geminiWriter.ts and geminiRewriter.ts
   */
  private async getProviderInfo(): Promise<ProviderInfo> {
    // Check Google AI first (preferred)
    if (await hasGoogleApiKey()) {
      const apiKey = await getGoogleApiKey();
      log.debug('Using Google AI (Gemini API) provider for extraction');
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

      log.debug('Using Vertex AI provider for extraction', { location: credentials.location });
      return {
        type: 'vertex',
        url: `${vertexBaseUrl}/projects/${credentials.projectId}/locations/${credentials.location}/publishers/google/models/${this.model}:generateContent`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      };
    }

    throw new Error('No AI provider configured for memory extraction');
  }

  /**
   * Extract facts from a thread's messages using Gemini function calling
   */
  async extractFactsFromMessages(
    threadId: string,
    messages: ChatMessage[]
  ): Promise<ExtractionResult> {
    log.info('Starting fact extraction', { threadId, messageCount: messages.length });

    const provider = await this.getProviderInfo();
    const prompt = buildExtractionPrompt(messages);
    const contentHash = this.generateContentHash(messages);

    // Build request with function calling tool
    const requestBody = {
      systemInstruction: { parts: [{ text: EXTRACTION_SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [getExtractionTool()],
      toolConfig: {
        functionCallingConfig: {
          mode: 'ANY', // Force function calling
          allowedFunctionNames: [EXTRACT_FACTS_FUNCTION.name],
        },
      },
      generationConfig: {
        temperature: 0.3, // Low temperature for consistent extraction
        maxOutputTokens: 4096,
      },
    };

    log.debug('Making extraction API call', {
      provider: provider.type,
      messageCount: messages.length,
      promptLength: prompt.length,
    });

    try {
      const response = await fetch(provider.url, {
        method: 'POST',
        headers: provider.headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        log.error('Extraction API error', { status: response.status, error: errorText });
        throw new Error(
          `${provider.type === 'google' ? 'Gemini' : 'Vertex'} API error: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      const candidate = data?.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      // Look for function call in response
      const functionCallPart = parts.find((p: Record<string, unknown>) => p.functionCall);

      if (!functionCallPart?.functionCall) {
        // No function call - check for text response (fallback)
        const textPart = parts.find((p: Record<string, unknown>) => p.text);
        if (textPart?.text) {
          log.warn('Model returned text instead of function call, attempting JSON parse', { threadId });
          try {
            const parsed = JSON.parse(textPart.text as string);
            const facts = (parsed.facts || []) as ExtractedFact[];
            return {
              threadId,
              facts: facts.filter(f => f.content && f.confidence !== 'low'),
              processedAt: Date.now(),
              messageCount: messages.length,
              contentHash,
            };
          } catch {
            log.warn('Could not parse text response as JSON', { threadId });
          }
        }

        log.info('No facts extracted (no function call)', { threadId });
        return { threadId, facts: [], processedAt: Date.now(), messageCount: messages.length, contentHash };
      }

      // Parse function call arguments
      const functionCall = functionCallPart.functionCall as { name: string; args: unknown };

      if (functionCall.name !== EXTRACT_FACTS_FUNCTION.name) {
        log.warn('Unexpected function call', { name: functionCall.name, threadId });
        return { threadId, facts: [], processedAt: Date.now(), messageCount: messages.length, contentHash };
      }

      const params = parseExtractFactsParams(functionCall.args);

      if (!params) {
        log.warn('Invalid function call parameters', { args: functionCall.args, threadId });
        return { threadId, facts: [], processedAt: Date.now(), messageCount: messages.length, contentHash };
      }

      const facts: ExtractedFact[] = params.facts;

      log.info('Extraction complete', {
        threadId,
        factsCount: facts.length,
        categories: facts.map(f => f.category),
      });

      return {
        threadId,
        facts,
        processedAt: Date.now(),
        messageCount: messages.length,
        contentHash,
      };
    } catch (error) {
      log.error('Extraction failed', {
        threadId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      throw error;
    }
  }

  /**
   * Generate a hash of message content to detect changes
   */
  private generateContentHash(messages: ChatMessage[]): string {
    const content = messages
      .map(m =>
        m.message.parts
          .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
          .map(p => p.text)
          .join('')
      )
      .join('|');

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}

// Export singleton instance
export const memoryExtractionService = new MemoryExtractionService();

// Export convenience function
export async function extractFactsFromMessages(
  threadId: string,
  messages: ChatMessage[]
): Promise<ExtractionResult> {
  return memoryExtractionService.extractFactsFromMessages(threadId, messages);
}
