/**
 * System Prompt Builder
 * 
 * Builds system prompts for the writer with context awareness,
 * tone instructions, and platform-specific guidance.
 * 
 * @module writer/core/prompts
 */

import { PLATFORM_INSTRUCTIONS, TONE_INSTRUCTIONS } from '@cognito/shared';
import type { WriterOptions } from './types';

/**
 * Builds a system prompt for text generation with context and tone instructions.
 * 
 * The prompt includes:
 * - Platform-specific instructions (Twitter, LinkedIn, email, etc.)
 * - Tone/style guidance (professional, casual, friendly, etc.)
 * - Page context (domain, title, field type)
 * - Attachment-specific instructions for multimodal content
 * 
 * @param {WriterOptions} [options] - Writer configuration options
 * @returns {string} The complete system prompt
 * 
 * @example
 * ```typescript
 * const prompt = buildSystemPrompt({
 *   tone: 'professional',
 *   pageContext: {
 *     platform: 'LinkedIn',
 *     domain: 'linkedin.com',
 *     title: 'My Profile',
 *   },
 * });
 * ```
 */
export function buildSystemPrompt(options?: WriterOptions): string {
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
    const attachmentInstructions = buildAttachmentInstructions(options);

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
 * Builds attachment-specific instructions based on the attachment type.
 * 
 * @param {WriterOptions} [options] - Writer options containing attachment info
 * @returns {string} Attachment instructions or empty string
 * 
 * @internal
 */
function buildAttachmentInstructions(options?: WriterOptions): string {
    if (!options?.attachment) {
        return '';
    }

    const isImage = options.attachment.mimeType.startsWith('image/');

    if (isImage) {
        return `\n\nThe user has attached an image. Analyze it carefully and incorporate what you see into your response. Describe relevant visual elements if they relate to the writing request.`;
    }

    return `\n\nThe user has attached a document. Read and analyze its contents carefully. Use the information from the document to inform your response. You can reference specific details, summarize sections, or build upon the document's content as needed.`;
}

/**
 * Builds a memory-enriched prompt by appending memory context.
 * 
 * @param {string} originalPrompt - The original user prompt
 * @param {string} memoryContext - Formatted memory search results
 * @returns {string} Enriched prompt with memory context
 * 
 * @example
 * ```typescript
 * const enriched = buildMemoryEnrichedPrompt(
 *   "Write about my project",
 *   "Memory 1: Project X is a React app..."
 * );
 * ```
 */
export function buildMemoryEnrichedPrompt(
    originalPrompt: string,
    memoryContext: string
): string {
    return `${originalPrompt}\n\nRelevant context from user's memories:\n${memoryContext}`;
}
