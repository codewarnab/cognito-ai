/**
 * YouTube to Notion Agent
 * Parent sub-agent that orchestrates video-to-notes conversion
 * 
 * This agent:
 * - Uses @google/genai SDK with provider-aware initialization
 * - Calls analyzeYouTubeVideo to get transcript (50k+ chars)
 * - Detects video type from transcript
 * - Generates structured notes using AI
 * - Calls notionCreatorAgent to create pages
 * - Returns compact response to main workflow
 */

import { initializeGenAIClient } from '../../core/genAIFactory';
import { createLogger } from '../../../logger';
import { executeYouTubeAnalysis } from '../youtube/youtubeAgentTool';
import { executeNotionCreator } from '../notion/notionCreatorAgentTool';
import { detectVideoType, getTemplate, generateTemplateGuidelines } from './templates';
import { createRetryManager } from '../../../errors/retryManager';
import type { YouTubeToNotionInput, YouTubeToNotionOutput, StructuredVideoNotes } from './types';

const log = createLogger('YouTubeToNotionAgent');

/**
 * System prompt for the YouTube to Notion Agent
 */
const SYSTEM_PROMPT = `You are a YouTube to Notion Agent - a specialized orchestrator that converts YouTube videos into beautifully structured Notion notes.

# YOUR ROLE
Convert YouTube video transcripts into structured, hierarchical notes that will be created in Notion.

# WORKFLOW

## STEP 1: Analyze Video Type
Examine the transcript to determine the video type:
- **Tutorial**: Contains "step", "how to", "let's build", code examples
- **Lecture**: Academic tone, "theory", "concept", "definition", structured teaching
- **Podcast**: Conversational, "interview", "guest", Q&A format
- **Documentary**: Narrative style, "explore", "discover", storytelling
- **Presentation**: "slide", "agenda", "roadmap", business/conference context
- **Webinar**: "training", "demonstration", professional development
- **Course**: "lesson", "module", "assignment", curriculum structure
- **Review**: "pros", "cons", "comparison", evaluation
- **Generic**: Fallback for other types

## STEP 2: Generate Structured Notes
Based on the detected video type, create 4-10 nested pages with:
- Clear, focused titles (questions or topics)
- Detailed content (2-4 paragraphs minimum per page)
- Smart formatting appropriate for video type
- Actual information extracted from transcript

## NOTE STRUCTURE REQUIREMENTS

### For Lectures (Q&A Format):
- Page titles should be questions: "What is X?", "How does Y work?", "X vs Y"
- Content provides detailed answers with examples
- Focus on key concepts, comparisons, applications

### For Tutorials (Step-by-Step):
- Page titles like "Step 1: Setup", "Step 2: Implementation"
- Content explains each step in detail
- Include prerequisites, common errors, best practices

### For Podcasts (Insights):
- Page titles like "Key Topic 1: [Topic Name]", "Guest Background"
- Content summarizes discussion points and takeaways
- Include resources mentioned, action items

### For Other Types:
- Adapt structure to fit content naturally
- Maintain 4-10 nested pages minimum
- Ensure each page has substantial content

## CRITICAL RULES
1. ALWAYS create 4-10 nested pages (NEVER less than 4)
2. Each page title must be clear and focused
3. Each page content must be VERY DETAILED and COMPREHENSIVE (2-4 paragraphs minimum, 200-500 words per page)
4. Extract ACTUAL information from transcript (don't make up content)
5. NEVER truncate content with "..." - always write complete, full paragraphs
6. Content should be thorough, educational, and self-contained
7. No timestamps (transcript doesn't have them)
8. Main page title must end with "Notes [Cognito AI]"
9. Output ONLY valid JSON (no extra text)

# OUTPUT FORMAT

You MUST respond with ONLY a JSON object in this exact format:

\`\`\`json
{
  "videoType": "lecture",
  "mainPageTitle": "[Video Title] Notes [Cognito AI]",
  "videoUrl": "https://youtube.com/watch?v=...",
  "nestedPages": [
    {
      "title": "What is Disk Scheduling?",
      "content": "Disk scheduling is a technique used by operating systems to optimize the order in which disk I/O requests are serviced. The main goal is to minimize seek time, which is the time taken by the disk arm to locate the correct track on the disk platter.\\n\\nThere are several disk scheduling algorithms, each with different characteristics. The choice of algorithm depends on the specific requirements of the system, such as throughput, fairness, and response time.\\n\\nIn modern systems, disk scheduling is crucial for performance, especially in scenarios with multiple concurrent I/O requests. Understanding these algorithms helps in designing more efficient storage systems."
    },
    {
      "title": "FCFS (First-Come, First-Served) Algorithm",
      "content": "FCFS is the simplest disk scheduling algorithm. It processes disk requests in the order they arrive, without any optimization. This is similar to a queue where the first request is serviced first.\\n\\nAdvantages: Simple to implement, fair (no starvation), predictable.\\nDisadvantages: High seek time, no optimization, poor performance with many requests.\\n\\nExample: If requests arrive for tracks 98, 183, 37, 122, and the head is at 53, FCFS would service them in that exact order: 53→98→183→37→122. This results in significant back-and-forth movement."
    },
    {
      "title": "SSTF (Shortest Seek Time First) Algorithm",
      "content": "SSTF selects the request that requires the least seek time from the current head position. This greedy approach minimizes the total seek time but can lead to starvation of requests that are far from the current head position.\\n\\nThe algorithm works by always choosing the closest track to service next. While this provides better average response time than FCFS, it has a significant drawback: requests located far from the current head position may never get serviced if new requests keep arriving closer to the head.\\n\\nIn practice, SSTF is rarely used alone due to the starvation problem, but its principles are incorporated into more sophisticated algorithms."
    }
  ]
}
\`\`\`

# IMPORTANT NOTES
- Do NOT include any text before or after the JSON
- Do NOT use code blocks or markdown formatting around the JSON
- Each nested page MUST have COMPLETE, DETAILED, COMPREHENSIVE content (200-500 words per page)
- NEVER truncate or shorten content with "..." or "etc." - always write full paragraphs
- Write as if you're teaching someone - be thorough and clear
- If transcript is short, still create at least 4 quality pages with substantial content
- Extract real information from the transcript provided and expand on it with context and explanations
`;

/**
 * Execute YouTube to Notion Agent
 * This is the main orchestration function
 */
export async function executeYouTubeToNotionAgent(
    input: YouTubeToNotionInput
): Promise<YouTubeToNotionOutput> {
    log.info('🎬 Starting YouTube to Notion Agent', {
        youtubeUrl: input.youtubeUrl,
        videoTitle: input.videoTitle,
        hasParentPageId: !!input.parentPageId
    });

    try {
        // PHASE 1: Get transcript using YouTube agent
        log.info('📝 Phase 1: Fetching transcript...');

        const youtubeAnalysis = await executeYouTubeAnalysis({
            youtubeUrl: input.youtubeUrl,
            question: 'Please provide the complete transcript of this video.'
        });

        if (!youtubeAnalysis.success || !youtubeAnalysis.answer) {
            log.error('❌ Failed to get video transcript', youtubeAnalysis);
            return {
                success: false,
                message: 'Could not retrieve video transcript. The video may not have captions available.',
                error: 'TRANSCRIPT_UNAVAILABLE'
            };
        }

        const transcript = youtubeAnalysis.answer;
        log.info('✅ Transcript retrieved', {
            length: transcript.length,
            usedTranscript: youtubeAnalysis.usedTranscript
        });

        // PHASE 2: Detect video type
        log.info('🔍 Phase 2: Detecting video type...');

        const videoType = detectVideoType(transcript, input.videoTitle);
        const template = getTemplate(videoType);

        log.info('✅ Video type detected', {
            videoType,
            templateName: template.name,
            format: template.format
        });

        // PHASE 3: Generate structured notes using AI
        log.info('🤖 Phase 3: Generating structured notes...');

        const structuredNotes = await generateStructuredNotes(
            transcript,
            input.videoTitle,
            input.youtubeUrl,
            videoType,
            template
        );

        if (!structuredNotes) {
            return {
                success: false,
                message: 'Failed to generate structured notes from transcript.',
                error: 'NOTE_GENERATION_FAILED'
            };
        }

        log.info('✅ Structured notes generated', {
            videoType: structuredNotes.videoType,
            nestedPagesCount: structuredNotes.nestedPages.length
        });

        // PHASE 4: Create Notion pages using Notion Creator Agent (with retry on schema errors)
        log.info('📄 Phase 4: Creating Notion pages...');

        let notionResult = await executeNotionCreator({
            mainPageTitle: structuredNotes.mainPageTitle,
            videoUrl: structuredNotes.videoUrl,
            nestedPages: structuredNotes.nestedPages,
            parentPageId: input.parentPageId
        });

        // Retry once if it fails (common with schema issues)
        if (!notionResult.success && notionResult.error !== 'NO_NOTION_TOOLS') {
            log.warn('⚠️ First attempt to create Notion pages failed, retrying with fresh agent context...', {
                error: notionResult.error,
                message: notionResult.message
            });

            // Wait a moment before retry
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Retry with the same parameters - the Notion Creator Agent will auto-correct schema
            notionResult = await executeNotionCreator({
                mainPageTitle: structuredNotes.mainPageTitle,
                videoUrl: structuredNotes.videoUrl,
                nestedPages: structuredNotes.nestedPages,
                parentPageId: input.parentPageId
            });

            if (notionResult.success) {
                log.info('✅ Notion pages created successfully on retry');
            } else {
                log.error('❌ Failed to create Notion pages after retry', notionResult);
            }
        }

        if (!notionResult.success) {
            log.error('❌ Failed to create Notion pages after all attempts', notionResult);
            return {
                success: false,
                message: `${notionResult.message} (attempted twice with schema correction)`,
                error: notionResult.error
            };
        }

        log.info('✅ Notion pages created successfully');

        // PHASE 5: Return compact response
        return {
            success: true,
            mainPageUrl: notionResult.mainPageUrl,
            pageCount: notionResult.pageCount,
            videoType: structuredNotes.videoType,
            message: `Created "${input.videoTitle}" notes with ${notionResult.pageCount} pages in Notion`
        };

    } catch (error) {
        log.error('❌ YouTube to Notion Agent failed:', error);

        return {
            success: false,
            message: 'Failed to convert video to Notion notes',
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Generate structured notes from transcript using AI
 */
async function generateStructuredNotes(
    transcript: string,
    videoTitle: string,
    videoUrl: string,
    videoType: string,
    template: any
): Promise<StructuredVideoNotes | null> {
    try {
        log.info('🤖 Generating structured notes with AI', {
            transcriptLength: transcript.length,
            videoType,
            templateName: template.name
        });

        // Initialize Gen AI client with provider awareness
        const client = await initializeGenAIClient();

        // Build the prompt with template guidelines
        const templateGuidelines = generateTemplateGuidelines(template);

        const prompt = `${SYSTEM_PROMPT}

${templateGuidelines}

# VIDEO INFORMATION
**Title**: ${videoTitle}
**URL**: ${videoUrl}
**Detected Type**: ${videoType}

# TRANSCRIPT
${transcript}

# YOUR TASK
Analyze the transcript above and generate structured notes following the ${template.name} template.
Create ${template.sectionGuidelines.minSections}-${template.sectionGuidelines.maxSections} nested pages with detailed content.

OUTPUT YOUR RESPONSE AS VALID JSON ONLY (no other text):`;

        log.info('📤 Sending request to Gemini with retry logic...');

        // Create retry manager with aggressive retry policy for AI model overload
        const retryManager = createRetryManager({
            maxRetries: 20,
            initialDelay: 2000,
            maxDelay: 60000,
            backoffMultiplier: 1.5,
            useJitter: true,
            onRetry: (attempt, delay, error) => {
                log.warn(`⚠️ Gemini request failed (attempt ${attempt}/20), retrying in ${Math.round(delay / 1000)}s...`, {
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

        // Generate content using provider-aware client with retry
        const response = await retryManager.execute(async () => {
            return await client.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: {
                    temperature: 0.7,
                    maxOutputTokens: 8192
                }
            });
        });

        const responseText = response.text;

        if (!responseText) {
            log.error('❌ No response from Gemini');
            return null;
        }

        log.info('✅ Response received', { length: responseText.length });

        // Parse JSON response
        const structuredNotes = parseNotesResponse(responseText);

        if (!structuredNotes) {
            log.error('❌ Failed to parse notes response');
            return null;
        }

        // Validate notes structure
        if (!validateStructuredNotes(structuredNotes)) {
            log.error('❌ Invalid notes structure');
            return null;
        }

        return structuredNotes;

    } catch (error) {
        log.error('❌ Error generating structured notes:', error);
        return null;
    }
}

/**
 * Parse JSON response from AI
 * Handles various formats and extracts JSON
 */
function parseNotesResponse(responseText: string): StructuredVideoNotes | null {
    try {
        // Try to extract JSON from code blocks if present
        const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        const jsonText = jsonMatch ? jsonMatch[1] : responseText;

        // Ensure jsonText is defined
        if (!jsonText) {
            log.error('❌ No JSON text found in response');
            return null;
        }

        // Parse JSON
        const parsed = JSON.parse(jsonText.trim());

        return {
            videoType: parsed.videoType,
            mainPageTitle: parsed.mainPageTitle,
            videoUrl: parsed.videoUrl,
            nestedPages: parsed.nestedPages || []
        };

    } catch (error) {
        log.error('❌ Failed to parse JSON response:', error);
        log.error('Response text:', responseText.substring(0, 500));
        return null;
    }
}

/**
 * Validate structured notes
 */
function validateStructuredNotes(notes: StructuredVideoNotes): boolean {
    // Check required fields
    if (!notes.videoType || !notes.mainPageTitle || !notes.videoUrl || !notes.nestedPages) {
        log.error('❌ Missing required fields in structured notes');
        return false;
    }

    // Check minimum nested pages
    if (!Array.isArray(notes.nestedPages) || notes.nestedPages.length < 4) {
        log.error('❌ Insufficient nested pages (minimum 4 required)', {
            count: notes.nestedPages?.length || 0
        });
        return false;
    }

    // Check maximum nested pages
    if (notes.nestedPages.length > 10) {
        log.warn('⚠️ Too many nested pages (maximum 10), truncating', {
            count: notes.nestedPages.length
        });
        notes.nestedPages = notes.nestedPages.slice(0, 10);
    }

    // Validate each nested page
    for (let i = 0; i < notes.nestedPages.length; i++) {
        const page = notes.nestedPages[i];

        if (!page || !page.title || !page.content) {
            log.error(`❌ Invalid nested page at index ${i}`, page);
            return false;
        }

        // Check content length (should be substantial)
        if (page.content.length < 100) {
            log.warn(`⚠️ Short content for page "${page.title}" (${page.content.length} chars)`);
        }
    }

    log.info('✅ Structured notes validation passed', {
        videoType: notes.videoType,
        nestedPagesCount: notes.nestedPages.length
    });

    return true;
}
