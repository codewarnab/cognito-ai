/**
 * Summarizer Client
 * Handles text summarization using the modular provider architecture
 * 
 * Supports Google AI, Vertex AI, and OpenAI providers
 * Includes caching to avoid re-summarizing identical text selections
 */

import { createLogger } from '~logger';
import { LRUCache } from '~/utils/cache/LRUCache';
import { streamWithProvider, getProvider } from '../providers';
import { SUMMARY_TYPE_INSTRUCTIONS, SUMMARY_LENGTH_TOKENS } from '@cognito/shared';

const log = createLogger('Summarizer', 'BACKGROUND');

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

// ============================================================================
// Prompt Building
// ============================================================================

const FORMAT_INSTRUCTIONS: Record<string, string> = {
    'key-points': 'Use bullet points (- item) for each key point',
    'tl-dr': 'Use **bold** for key terms, keep mostly plain text',
    'headline': 'Plain text, single line only',
    'teaser': 'Use *italics* for emphasis if needed',
};

/**
 * Build system prompt for summarization
 */
function buildSystemPrompt(options: SummarizerOptions): string {
    const typeInstruction = SUMMARY_TYPE_INSTRUCTIONS[options.summaryType] || SUMMARY_TYPE_INSTRUCTIONS['tl-dr'];

    let contextInfo = '';
    if (options.pageContext) {
        contextInfo = `\n\nContext: This text was selected from "${options.pageContext.title}" (${options.pageContext.domain}).`;
    }

    const formatInstruction = FORMAT_INSTRUCTIONS[options.summaryType] || FORMAT_INSTRUCTIONS['tl-dr'];

    return `You are a helpful text summarizer. Your task is to summarize the selected text clearly and concisely.

${typeInstruction}${contextInfo}

Important:
- Focus only on the selected text
- Be accurate and don't add information not present in the text
- Use clear, easy-to-understand language
- Format: ${formatInstruction}`;
}

// ============================================================================
// Summarizer Class
// ============================================================================

export class Summarizer {
    /**
     * Streaming summarization
     * Uses the active provider (Google AI, Vertex AI, or OpenAI)
     */
    async *summarizeStream(
        text: string,
        options: SummarizerOptions
    ): AsyncGenerator<string, void, unknown> {
        const systemPrompt = buildSystemPrompt(options);
        const userPrompt = `Please summarize the following text:\n\n${text}`;
        const maxTokens = SUMMARY_LENGTH_TOKENS[options.summaryLength] || 250;

        // Get active provider for logging
        const provider = await getProvider();
        log.debug('Starting summary stream', {
            textLength: text.length,
            provider: provider.type,
            options
        });

        // Use the provider abstraction for streaming
        yield* streamWithProvider(systemPrompt, userPrompt, {
            maxTokens,
            temperature: 0.3,
            topP: 0.9,
        });
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

// Export singleton instance
export const summarizer = new Summarizer();

// Backward compatibility aliases
export const geminiSummarizer = summarizer;
export const GeminiSummarizer = Summarizer;
