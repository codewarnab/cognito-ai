/**
 * Video Type Detector Agent
 * Uses LLM-based semantic analysis to classify video types
 * 
 * Replaces keyword-based detection with intelligent classification
 * that understands context, tone, and structure.
 */

import { createRetryManager } from '../../../errors/retryManager';
import { createLogger } from '../../../logger';
import { initializeGenAIClient } from '../../core/genAIFactory';
import type { VideoType, VideoTypeDetectionResult } from './types';
import { VIDEO_TEMPLATES } from './templates';

const log = createLogger('VideoTypeDetectorAgent');

/**
 * JSON schema for structured output
 * Ensures LLM returns valid JSON with all required fields
 */
const detectionSchema = {
    type: 'object',
    properties: {
        videoType: {
            type: 'string',
            enum: [
                'tutorial',
                'lecture',
                'podcast',
                'documentary',
                'presentation',
                'webinar',
                'course',
                'review',
                'generic'
            ],
            description: 'The detected video type'
        },
        confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Confidence score between 0.0 and 1.0'
        },
        reasoning: {
            type: 'string',
            description: 'Brief explanation of why this type was selected'
        },
        alternatives: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    type: {
                        type: 'string',
                        enum: [
                            'tutorial',
                            'lecture',
                            'podcast',
                            'documentary',
                            'presentation',
                            'webinar',
                            'course',
                            'review',
                            'generic'
                        ]
                    },
                    confidence: {
                        type: 'number',
                        minimum: 0,
                        maximum: 1
                    }
                },
                required: ['type', 'confidence']
            },
            description: 'Alternative types considered with their confidence scores'
        }
    },
    required: ['videoType', 'confidence', 'reasoning']
};

/**
 * Detect video type using LLM-based semantic analysis
 * 
 * @param params - Detection parameters
 * @returns Detection result with type, confidence, and reasoning
 */
export async function detectVideoType(params: {
    /** Video title */
    videoTitle: string;

    /** Full video transcript */
    transcript: string;

    /** Optional: Video URL for context */
    videoUrl?: string;

    /** Optional: Video duration in seconds */
    durationSeconds?: number;
}): Promise<VideoTypeDetectionResult> {
    const { videoTitle, transcript, videoUrl, durationSeconds } = params;

    log.info('🎯 Starting video type detection', {
        videoTitle,
        transcriptLength: transcript.length,
        durationSeconds,
        hasUrl: !!videoUrl
    });

    // Initialize Gen AI client
    const client = await initializeGenAIClient();

    // Build detection prompt
    const prompt = buildDetectionPrompt({
        videoTitle,
        transcript,
        videoUrl,
        durationSeconds
    });

    // Create retry manager (10 retries for detection)
    const retry = createRetryManager({
        maxRetries: 10,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 1.5,
        useJitter: true,
        onRetry: (attempt, delay, error) => {
            log.warn(`⚠️ Detection failed (attempt ${attempt}/10), retrying in ${Math.round(delay / 1000)}s...`, {
                error: error.message
            });
        },
        shouldRetry: (error) => {
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

    log.info('📤 Sending detection request to Gemini');

    // Execute detection with retry
    const response = await retry.execute(async () => {
        return await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                temperature: 0.3, // Lower temperature for consistent classification
                maxOutputTokens: 1024,
                responseMimeType: 'application/json',
                responseSchema: detectionSchema
            }
        });
    });

    const text = response.text || '{}';
    log.info('✅ Received detection response', {
        responseLength: text.length
    });

    // Parse and validate response
    try {
        const parsed = JSON.parse(text);

        const result: VideoTypeDetectionResult = {
            videoType: parsed.videoType || 'generic',
            confidence: parsed.confidence || 0.0,
            reasoning: parsed.reasoning || 'No reasoning provided',
            alternatives: parsed.alternatives || []
        };

        // Validate video type
        const validTypes: VideoType[] = [
            'tutorial',
            'lecture',
            'podcast',
            'documentary',
            'presentation',
            'webinar',
            'course',
            'review',
            'generic'
        ];

        if (!validTypes.includes(result.videoType)) {
            log.warn('⚠️ Invalid video type returned, falling back to generic', {
                returnedType: result.videoType
            });
            result.videoType = 'generic';
            result.confidence = 0.5;
        }

        // Apply confidence threshold
        const CONFIDENCE_THRESHOLD = 0.6;
        if (result.confidence < CONFIDENCE_THRESHOLD) {
            log.info(`ℹ️ Low confidence (${result.confidence.toFixed(2)}), using generic type`, {
                detectedType: result.videoType,
                reasoning: result.reasoning
            });
            result.videoType = 'generic';
        }

        log.info('✅ Video type detected successfully', {
            videoType: result.videoType,
            confidence: result.confidence.toFixed(2),
            reasoning: result.reasoning,
            alternatives: result.alternatives?.map((a: { type: string; confidence: number }) => `${a.type}:${a.confidence.toFixed(2)}`).join(', ')
        });

        return result;
    } catch (error) {
        log.error('❌ Failed to parse detection response', {
            error,
            responseText: text.substring(0, 500)
        });

        // Fallback to generic
        return {
            videoType: 'generic',
            confidence: 0.5,
            reasoning: 'Failed to parse detection response, using generic fallback'
        };
    }
}

/**
 * Build detection prompt with video information and type descriptions
 */
function buildDetectionPrompt(params: {
    videoTitle: string;
    transcript: string;
    videoUrl?: string;
    durationSeconds?: number;
}): string {
    const { videoTitle, transcript, videoUrl, durationSeconds } = params;

    // Truncate transcript for detection (first 10000 chars sufficient)
    const truncatedTranscript = transcript.length > 10000
        ? transcript.slice(0, 10000) + '\n\n[Transcript truncated for classification...]'
        : transcript;

    // Build type descriptions from templates
    const typeDescriptions = Object.values(VIDEO_TEMPLATES)
        .map(template => `- **${template.type}** (${template.name}): ${template.description}`)
        .join('\n');

    const durationInfo = durationSeconds
        ? `\nDuration: ${Math.floor(durationSeconds / 60)} minutes`
        : '';

    return `You are a video content classifier. Analyze the following video and determine its type.

# VIDEO INFORMATION

**Title**: ${videoTitle}
${videoUrl ? `**URL**: ${videoUrl}` : ''}${durationInfo}

**Transcript**:
${truncatedTranscript}

---

# VIDEO TYPES

${typeDescriptions}

---

# YOUR TASK

Analyze the video's content, structure, tone, and purpose to classify it into ONE of the types above.

**Consider:**
1. **Content Structure**: Does it follow Q&A format? Step-by-step instructions? Conversational?
2. **Tone & Style**: Educational? Conversational? Demonstrative? Analytical?
3. **Purpose**: Teach a skill? Explain concepts? Review products? Tell a story?
4. **Language Patterns**: Questions? Numbered steps? "Today we'll discuss"? "Let's build"?
5. **Context**: Title hints? Channel style? Presentation format?

**Important:**
- Look for SEMANTIC patterns, not just keywords
- Consider the OVERALL structure and purpose
- Understand context (e.g., "tutorial" in title might be ironic or referential)
- If content is hybrid or ambiguous, choose the DOMINANT type or use "generic"
- Provide a confidence score:
  - 0.9-1.0: Very confident (clear indicators)
  - 0.7-0.8: Confident (strong indicators)
  - 0.6-0.6: Moderate (some indicators)
  - < 0.6: Low confidence (ambiguous, use generic)

**Output Format:**
Return JSON with:
- videoType: The detected type
- confidence: Score between 0.0 and 1.0
- reasoning: Brief explanation (2-3 sentences)
- alternatives: Other types considered (optional)

Classify the video now.`;
}
