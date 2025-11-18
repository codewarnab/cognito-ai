/**
 * Question Planner Agent
 * Phase 2 of YouTube to Notion Multi-Phase Refactor
 * 
 * This agent:
 * - Uses Gemini 2.5 Flash with structured output mode for guaranteed JSON parsing
 * - Generates 6-10 unique, template-aware section questions from video transcript
 * - Enforces minimum 4 questions requirement
 * - De-duplicates questions (case-insensitive title matching)
 * - Validates template compliance (Q&A format for lectures, Step-by-Step for tutorials, etc.)
 * - Uses aggressive retry policy (20 retries) for AI model overload handling
 */

import { createRetryManager } from '../../../errors/retryManager';
import { createLogger } from '../../../logger';
import { initializeGenAIClient } from '../../core/genAIFactory';
import type { VideoNotesTemplate } from './types';

const log = createLogger('QuestionPlannerAgent');

/**
 * Question item structure
 */
export interface QuestionItem {
    /** Final Notion page title (template-shaped, e.g., "What is X?" or "Step 1: Setup") */
    title: string;
    /** Analysis question the writer will use to generate content */
    question: string;
}

/**
 * Input parameters for question planning
 */
export interface PlanQuestionsInput {
    /** Full video transcript */
    transcript: string;
    /** Video title */
    videoTitle: string;
    /** YouTube video URL */
    videoUrl: string;
    /** Template to use for structuring questions */
    template: VideoNotesTemplate;
    /** Minimum number of questions (default: 6) */
    min?: number;
    /** Maximum number of questions (default: 10) */
    max?: number;
}

/**
 * JSON schema for structured output
 * Gemini will be forced to return JSON matching this schema
 */
const questionSchema = {
    type: 'object',
    properties: {
        questions: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: {
                        type: 'string',
                        description: 'Section title for the Notion page (must follow template format)'
                    },
                    question: {
                        type: 'string',
                        description: 'Question to guide content generation for this section'
                    }
                },
                required: ['title', 'question']
            }
        }
    },
    required: ['questions']
};

/**
 * Plan questions for video notes
 * 
 * Generates 6-10 unique, template-aware section questions from the video transcript.
 * Uses Gemini's structured output mode to guarantee valid JSON parsing.
 * 
 * @param params - Planning parameters
 * @returns Array of question items with titles and questions
 * @throws Error if planning fails or produces insufficient questions
 */
export async function planQuestions(params: PlanQuestionsInput): Promise<QuestionItem[]> {
    const { transcript, videoTitle, videoUrl, template } = params;
    const min = params.min ?? 6;
    const max = params.max ?? 10;

    log.info('🧠 Starting question planning', {
        videoTitle,
        templateType: template.type,
        templateFormat: template.format,
        transcriptLength: transcript.length,
        targetRange: `${min}-${max} questions`
    });

    // Initialize Gen AI client
    const client = await initializeGenAIClient();

    // Calculate target min/max based on template constraints
    const targetMin = Math.max(template.sectionGuidelines.minSections, min);
    const targetMax = Math.min(template.sectionGuidelines.maxSections, max);

    log.info('📊 Question targets calculated', {
        requestedMin: min,
        requestedMax: max,
        templateMin: template.sectionGuidelines.minSections,
        templateMax: template.sectionGuidelines.maxSections,
        finalMin: targetMin,
        finalMax: targetMax
    });

    // Build the prompt
    const prompt = buildPlanningPrompt({
        transcript,
        videoTitle,
        videoUrl,
        template,
        targetMin,
        targetMax
    });

    // Create retry manager with aggressive policy for AI model overload
    const retry = createRetryManager({
        maxRetries: 20,
        initialDelay: 2000,
        maxDelay: 60000,
        backoffMultiplier: 1.5,
        useJitter: true,
        onRetry: (attempt, delay, error) => {
            log.warn(`⚠️ Question planning failed (attempt ${attempt}/20), retrying in ${Math.round(delay / 1000)}s...`, {
                error: error.message
            });
        },
        shouldRetry: (error) => {
            // Retry on overload errors (503) and other transient errors
            const errorMsg = error.message.toLowerCase();
            return (
                errorMsg.includes('overload') ||
                errorMsg.includes('503') ||
                errorMsg.includes('unavailable') ||
                errorMsg.includes('rate limit') ||
                errorMsg.includes('timeout')
            );
        }
    });

    log.info('📤 Sending planning request to Gemini with structured output mode');

    // Generate content using structured output mode
    const response = await retry.execute(async () => {
        return await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                temperature: 0.5, // Lower temperature for more consistent planning
                maxOutputTokens: 2048,
                responseMimeType: 'application/json',
                responseSchema: questionSchema
            }
        });
    });

    const text = response.text || '{}';
    log.info('✅ Received response from Gemini', {
        responseLength: text.length
    });

    // Parse and validate response
    try {
        const parsed = JSON.parse(text);
        const list = Array.isArray(parsed.questions) ? parsed.questions : [];

        log.info('📋 Parsed questions from response', {
            count: list.length
        });

        // De-duplicate by title (case-insensitive)
        const seenTitles = new Set<string>();
        const items: QuestionItem[] = list
            .filter((q: any) => {
                // Validate structure
                if (!q || !q.title || !q.question) {
                    log.warn('⚠️ Invalid question structure detected, skipping', { question: q });
                    return false;
                }

                // Check for duplicates
                const titleLower = q.title.toLowerCase().trim();
                if (seenTitles.has(titleLower)) {
                    log.warn('🔄 Duplicate title detected, skipping', { title: q.title });
                    return false;
                }

                seenTitles.add(titleLower);
                return true;
            })
            .slice(0, targetMax); // Ensure we don't exceed maximum

        // Validate template compliance
        validateTemplateCompliance(items, template);

        // Check minimum requirement
        if (items.length < targetMin) {
            log.error('❌ Insufficient questions planned', {
                planned: items.length,
                required: targetMin,
                questions: items.map(q => q.title)
            });
            throw new Error(
                `Question planning produced only ${items.length} questions (minimum ${targetMin} required)`
            );
        }

        log.info('✅ Question planning completed successfully', {
            count: items.length,
            min: targetMin,
            max: targetMax,
            titles: items.map(q => q.title)
        });

        return items;
    } catch (e) {
        log.error('❌ Failed to parse planner response', {
            error: e,
            responseText: text.substring(0, 500)
        });
        throw new Error(`Question planning failed: ${e instanceof Error ? e.message : 'invalid response format'}`);
    }
}

/**
 * Build the planning prompt
 */
function buildPlanningPrompt(params: {
    transcript: string;
    videoTitle: string;
    videoUrl: string;
    template: VideoNotesTemplate;
    targetMin: number;
    targetMax: number;
}): string {
    const { transcript, videoTitle, videoUrl, template, targetMin, targetMax } = params;

    // Truncate transcript for planning (first 8000 chars should be sufficient for topic identification)
    const transcriptForPlanning = transcript.length > 8000
        ? transcript.slice(0, 8000) + '\n\n[Transcript truncated for planning...]'
        : transcript;

    return `You are planning sections for Notion notes based on a YouTube video transcript.

Video Title: ${videoTitle}
Video URL: ${videoUrl}
Template Type: ${template.name} (${template.format})

# YOUR TASK
Generate ${targetMin}-${targetMax} UNIQUE sections based on the transcript content.

# CRITICAL RULES FOR "${template.format}" FORMAT

${getFormatSpecificRules(template)}

# SECTION GUIDELINES
Based on the "${template.name}" template, consider these section types:
${template.sectionGuidelines.sectionTypes.map(t => `• ${t}`).join('\n')}

# EXAMPLE TITLES FOR THIS TEMPLATE
${template.exampleTitles.slice(0, 3).map(t => `• "${t}"`).join('\n')}

# REQUIREMENTS
1. Generate ${targetMin}-${targetMax} sections
2. Each section MUST be UNIQUE (no duplicates)
3. Each section MUST cover a DISTINCT topic from the transcript
4. Base sections ONLY on content actually present in the transcript
5. Titles MUST follow the "${template.format}" format rules above
6. Each question should guide content generation for that section

# TRANSCRIPT
${transcriptForPlanning}

Generate the sections array with unique, template-compliant titles and guiding questions.`;
}

/**
 * Get format-specific rules for the template
 */
function getFormatSpecificRules(template: VideoNotesTemplate): string {
    switch (template.format) {
        case 'Q&A':
            return `• Titles MUST be questions in question form
• Use question words: "What", "How", "Why", "When", "Where", "Which"
• Examples: "What is...?", "How does...?", "Why...?", "X vs Y - What's the difference?"
• NOT allowed: Statements, commands, or declarative titles`;

        case 'Step-by-Step':
            return `• Titles MUST follow "Step N: [action/topic]" format
• N must be sequential (Step 1, Step 2, Step 3, etc.)
• Action should be clear and specific
• Examples: "Step 1: Initialize Project", "Step 2: Configure Database"
• NOT allowed: Questions, statements without step numbers`;

        case 'Insights':
            return `• Titles should identify key topics or themes
• Format: "Key Topic N: [topic name]" or "[Topic Name] - Key Insights"
• Focus on main discussion points and takeaways
• Examples: "Key Topic 1: Future of AI", "Guest Background and Expertise"
• Can also use: "Main Takeaway: [insight]"`;

        case 'Mixed':
        default:
            return `• Titles should be clear, descriptive, and focused
• Can use various formats depending on content type
• Questions for concepts: "What is...?"
• Topics for themes: "Main Topic: [name]"
• Steps for processes: "Step N: [action]"
• Adapt format to best represent the content`;
    }
}

/**
 * Validate template compliance
 * Ensures question titles follow the template's format requirements
 */
function validateTemplateCompliance(items: QuestionItem[], template: VideoNotesTemplate): void {
    const format = template.format;

    for (const item of items) {
        const title = item.title.trim();

        switch (format) {
            case 'Q&A':
                // Must be a question (ends with ? or contains question words)
                const hasQuestionMark = title.endsWith('?');
                const hasQuestionWord = /^(what|how|why|when|where|which|who|whose|whom)\b/i.test(title);

                if (!hasQuestionMark && !hasQuestionWord) {
                    log.warn('⚠️ Q&A format violation - title is not a question', {
                        title,
                        templateFormat: format
                    });
                }
                break;

            case 'Step-by-Step':
                // Must follow "Step N:" format
                const stepPattern = /^step\s+\d+:/i;
                if (!stepPattern.test(title)) {
                    log.warn('⚠️ Step-by-Step format violation - title does not follow "Step N:" format', {
                        title,
                        templateFormat: format
                    });
                }
                break;

            case 'Insights':
                // Should mention "key", "topic", "insight", "takeaway", or "guest"
                const insightPattern = /\b(key|topic|insight|takeaway|guest|main|background)\b/i;
                if (!insightPattern.test(title)) {
                    log.warn('⚠️ Insights format suggestion - consider using insight-related keywords', {
                        title,
                        templateFormat: format
                    });
                }
                break;

            case 'Mixed':
            default:
                // No specific validation for mixed format
                break;
        }
    }

    log.info('✅ Template compliance validation completed', {
        format,
        itemCount: items.length
    });
}
