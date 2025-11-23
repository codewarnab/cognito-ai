/**
 * Simple Retrieval Utility
 * Phase 3 of YouTube to Notion Multi-Phase Refactor
 * 
 * NOTE: This is a BACKUP utility. By default, we use FULL transcript with every answer generation
 * because Gemini 2.5 Flash has a 2M token context limit.
 * 
 * This retrieval is only used if explicitly requested or if transcript exceeds extreme length (>100k chars).
 */

import { createLogger } from '~logger';

const log = createLogger('SimpleRetrieval');

/**
 * Retrieval configuration options
 */
export interface RetrievalOptions {
    /** Size of each text window in characters */
    windowSize: number;
    /** Overlap between windows in characters */
    overlap: number;
    /** Number of top-scoring windows to return */
    topK: number;
}

/**
 * Default retrieval options
 * - 4000 char windows (roughly 1000 tokens)
 * - 500 char overlap to avoid cutting mid-context
 * - Top 2-3 windows returned
 */
const DEFAULT_OPTIONS: RetrievalOptions = {
    windowSize: 4000,
    overlap: 500,
    topK: 2
};

/**
 * Retrieve relevant context from transcript using simple keyword-based scoring
 * 
 * NOTE: This is ONLY used as a fallback. Default behavior is to use full transcript.
 * 
 * @param transcript - Full video transcript
 * @param question - Question to find relevant context for
 * @param options - Retrieval configuration
 * @returns Concatenated top-K windows of context
 */
export function retrieveContextFromTranscript(
    transcript: string,
    question: string,
    options: RetrievalOptions = DEFAULT_OPTIONS
): string {
    if (!transcript || transcript.trim().length === 0) {
        log.warn('⚠️ Empty transcript provided for retrieval');
        return '';
    }

    const { windowSize, overlap, topK } = options;

    log.info('🔍 Retrieving context from transcript', {
        transcriptLength: transcript.length,
        windowSize,
        overlap,
        topK,
        question: question.substring(0, 100)
    });

    // Split transcript into overlapping windows
    const windows: Array<{ index: number; text: string; score: number }> = [];

    for (let i = 0; i < transcript.length; i += windowSize - overlap) {
        const end = Math.min(i + windowSize, transcript.length);
        const slice = transcript.slice(i, end);

        windows.push({
            index: i,
            text: slice,
            score: 0
        });

        // Break if we've reached the end
        if (end >= transcript.length) break;
    }

    log.info(`📊 Created ${windows.length} windows from transcript`);

    // Extract keywords from question (simple tokenization)
    const questionTerms = question
        .toLowerCase()
        .split(/\W+/)
        .filter(term => term.length > 2); // Ignore very short words

    log.info(`🔑 Extracted ${questionTerms.length} keywords from question`);

    // Score each window based on keyword matches
    for (const window of windows) {
        const windowLower = window.text.toLowerCase();

        // Count occurrences of each term
        window.score = questionTerms.reduce((score, term) => {
            // Escape regex special characters to prevent errors
            const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Count how many times this term appears in the window
            const matches = (windowLower.match(new RegExp(escapedTerm, 'g')) || []).length;
            return score + matches;
        }, 0);
    }

    // Sort by score (descending) and take top K
    windows.sort((a, b) => b.score - a.score);

    const topWindows = windows.slice(0, Math.max(1, Math.min(topK, windows.length)));

    log.info('✅ Retrieval complete', {
        topWindowsCount: topWindows.length,
        scores: topWindows.map(w => w.score),
        totalLength: topWindows.reduce((sum, w) => sum + w.text.length, 0)
    });

    // Concatenate top windows with separator
    const context = topWindows
        .map(w => w.text)
        .join('\n\n---\n\n');

    return context;
}

/**
 * Determine if retrieval should be used based on transcript length
 * 
 * Current policy: NEVER auto-enable (always use full transcript)
 * Gemini 2.5 Flash supports 2M tokens (~8M characters)
 * 
 * @param transcriptLength - Length of transcript in characters
 * @returns false (always use full transcript)
 */
export function shouldUseRetrieval(transcriptLength: number): boolean {
    // DISABLED: We always use full transcript
    // Gemini 2.5 Flash can handle extremely large contexts (2M tokens)
    // Only enable retrieval if explicitly requested or transcript is absurdly long (>100k chars)

    const threshold = 100000; // 100k characters (very conservative)
    const useRetrieval = transcriptLength > threshold;

    if (useRetrieval) {
        log.warn('⚠️ Transcript exceeds 100k characters - retrieval recommended', {
            transcriptLength,
            threshold
        });
    }

    return useRetrieval;
}

