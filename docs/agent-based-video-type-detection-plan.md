# Agent-Based Video Type Detection - Multi-Phase Implementation Plan

## Executive Summary

Replace the keyword-based video type detection in `templates.ts` (lines 290-341) with an intelligent agent-based classifier that uses LLM semantic understanding to accurately detect video types.

**Goal**: Improve classification accuracy from ~60-70% (estimated with keywords) to 90%+ (with agent).

**Approach**: Multi-phase implementation creating a new `videoTypeDetectorAgent.ts` that uses Gemini 2.5 Flash with structured output to analyze video content and metadata for classification.

**Implementation Strategy**: Phased rollout with incremental changes, testing at each phase, without automated test file generation.

---

## Problem Statement

### Current System (Keyword-Based):
```typescript
// templates.ts lines 290-341
export function detectVideoType(transcript: string, videoTitle?: string): VideoType {
  // 1. Combine text (title weighted 3x)
  const combinedText = `${lowerTitle} ${lowerTitle} ${lowerTitle} ${lowerTranscript}`;
  
  // 2. Count keyword matches
  for (const [type, keywords] of Object.entries(VIDEO_TYPE_KEYWORDS)) {
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = combinedText.match(regex);
      if (matches) {
        scores[type as VideoType] += matches.length;
      }
    }
  }
  
  // 3. Pick highest score (threshold: 3)
  return maxScore >= 3 ? detectedType : 'generic';
}
```

### Limitations:
1. **No Semantic Understanding**: Cannot understand context
2. **Fragile**: Easy to fool with keyword spam
3. **Rigid Scoring**: Linear keyword counting
4. **Language Limited**: English keywords only
5. **No Nuance**: Cannot detect hybrid types or confidence levels

### Real-World Failure Examples:
- ❌ "A tutorial on why this approach failed" → classified as tutorial
- ❌ Documentary with "step-by-step" narration → classified as tutorial  
- ❌ "This is NOT a lecture" → classified as lecture
- ❌ Interview discussing "tutorials" → classified as tutorial
- ❌ Non-English content → always falls back to generic

---

## Proposed Solution: Agent-Based Detection

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  YouTube to Notion Agent (youtubeToNotionAgent.ts)         │
│  Phase 2: Video Type Detection                             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Video Type Detector Agent (NEW)                           │
│  - Analyzes transcript + metadata                           │
│  - Uses Gemini 2.5 Flash with structured output            │
│  - Returns type + confidence + reasoning                    │
└─────────────────────────────────────────────────────────────┘
                 │
                 ▼
        Video Type + Confidence
        (lecture, 0.95, "Clear Q&A structure...")
```

### Agent Responsibilities:
1. **Semantic Analysis**: Understand content meaning, not just keywords
2. **Multi-Signal Detection**: Consider:
   - Video title
   - Transcript content structure
   - Tone and style
   - Presence of specific patterns (questions, steps, conversations)
3. **Confidence Scoring**: Return confidence level (0.0-1.0)
4. **Reasoning**: Explain why a type was selected
5. **Fallback Handling**: Use generic type for ambiguous content

---

## Multi-Phase Implementation Approach

### Overview

This implementation follows a **phased approach** to minimize risk and ensure each component works correctly before moving to the next phase. **No automated test files will be generated** - testing will be done manually and through existing test infrastructure.

### Phase 1: Foundation Setup
**Goal**: Create the agent infrastructure without breaking existing functionality.

**Tasks**:
1. Create new `videoTypeDetectorAgent.ts` file with complete agent implementation
2. Add `VideoTypeDetectionResult` interface to `types.ts`
3. Keep existing keyword-based function in `templates.ts` (mark as deprecated)

**Deliverables**:
- New agent file with full detection logic
- Type definitions added
- No integration yet - existing system continues to work

**Validation**:
- Code compiles without errors
- No breaking changes to existing functionality
- Agent file can be imported without issues

---

### Phase 2: Integration with YouTube to Notion Agent
**Goal**: Connect the new agent to the main workflow.

**Tasks**:
1. Update `youtubeToNotionAgent.ts` imports to include new agent
2. Modify Phase 2 detection logic (lines 75-84) to call new agent
3. Add comprehensive logging for detection results
4. Implement fallback to keyword detection on agent failure

**Deliverables**:
- Updated `youtubeToNotionAgent.ts` using agent-based detection
- Enhanced logging with confidence scores and reasoning
- Graceful error handling with fallback

**Validation**:
- Manual testing with 3-5 diverse videos
- Verify detection results are logged properly
- Confirm fallback works when agent fails

---

### Phase 3: Monitoring & Refinement
**Goal**: Observe real-world performance and tune parameters.

**Tasks**:
1. Monitor detection confidence scores across multiple videos
2. Analyze "generic" fallback rate
3. Adjust confidence threshold if needed (currently 0.6)
4. Review detection reasoning for accuracy
5. Collect edge cases for future improvement

**Deliverables**:
- Performance metrics report
- Tuned confidence threshold (if adjustments needed)
- Documentation of edge cases

**Validation**:
- Manual testing with 20+ diverse videos
- Accuracy comparison with keyword-based approach
- Latency measurements within acceptable range (<5s)

---

### Phase 4: Cleanup & Optimization
**Goal**: Remove deprecated code and optimize performance.

**Tasks**:
1. Remove keyword-based detection function from `templates.ts`
2. Remove `VIDEO_TYPE_KEYWORDS` constant (no longer needed)
3. Optimize transcript truncation if needed
4. Update documentation with final implementation details

**Deliverables**:
- Clean codebase without deprecated functions
- Updated documentation
- Performance optimization (if applicable)

**Validation**:
- Code review and cleanup verification
- Documentation accuracy check
- Final performance benchmarks

---

## Implementation Details

### File Structure

```
src/ai/agents/youtubeToNotion/
├── videoTypeDetectorAgent.ts      # NEW (Phase 1): Agent implementation
├── templates.ts                   # MODIFIED (Phase 4): Remove detectVideoType, keep templates
├── youtubeToNotionAgent.ts        # MODIFIED (Phase 2): Call new agent (line 77)
├── types.ts                       # MODIFIED (Phase 1): Add DetectionResult interface
└── ...
```

### New File: `videoTypeDetectorAgent.ts`

```typescript
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
import type { VideoType } from './types';
import { VIDEO_TEMPLATES } from './templates';

const log = createLogger('VideoTypeDetectorAgent');

/**
 * Detection result with confidence and reasoning
 */
export interface VideoTypeDetectionResult {
  /** Detected video type */
  videoType: VideoType;
  
  /** Confidence score (0.0 - 1.0) */
  confidence: number;
  
  /** Reasoning for detection (for debugging/logging) */
  reasoning: string;
  
  /** Alternative types considered (with scores) */
  alternatives?: Array<{
    type: VideoType;
    confidence: number;
  }>;
}

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
      alternatives: result.alternatives?.map(a => `${a.type}:${a.confidence.toFixed(2)}`).join(', ')
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

/**
 * Legacy keyword-based detection (fallback)
 * Keep for comparison and emergency fallback
 */
export function detectVideoTypeKeywordBased(transcript: string, videoTitle?: string): VideoType {
  // ... (keep existing implementation as fallback)
}
```

### Modified: `types.ts` (Add Detection Result)

```typescript
// Add to types.ts

/**
 * Video type detection result with metadata
 */
export interface VideoTypeDetectionResult {
  /** Detected video type */
  videoType: VideoType;
  
  /** Confidence score (0.0 - 1.0) */
  confidence: number;
  
  /** Reasoning for detection */
  reasoning: string;
  
  /** Alternative types considered */
  alternatives?: Array<{
    type: VideoType;
    confidence: number;
  }>;
}
```

### Modified: `templates.ts` (Remove detectVideoType function)

```typescript
// templates.ts

// REMOVE lines 290-341 (detectVideoType function)
// REMOVE lines 250-284 (VIDEO_TYPE_KEYWORDS - no longer needed)

// KEEP lines 11-245 (VIDEO_TEMPLATES and helper functions)
// KEEP getTemplate() function (line 346)
// KEEP generateTemplateGuidelines() function (line 353)

// Add deprecation notice
/**
 * @deprecated Use videoTypeDetectorAgent.ts instead
 * Video type detection moved to agent-based approach
 */
```

### Modified: `youtubeToNotionAgent.ts` (Use new agent)

```typescript
// youtubeToNotionAgent.ts
// Line 17: Change import
import { detectVideoType } from './videoTypeDetectorAgent'; // CHANGED
import { getTemplate } from './templates';

// Lines 75-84: Update detection call
// PHASE 2: Detect video type and template
log.info('🎯 Phase 2: Detecting video type');

// NEW: Call agent-based detection
const detectionResult = await detectVideoType({
  videoTitle,
  transcript,
  videoUrl: input.youtubeUrl,
  durationSeconds: entry.durationSeconds
});

const videoType = detectionResult.videoType;
const template = getTemplate(videoType);

log.info('✅ Template selected', {
  videoType,
  templateName: template.name,
  format: template.format,
  confidence: detectionResult.confidence.toFixed(2),  // NEW
  reasoning: detectionResult.reasoning                 // NEW
});
```

---

## Prompt Engineering Strategy

### Prompt Structure:
1. **Context Setup**: Video title, URL, duration, transcript
2. **Type Definitions**: All 9 types with descriptions from templates
3. **Analysis Guidelines**: What to look for in content
4. **Confidence Calibration**: How to score confidence
5. **Output Schema**: JSON structure

### Key Prompt Elements:

#### 1. Semantic Analysis Instructions
```
Consider:
- Content Structure: Q&A? Steps? Conversation?
- Tone & Style: Educational? Conversational? Analytical?
- Purpose: Teach? Explain? Review? Explore?
- Language Patterns: Questions? Steps? Discussions?
- Context: Title meaning? Overall format?
```

#### 2. Context-Awareness Guidance
```
Important:
- Look for SEMANTIC patterns, not just keywords
- Consider OVERALL structure and purpose
- Understand context (irony, references)
- If hybrid/ambiguous, choose DOMINANT type or generic
```

#### 3. Confidence Calibration
```
Confidence Scoring:
- 0.9-1.0: Very confident (clear, unambiguous indicators)
- 0.7-0.8: Confident (strong indicators, minor ambiguity)
- 0.6-0.6: Moderate (some indicators, mixed signals)
- < 0.6: Low confidence (ambiguous, unclear, use generic)
```

#### 4. Structured Output Enforcement
- Uses Gemini's `responseSchema` parameter
- Guarantees valid JSON with required fields
- Type-safe enum for videoType
- Numeric constraints on confidence (0.0-1.0)

---

## Configuration & Parameters

### Model Selection:
- **Model**: Gemini 2.5 Flash
- **Temperature**: 0.3 (lower for consistent classification)
- **Max Output Tokens**: 1024 (sufficient for detection + reasoning)
- **Response Format**: JSON with schema enforcement

### Retry Policy:
- **Max Retries**: 10 (lower than other agents, detection is faster)
- **Initial Delay**: 1s
- **Max Delay**: 30s
- **Backoff Multiplier**: 1.5
- **Jitter**: Enabled

### Confidence Threshold:
- **Threshold**: 0.6
- **Below threshold**: Fall back to generic type
- **Rationale**: Better to be safe with generic than wrong with specific

### Transcript Truncation:
- **Detection Limit**: 10,000 characters
- **Rationale**: First 10K chars usually sufficient for type detection
- **Benefit**: Faster processing, lower token cost

---

## Testing Strategy

**Note**: No automated test files will be generated for this implementation. Testing will be conducted manually at each phase.

### Manual Test Cases (Phase 2 & 3):
| Video Type | Example Title | Expected Detection |
|------------|--------------|-------------------|
| Tutorial | "Build a Todo App with React" | tutorial (conf > 0.8) |
| Lecture | "CS50 Lecture 3: Algorithms" | lecture (conf > 0.8) |
| Podcast | "Tech Leaders EP42: Jane Doe" | podcast (conf > 0.8) |
| Documentary | "The Story of the Internet" | documentary (conf > 0.7) |
| Presentation | "AWS re:Invent 2024 Keynote" | presentation (conf > 0.7) |
| Review | "iPhone 15 Pro Review" | review (conf > 0.8) |
| Webinar | "Q4 Product Training Webinar" | webinar (conf > 0.7) |
| Course | "Python Crash Course - Lesson 3" | course (conf > 0.8) |
| Generic | "Random Vlog Content" | generic (conf < 0.6) |

---

## Performance Considerations

### Latency Impact:
- **Keyword Detection**: ~50-100ms (synchronous regex matching)
- **Agent Detection**: ~2-4 seconds (LLM inference)
- **Trade-off**: +2-3 seconds total workflow time for much better accuracy

### Token Cost:
- **Input**: ~10,000 chars transcript + 1,000 chars prompt = ~3,000 tokens
- **Output**: ~200 tokens (detection result)
- **Total per detection**: ~3,200 tokens
- **Cost**: Negligible (Gemini Flash is very cheap)

### Optimization Opportunities:
1. **Transcript Truncation**: Use first 10K chars (implemented)
2. **Caching**: Cache detection results by video ID (future enhancement)
3. **Parallel Detection**: If running multiple videos (not applicable here)

---

## Phase Rollback Plans

### Phase 1 Rollback:
If foundation setup has issues:
1. Delete `videoTypeDetectorAgent.ts` file
2. Remove type definitions from `types.ts`
3. System continues using keyword-based detection

### Phase 2 Rollback:
If integration causes problems:
1. Revert `youtubeToNotionAgent.ts` to use keyword function
2. Keep agent code for debugging
3. System immediately returns to stable state

### Phase 3 Rollback:
If monitoring reveals unacceptable accuracy:
1. Adjust confidence threshold (try 0.5 or 0.7)
2. Modify prompt to improve detection
3. Revert to keyword detection if unfixable

### Phase 4 Rollback:
If cleanup causes issues:
1. Restore keyword function from version control
2. Add back `VIDEO_TYPE_KEYWORDS` constant
3. Maintain both approaches if needed

---

## Success Metrics

### Accuracy Metrics:
- **Baseline (Keyword)**: ~60-70% accuracy (estimated)
- **Target (Agent)**: 90%+ accuracy
- **Measurement**: Manual validation on 100 test videos

### Performance Metrics:
- **Detection Time**: < 5 seconds (acceptable for +accuracy)
- **Confidence Distribution**: Most detections > 0.7
- **Generic Fallback Rate**: < 20%

### Quality Indicators:
- **Correct Template Selection**: Better structured notes
- **User Satisfaction**: Fewer complaints about wrong structure
- **Downstream Impact**: Better question planning (template-aware)

---

## Future Enhancements

### 1. Multi-Label Classification
Support hybrid video types (e.g., "lecture + tutorial"):
```typescript
{
  primaryType: 'lecture',
  secondaryType: 'tutorial',
  confidence: 0.85,
  reasoning: '...'
}
```

### 2. Language Detection & Support
Detect video language and adjust type detection accordingly:
```typescript
{
  videoType: 'lecture',
  detectedLanguage: 'spanish',
  confidence: 0.90
}
```

### 3. Caching
Cache detection results by video ID to avoid re-detection:
```typescript
const cacheKey = `detection:${videoId}`;
const cached = await cache.get(cacheKey);
if (cached) return cached;
```

### 4. User Feedback Loop
Allow users to correct misclassifications:
```typescript
// User corrects: lecture → tutorial
// Log correction for future model fine-tuning
logDetectionCorrection({
  videoId,
  detectedType: 'lecture',
  correctedType: 'tutorial',
  confidence: 0.75
});
```

### 5. Template Expansion
Add more specialized templates:
- `technical-deep-dive`
- `panel-discussion`
- `live-stream`
- `shorts/clips`

---

## Implementation Checklist

### Phase 1: Foundation Setup
- [ ] Create `videoTypeDetectorAgent.ts` with complete agent implementation
- [ ] Add `VideoTypeDetectionResult` interface to `types.ts`
- [ ] Mark keyword function as deprecated in `templates.ts`
- [ ] Verify code compiles without errors
- [ ] Verify no breaking changes to existing functionality

### Phase 2: Integration
- [ ] Update `youtubeToNotionAgent.ts` imports to include new agent
- [ ] Modify Phase 2 detection logic to call new agent
- [ ] Add comprehensive logging (confidence, reasoning, alternatives)
- [ ] Implement fallback to keyword detection on errors
- [ ] Manual testing with 3-5 diverse videos
- [ ] Verify logs are properly formatted and informative

### Phase 3: Monitoring & Refinement
- [ ] Manual testing with 20+ diverse video types
- [ ] Monitor detection confidence scores
- [ ] Track "generic" fallback rate
- [ ] Measure detection latency (<5s target)
- [ ] Compare accuracy with keyword-based approach
- [ ] Adjust confidence threshold if needed (currently 0.6)
- [ ] Document edge cases discovered
- [ ] Create performance metrics report

### Phase 4: Cleanup
- [ ] Remove keyword detection function from `templates.ts`
- [ ] Remove `VIDEO_TYPE_KEYWORDS` constant
- [ ] Optimize transcript truncation if needed
- [ ] Update documentation with final implementation
- [ ] Final code review
- [ ] Performance benchmarks

### Documentation (Throughout):
- [ ] Update README with agent-based detection explanation
- [ ] Document confidence threshold and tuning rationale
- [ ] Add troubleshooting guide for detection issues
- [ ] Document phase completion criteria

---

## Risk Assessment

### Risks & Mitigations:

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Agent detection is slower** | Low | Acceptable trade-off for accuracy; optimize with truncation |
| **LLM hallucination** | Medium | Use structured output + confidence threshold + fallback to generic |
| **Detection fails silently** | High | Comprehensive error handling + retry logic + fallback to keyword |
| **Confidence calibration is off** | Medium | Extensive testing + threshold tuning + monitoring |
| **Token cost increases** | Low | Gemini Flash is cheap; truncate transcript to 10K chars |
| **Regression in existing system** | Medium | Keep keyword function as emergency fallback; gradual rollout |

### Emergency Fallback:
```typescript
// In videoTypeDetectorAgent.ts
try {
  return await detectVideoTypeAgent(...);
} catch (error) {
  log.error('Agent detection failed, using keyword fallback', error);
  return {
    videoType: detectVideoTypeKeywordBased(transcript, videoTitle),
    confidence: 0.5,
    reasoning: 'Agent failed, used keyword fallback'
  };
}
```

---

## Conclusion

Agent-based video type detection is a **high-value, low-risk improvement** that aligns with the existing system architecture:

✅ **Consistent with System Design**: Other agents (planner, writer) already use LLM-based approaches  
✅ **Minimal Integration Changes**: Drop-in replacement for `detectVideoType()`  
✅ **Structured Output**: Uses same proven pattern (JSON schema)  
✅ **Error Handling**: Follows same retry + fallback patterns  
✅ **Observable**: Enhanced logging for debugging and validation  

**Expected Outcome**: 30-40% accuracy improvement with only 2-3 seconds added latency.

**Recommendation**: Proceed with implementation.

