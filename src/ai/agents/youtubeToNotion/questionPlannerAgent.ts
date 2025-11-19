/**
 * Question Planner Agent
 * Phase 2 of YouTube to Notion Multi-Phase Refactor
 * 
 * This agent:
 * - Uses Gemini 2.5 Flash with structured output mode for guaranteed JSON parsing
 * - Generates 6-10 unique, template-aware section questions from video transcript
 * - Enforces minimum 4 questions requirement
 * - De-duplicates questions (case-insensitive title matching)
 * - Uses aggressive retry policy (20 retries) for AI model overload handling
 */

import { createRetryManager } from '../../../errors/retryManager';
import { createLogger } from '~logger';
import { initializeGenAIClient } from '../../core/genAIFactory';
import type { VideoNotesTemplate } from './types';
import { progressStore } from './progressStore';

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

    // Progress: Start planning
    const planningStepId = progressStore.add({
        title: 'Planning note structure...',
        status: 'active',
        type: 'planning'
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
                temperature: 0.7, // Higher temperature for more creative, varied questions
                maxOutputTokens: 16384,
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

        // Check minimum requirement
        if (items.length < targetMin) {
            log.error('❌ Insufficient questions planned', {
                planned: items.length,
                required: targetMin,
                questions: items.map(q => q.title)
            });

            // Progress: Planning failed
            progressStore.update(planningStepId, {
                title: 'Planning failed',
                status: 'error',
                data: { error: `Only ${items.length} questions planned (minimum ${targetMin} required)` }
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

        // Progress: Planning complete
        progressStore.update(planningStepId, {
            title: `Planned ${items.length} sections`,
            status: 'complete',
            data: { count: items.length }
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
 * Sample transcript intelligently to get representative content
 * Takes from beginning, middle, and end for better coverage
 */
function smartSampleTranscript(transcript: string, maxChars: number): string {
    if (transcript.length <= maxChars) {
        return transcript;
    }

    // Allocate: 50% beginning, 25% middle, 25% end
    const beginChars = Math.floor(maxChars * 0.5);
    const midChars = Math.floor(maxChars * 0.25);
    const endChars = maxChars - beginChars - midChars;

    const beginning = transcript.slice(0, beginChars);

    const midStart = Math.floor(transcript.length / 2 - midChars / 2);
    const middle = transcript.slice(midStart, midStart + midChars);

    const end = transcript.slice(-endChars);

    return `${beginning}\n\n[... middle section ...]\n\n${middle}\n\n[... later section ...]\n\n${end}`;
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

    // Smarter transcript sampling: take from beginning, middle, and end
    const transcriptForPlanning = smartSampleTranscript(transcript, 10000);

    return `You are planning sections for Notion notes based on a YouTube video transcript.

Video Title: ${videoTitle}
Video URL: ${videoUrl}
Template Type: ${template.name} (${template.format})

# YOUR TASK
Generate ${targetMin}-${targetMax} UNIQUE, HIGH-QUALITY sections based on the transcript content.

# QUALITY CRITERIA (CRITICAL)
Each section MUST meet ALL these standards:

1. **SPECIFICITY**: Titles must be specific, not generic
   ✅ Good: "What is the CAP Theorem and why does it matter?"
   ❌ Bad: "What is this concept?"
   ❌ Bad: "Overview" or "Introduction"

2. **UNIQUENESS**: Each section covers a DISTINCT topic
   - No overlap between sections
   - Each explores a different aspect of the content

3. **ANSWERABILITY**: Questions must be directly answerable from the transcript
   - Don't ask about content not discussed in the video
   - Base questions on actual quotes/examples from transcript

4. **DEPTH**: Prefer deeper, more insightful questions over surface-level ones
   ✅ Good: "How does eventual consistency solve the availability problem?"
   ❌ Bad: "What is consistency?"

5. **COVERAGE**: Questions should span the ENTIRE video
   - Include early, middle, and late content
   - Don't cluster all questions in one section

# CRITICAL RULES FOR "${template.format}" FORMAT

${getFormatSpecificRules(template)}

# SECTION GUIDELINES
Based on the "${template.name}" template, consider these section types:
${template.sectionGuidelines.sectionTypes.map(t => `• ${t}`).join('\n')}

# EXAMPLE TITLES FOR THIS TEMPLATE
${template.exampleTitles.map(t => `• "${t}"`).join('\n')}

# ANTI-PATTERNS TO AVOID
❌ Generic titles: "Introduction", "Overview", "Conclusion" (unless very specific)
❌ Duplicate concepts: Don't ask the same thing in different words
❌ Vague questions: "What about X?" should be "What specific aspect of X?"
❌ Clustering: Don't make all questions about the first 5 minutes

# REQUIREMENTS
1. Generate ${targetMin}-${targetMax} sections
2. Each section MUST meet ALL quality criteria above
3. Questions should reference SPECIFIC concepts from the transcript
4. Distribute questions across the ENTIRE video timeline
5. Titles MUST follow the "${template.format}" format rules above
6. Each question should guide content generation for that section

# TRANSCRIPT
${transcriptForPlanning}

Generate the sections array with unique, high-quality, template-compliant titles and guiding questions.`;
}

/**
 * Get format-specific rules for the template
 */
function getFormatSpecificRules(template: VideoNotesTemplate): string {
    switch (template.format) {
        case 'Q&A':
            return `• Titles MUST be questions in question form with SPECIFIC subject matter
• Use question words: "What", "How", "Why", "When", "Where", "Which"
• Include key concepts in the question itself
• Examples: 
  ✅ "What is the CAP Theorem and how does it apply to distributed systems?"
  ✅ "How does React's reconciliation algorithm improve performance?"
  ❌ "What is this?" (too vague)
  ❌ "Understanding the basics" (not a question)
• Each question should be self-contained and specific`;

        case 'Step-by-Step':
            return `• Titles MUST follow "Step N: [specific action/topic]" format
• N must be sequential (Step 1, Step 2, Step 3, etc.)
• Action should be SPECIFIC and ACTIONABLE
• Examples:
  ✅ "Step 1: Initialize Next.js Project with TypeScript"
  ✅ "Step 2: Configure Tailwind CSS with Custom Theme"
  ❌ "Step 1: Setup" (too vague - setup what?)
  ❌ "Configure things" (not numbered, not specific)
• Each step should build on previous steps logically`;

        case 'Insights':
            return `• Titles should identify SPECIFIC key topics, themes, or takeaways
• Format options:
  - "Key Topic: [specific topic name and context]"
  - "[Person Name]'s Perspective on [specific subject]"
  - "Main Takeaway: [specific insight]"
• Examples:
  ✅ "Key Topic: AI's Impact on Healthcare Diagnostics"
  ✅ "Guest's Perspective on Remote Work Culture Post-2020"
  ✅ "Main Takeaway: Why Async Communication Beats Meetings"
  ❌ "Key Topic: AI" (too broad)
  ❌ "Discussion points" (too generic)
• Focus on ACTIONABLE or MEMORABLE insights`;

        case 'Mixed':
        default:
            return `• Titles should be SPECIFIC, DESCRIPTIVE, and FOCUSED
• Choose format based on content type:
  - Questions for concepts: "What is [specific concept] and how does it work?"
  - Topics for themes: "Main Topic: [specific name and context]"
  - Steps for processes: "Step N: [specific action]"
• Examples:
  ✅ "How Modern Browsers Optimize JavaScript Execution"
  ✅ "The Evolution of CSS: From Floats to Flexbox to Grid"
  ✅ "Comparing REST vs GraphQL for API Design"
  ❌ "Overview" or "Introduction" (unless very specific)
  ❌ "Some concepts" (vague)
• Always include key terms and context in the title`;
    }
}

