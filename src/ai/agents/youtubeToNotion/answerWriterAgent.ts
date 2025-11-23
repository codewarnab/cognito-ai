/**
 * Answer Writer Agent (Phase 3)
 * Generates detailed answers for individual questions using full transcript
 * Uses Gemini structured output for guaranteed JSON parsing
 * 
 * NO RETRIEVAL/SPLITTING - Uses full transcript every time (Gemini 2.5 Flash has ~1M token context window)
 */

import { createRetryManager } from '../../../errors/retryManager';
import { createLogger } from '~logger';
import { initializeGenAIClient } from '../../core/genAIFactory';
import type { VideoNotesTemplate } from './types';
import { progressStore } from './progressStore';

const log = createLogger('AnswerWriterAgent');

/**
 * Answer item returned by the writer
 * Matches NestedPage contract from types.ts
 */
export interface AnswerItem {
    /** Section title */
    title: string;
    /** Detailed content in Notion Markdown format */
    content: string;
}

/**
 * JSON schema for structured output
 * Ensures LLM returns valid JSON without manual parsing
 */
const answerSchema = {
    type: 'object',
    properties: {
        title: {
            type: 'string',
            description: 'Section title for the Notion page'
        },
        content: {
            type: 'string',
            description: 'Detailed content in Notion Markdown format (use # for headings, - for lists, `` for code)'
        }
    },
    required: ['title', 'content']
};

/**
 * Minimum content length in characters (~200 words heuristic)
 * If content is shorter, a warning will be logged
 */
const MIN_CONTENT_LENGTH = 1000;

/**
 * Write a detailed answer for a single question
 * Always uses the FULL transcript (no splitting/retrieval)
 * 
 * @param params - Answer generation parameters
 * @returns Answer with title and content
 * @throws Error if generation fails after retries
 */
export async function writeAnswer(params: {
    /** Question title for the Notion page */
    title: string;
    /** Analysis question to guide content generation */
    question: string;
    /** Full video transcript (always complete, never split) */
    transcript: string;
    /** Template defining structure and style */
    template: VideoNotesTemplate;
    /** Video title for context */
    videoTitle: string;
    /** Video URL for reference */
    videoUrl: string;
}): Promise<AnswerItem> {
    const { title, question, transcript, template, videoTitle, videoUrl } = params;

    // Initialize Gemini client
    const client = await initializeGenAIClient();

    log.info(`✍️ Writing answer for: "${title}"`, {
        transcriptLength: transcript.length,
        templateFormat: template.format
    });

    // Progress: Start writing answer
    const answerStepId = progressStore.add({
        title: `Writing: "${title}"`,
        status: 'active',
        type: 'info'
    });

    // Build comprehensive prompt
    const prompt = buildPrompt({
        title,
        question,
        transcript,
        template,
        videoTitle,
        videoUrl
    });

    // Create retry manager with aggressive retry policy (20 retries)
    const retry = createRetryManager({
        maxRetries: 20,
        initialDelay: 2000,
        maxDelay: 60000,
        backoffMultiplier: 1.5,
        useJitter: true
    });

    // Execute with retries
    const response = await retry.execute(async () => {
        return await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                temperature: 0.6, // Balance between creativity and groundedness
                maxOutputTokens: 16384, // Allow for extremely detailed answers
                responseMimeType: 'application/json',
                responseSchema: answerSchema
            }
        });
    });

    // Parse structured output
    const text = response.text || '{}';
    try {
        const parsed = JSON.parse(text);
        const answer: AnswerItem = {
            title: parsed.title || title,
            content: parsed.content || ''
        };

        // Validate content length
        if (answer.content.length < MIN_CONTENT_LENGTH) {
            log.warn('⚠️ Answer content is shorter than expected', {
                title,
                length: answer.content.length,
                minRequired: MIN_CONTENT_LENGTH
            });

            // This is logged but not thrown - caller can decide to retry if needed
            // Throwing here would trigger the retry manager, but we want caller control
        }

        log.info('✅ Answer written successfully', {
            title,
            contentLength: answer.content.length,
            wordCount: Math.floor(answer.content.split(/\s+/).length)
        });

        // Progress: Answer writing complete
        progressStore.update(answerStepId, {
            title: `Completed: "${title}"`,
            status: 'complete'
        });

        return answer;
    } catch (error) {
        log.error('❌ Failed to parse answer response', error);
        throw new Error(
            `Answer generation failed for "${title}": invalid response format. ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

/**
 * Build the prompt for answer generation
 * Uses full transcript context - no splitting/retrieval
 */
function buildPrompt(params: {
    title: string;
    question: string;
    transcript: string;
    template: VideoNotesTemplate;
    videoTitle: string;
    videoUrl: string;
}): string {
    const { title, question, transcript, template, videoTitle, videoUrl } = params;

    return `You are generating ONE detailed section for Notion notes based on a YouTube video transcript.

**Video Information:**
- Title: ${videoTitle}
- URL: ${videoUrl}
- Template: ${template.name} (${template.format} format)

**Section to Generate:**
- Title: "${title}"
- Focus Question: ${question}

**Your Task:**
1. Write a thorough, self-contained answer (minimum 1000 characters, aim for detailed coverage)
2. Ground your answer ONLY in the provided transcript - do not add external facts or hallucinate
3. Use Notion Markdown format:
   - Headings with # (e.g., # Main Point, ## Sub Point)
   - Lists with - for bullets
   - Code blocks with \`\`\`language for code
   - Bold with **text**, italic with *text*
   - Links with [text](url)
4. Be specific and cite relevant details from the transcript
5. Structure the content logically with clear headings and sections
6. Include examples, quotes, or specific details from the video when relevant

**Format Guidelines for ${template.format}:**
${getFormatGuidelines(template)}

**Full Video Transcript:**
${transcript}

**Important:** Generate ONLY content that directly answers the focus question based on what's actually discussed in the transcript. Do not speculate or add information not present in the source material.`;
}

/**
 * Get format-specific guidelines based on template type
 */
function getFormatGuidelines(template: VideoNotesTemplate): string {
    switch (template.format) {
        case 'Q&A':
            return `- Start with a direct answer to the question
- Provide supporting details and explanations
- Include relevant examples or context from the video
- End with key takeaways or implications`;

        case 'Step-by-Step':
            return `- Break down the process into clear, numbered steps
- Explain what happens in each step and why
- Include any tips, warnings, or best practices mentioned
- Use code blocks or examples where applicable`;

        case 'Insights':
            return `- Present the main insight or concept clearly
- Explain the reasoning or evidence behind it
- Discuss implications or applications
- Connect to broader themes or related topics`;

        case 'Mixed':
            return `- Adapt structure to the content type
- Use appropriate headings and organization
- Balance explanation with examples
- Make content scannable with clear sections`;

        default:
            return `- Structure content clearly with headings
- Use bullet points for lists and key facts
- Include examples and details from the video
- Make the content comprehensive yet readable`;
    }
}

