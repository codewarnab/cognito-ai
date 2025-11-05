/**
 * Token usage tracking types for context limit indicator
 * Extends AI SDK's LanguageModelUsage with context limit information
 */

import type { LanguageModelUsage } from 'ai';

/**
 * Extended usage information including context limits
 * 
 * Inherits from AI SDK LanguageModelUsage:
 * - inputTokens: number | undefined
 * - outputTokens: number | undefined  
 * - totalTokens: number | undefined
 * - reasoningTokens?: number | undefined
 * - cachedInputTokens?: number | undefined
 */
export interface AppUsage extends LanguageModelUsage {
    /**
     * Context window information for the model
     */
    context?: {
        /** Maximum input tokens allowed */
        inputMax?: number;
        /** Maximum output tokens allowed */
        outputMax?: number;
        /** Combined max (if input + output share a combined limit) */
        combinedMax?: number;
        /** Total context window size */
        totalMax?: number;
    };

    /**
     * Model identifier (e.g., "gemini-2.5-flash")
     * Useful for showing which model consumed the tokens
     */
    modelId?: string;
}

/**
 * Basic token usage information
 */
export interface TokenUsage {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
}

/**
 * Aggregate usage statistics over time periods
 */
export interface UsageStats {
    today: TokenUsage;
    thisWeek: TokenUsage;
    thisMonth: TokenUsage;
    total: TokenUsage;
}

/**
 * Usage limit configurations
 */
export interface UsageLimits {
    maxTokensPerDay?: number;
    maxTokensPerWeek?: number;
    maxTokensPerMonth?: number;
    maxCostPerMonth?: number;
}

/**
 * Get context limits for a specific Gemini model
 */
export function getContextLimits(modelId: string): AppUsage['context'] {
    switch (modelId) {
        case 'gemini-2.5-flash':
        case 'gemini-2.5-flash-lite':
        case 'gemini-2.5-flash-image':
            return {
                totalMax: 2_000_000, // 2M tokens
                inputMax: 2_000_000,
                outputMax: 8192
            };

        case 'gemini-2.5-pro':
            return {
                totalMax: 2_000_000, // 2M tokens
                inputMax: 2_000_000,
                outputMax: 8192
            };

        case 'gemini-1.5-flash':
            return {
                totalMax: 1_000_000, // 1M tokens
                inputMax: 1_000_000,
                outputMax: 8192
            };

        case 'gemini-1.5-pro':
            return {
                totalMax: 2_000_000, // 2M tokens
                inputMax: 2_000_000,
                outputMax: 8192
            };

        default:
            // Default to Gemini 2.5 Flash limits
            return {
                totalMax: 2_000_000,
                inputMax: 2_000_000,
                outputMax: 8192
            };
    }
}
