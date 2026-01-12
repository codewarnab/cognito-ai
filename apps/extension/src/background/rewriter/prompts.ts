/**
 * Rewriter Prompts
 * System prompts and prompt building utilities for the rewriter module
 */

import { PRESET_PROMPTS } from '@cognito/shared';
import type { RewritePreset } from '@/types';

/**
 * System prompt for the rewriter
 * Instructs the AI to rewrite text according to the given instruction
 */
export const REWRITER_SYSTEM_PROMPT = `You are a text rewriting assistant. 
Rewrite the given text according to the instruction.
Output ONLY the rewritten text itself with no preamble, introduction, or meta-commentary.
Do NOT add phrases like "Here is the simpler version", "Here's a friendlier version", etc.
Maintain the same language as the input text.
Start directly with the rewritten content.
CRITICAL: If the input is a question or prompt, rewrite/expand THE QUESTION OR PROMPT ITSELF - do NOT answer it. Your job is to transform text, not to respond to it.

You MAY enhance with markdown formatting when it improves readability:
- Preserve the original text's structure and intent
- Add markdown (bold, lists, code) only if it genuinely improves clarity
- For 'longer' preset: structure with bullets/paragraphs as needed
- For 'simplify' preset: minimal formatting, focus on plain language`;

/**
 * Build the complete rewrite instruction from preset or custom instruction
 */
export function buildRewriteInstruction(preset?: RewritePreset, instruction?: string): string {
    if (preset) {
        return PRESET_PROMPTS[preset];
    }
    return instruction || 'Improve this text';
}

/**
 * Build the user prompt for rewriting
 */
export function buildUserPrompt(text: string, rewriteInstruction: string): string {
    return `${rewriteInstruction}\n\nText to rewrite:\n${text}`;
}

/**
 * Calculate appropriate max tokens based on input length
 */
export function calculateMaxTokens(textLength: number, multiplier: number = 2, minimum: number = 500): number {
    return Math.max(textLength * multiplier, minimum);
}
