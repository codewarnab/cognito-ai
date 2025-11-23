# YouTube Tool Migration Plan: Agent-Based → Transcript-Fetching Tool

## Current Analysis

### Current Architecture (Agent-Based Approach)

**Flow:**
1. Main agent receives YouTube-related question
2. Main agent calls `youtubeAgentAsTool` (sub-agent)
3. YouTube sub-agent:
   - Fetches transcript (if available)
   - Fetches video metadata (duration, description)
   - If transcript available: Uses transcript for analysis
   - If no transcript: Uses Gemini video analysis with chunking (30-min segments)
   - Generates answer using its own AI model instance
4. Sub-agent returns complete answer to main agent
5. Main agent forwards answer to user

**Current Components:**
- `youtubeAgent.ts` - Vercel AI SDK tool wrapper (sub-agent)
- `youtubeAgentTool.ts` - Gemini native function declaration (browser action agent)
- `utils/transcript.ts` - Fetches transcript from external API
- `utils/videoAnalysis.ts` - Handles video analysis with Gemini (with/without transcript)
- `utils/videoMetadata.ts` - Extracts duration, description from YouTube page
- `utils/formatting.ts` - Time formatting utilities
- `utils/retry.ts` - Retry logic for API calls

**Key Issues:**
1. **Unnecessary Agent Overhead**: Creates a sub-agent instance when not needed
2. **Token Waste**: Transcript (32K tokens max) is analyzed by sub-agent, then result returned to main agent
3. **Context Loss**: Main agent loses direct access to transcript context
4. **Duplicate Processing**: Sub-agent generates full answer, main agent could have done this directly
5. **Complexity**: Extra layer of abstraction that doesn't add value

### Proposed Architecture (Transcript-Fetching Tool)

**New Flow:**
1. Main agent receives YouTube-related question
2. Main agent calls `getYouTubeTranscript` tool
3. Tool:
   - Fetches transcript from API
   - Fetches video metadata (duration, description, title)
   - Returns raw transcript + metadata to main agent
4. Main agent uses transcript in its own context to answer question
5. Main agent responds directly to user

**Benefits:**
1. ✅ **Single AI Instance**: Main agent handles all reasoning
2. ✅ **Better Context Usage**: Transcript available in main agent's context
3. ✅ **Token Efficiency**: No duplicate processing or intermediate answers
4. ✅ **Simpler Architecture**: One less abstraction layer
5. ✅ **Faster Response**: Eliminates sub-agent overhead
6. ✅ **Better Follow-ups**: Main agent retains transcript for subsequent questions

---

## Multi-Phase Migration Plan

### Phase 1: Create New Transcript Tool (Non-Breaking)

**Objective**: Build the new transcript-fetching tool alongside existing agent

**Tasks:**
1. **Create `youtubeTranscriptTool.ts`**
   - New tool that fetches transcript + metadata
   - Returns structured data to main agent
   - Similar to current flow but returns data instead of answer

2. **Schema Design**:
   ```typescript
   Input: {
     youtubeUrl: string;
     includeDescription?: boolean; // default true
   }
   
   Output: {
     videoId: string;
     title: string;
     duration?: number; // in seconds
     durationFormatted?: string;
     transcript?: string;
     description?: string;
     hasTranscript: boolean;
     error?: string;
   }
   ```

3. **Reuse Existing Utils**:
   - Keep `utils/transcript.ts` (no changes)
   - Keep `utils/videoMetadata.ts` (no changes)
   - Keep `utils/formatting.ts` (no changes)
   - Keep `utils/retry.ts` (no changes)

4. **Register New Tool**:
   - Add to `src/ai/tools/manager.ts`
   - Add formatter in `src/components/ui/tools/formatters/registry.ts`
   - Add icon mapping in `src/components/ui/tools/icons/ToolIconMapper.tsx`

**Files to Create:**
- `src/ai/agents/youtube/youtubeTranscriptTool.ts` (new)

**Files to Modify:**
- `src/ai/agents/youtube/index.ts` (export new tool)
- `src/ai/tools/manager.ts` (register tool)
- `src/components/ui/tools/formatters/registry.ts` (add formatter)
- `src/components/ui/tools/icons/ToolIconMapper.tsx` (add icon)

**Testing:**
- Test transcript fetching for various videos
- Test error handling (no captions, private videos, etc.)
- Test metadata extraction
- Verify tool shows correctly in UI

---

### Phase 2: Update System Prompts & Remove Old Tool

**Objective**: Replace old agent tool with new transcript tool completely

**Tasks:**
1. **Update Remote System Prompt** (`src/ai/setup/remoteMode.ts`):
   - Add instructions for `getYouTubeTranscript` tool
   - Remove references to `analyzeYouTubeVideo`
   - Provide examples of proper usage

2. **Update Browser Agent Prompt** (`src/ai/agents/browser/browserActionAgent.ts`):
   - Similar updates for browser action context
   - Handle cases where active tab is YouTube

3. **Remove Old Tool Registration**:
   - Remove from `src/ai/tools/manager.ts`
   - Remove from `src/ai/setup/remoteMode.ts`
   - Remove formatters and icon mappings

4. **Prompt Strategy**:
   ```
   For YouTube videos:
   1. Use getYouTubeTranscript to fetch transcript + metadata
   2. If transcript available: Use it directly in your context to answer
   3. If no transcript: Inform user that video analysis not available (for now)
   4. Transcript max size is ~32K tokens - easily fits in context
   ```

**Files to Modify:**
- `src\ai\prompts\templates\remote.ts` (system prompt)
- `src/ai/agents/browser/browserActionAgent.ts` (system prompt)
- `src/ai/tools/manager.ts` (remove old tool registration)
- `src/ai/setup/remoteMode.ts` (remove old tool)
- `src/components/ui/tools/formatters/registry.ts` (remove old formatter)
- `src/components/ui/tools/icons/ToolIconMapper.tsx` (remove old icon)

**Testing:**
- Test main agent using new tool
- Verify answers are accurate
- Test follow-up questions (context retention)
- Test edge cases (no transcripts, long videos, errors)

---

### Phase 3: Handle Video Analysis Fallback (Optional)

**Objective**: Decide what to do when transcript unavailable

**Option A: No Video Analysis (Simplest)**
- Just inform user transcript not available
- Suggest they check video description
- Provide video metadata (title, duration, description)

**Option B: Direct Video Analysis (Advanced)**
- Main agent calls Gemini video analysis directly
- Use video chunks if needed (>30 min videos)
- More complex but maintains feature parity

**Recommendation**: Start with Option A, add Option B if users complain

**Tasks (if Option B chosen):**
1. Create `analyzeVideoContent` tool
2. Returns video analysis (not transcript)
3. Main agent uses analysis to answer questions

---

### Phase 5: Deprecate Old Agent Tool

**Objective**: Remove agent-based approach completely

**Tasks:**
1. **Update System Prompts**:
   - Remove references to `analyzeYouTubeVideo`
   - Focus on `getYouTubeTranscript` only

2. **Disable Old Tool**:
   - Remove from `src/ai/tools/manager.ts`
   - Remove from `src/ai/setup/remoteMode.ts`
   - Keep code but don't register tool

3. **Mark as Deprecated**:
   - Add `@deprecated` JSDoc comments
   - Keep files for reference
   - Don't delete yet (wait for Phase 6)

4. **Update Documentation**:
   - Update TECHNICAL_DOCUMENTATION.md
   - Update any relevant docs

**Files to Modify:**
- `src/ai/tools/manager.ts` (remove registration)
- `src/ai/setup/remoteMode.ts` (remove from tools)
- `src/ai/agents/youtube/youtubeAgent.ts` (add @deprecated)
- `src/ai/agents/youtube/youtubeAgentTool.ts` (add @deprecated)

**Testing:**
- Verify YouTube questions still work
- Test edge cases
- Monitor for any user confusion

---

### Phase 6: Cleanup & Consolidation

**Objective**: Remove old code, clean up architecture

**Tasks:**
1. **Delete Old Agent Files**:
   - Remove `youtubeAgent.ts`
   - Remove `youtubeAgentTool.ts`
   - Remove `videoAnalysis.ts` (if not using Option B from Phase 4)

2. **Reorganize Directory**:
   - Rename `src/ai/agents/youtube/` → `src/ai/tools/youtube/`
   - Or keep under agents if following agent pattern elsewhere
   - Consolidate utils if needed

3. **Update Imports**:
   - Fix any broken imports
   - Update barrel exports

4. **Clean Up Tool Registry**:
   - Remove old formatters
   - Remove old icon mappings
   - Clean up any dead code

5. **Final Documentation**:
   - Document new architecture
   - Update flow diagrams
   - Add migration notes

**Files to Delete:**
- `src/ai/agents/youtube/youtubeAgent.ts`
- `src/ai/agents/youtube/youtubeAgentTool.ts`
- `src/ai/agents/youtube/utils/videoAnalysis.ts` (conditionally)

**Files to Modify:**
- Multiple files for import updates
- `src/ai/agents/youtube/index.ts` (clean up exports)
- Component files (remove old formatters/icons)

---

## Detailed Implementation: Phase 1

### File: `src/ai/agents/youtube/youtubeTranscriptTool.ts`

```typescript
/**
 * YouTube Transcript Fetching Tool
 * 
 * This tool fetches YouTube video transcripts and metadata for the main agent.
 * Unlike the old agent-based approach, this returns raw data for the main agent
 * to process, eliminating unnecessary sub-agent overhead.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { createLogger } from '~logger';
import { parseError } from '../../../errors';
import { fetchTranscript } from './utils/transcript';
import { getVideoDuration, getVideoDescription, extractVideoId } from './utils/videoMetadata';
import { formatDuration } from './utils/formatting';

const log = createLogger('YouTube-Transcript-Tool');

/**
 * YouTube Transcript Tool for Main Agent
 * Fetches transcript and metadata, returns to main agent for processing
 */
export const getYouTubeTranscript = tool({
    description: `Fetch YouTube video transcript and metadata.
  
  Use this tool to get the transcript of a YouTube video so you can answer
  questions about the video content directly.
  
  The tool will:
  - Fetch the video transcript (if available)
  - Get video metadata (title, duration, description)
  - Return everything to you for analysis
  
  IMPORTANT:
  - Transcripts are typically under 32K tokens, easily fitting in context
  - If transcript available, use it to answer user questions directly
  - If no transcript, inform user and provide available metadata
  - You can use the transcript for summaries, Q&A, analysis, etc.
  
  Use this when users:
  - Ask about YouTube video content
  - Want summaries or explanations
  - Have specific questions about videos
  - Need information from video transcripts`,

    inputSchema: z.object({
        youtubeUrl: z.string().describe('The full YouTube URL (e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ)'),
        includeDescription: z.boolean().optional().default(true).describe('Whether to fetch video description (default: true)'),
    }),

    execute: async ({ youtubeUrl, includeDescription = true }) => {
        log.info('📝 YouTube Transcript Tool called', { youtubeUrl, includeDescription });

        try {
            // Extract video ID
            const videoId = extractVideoId(youtubeUrl);
            if (!videoId) {
                throw new Error('Invalid YouTube URL - could not extract video ID');
            }

            // Fetch transcript and metadata in parallel
            const [transcriptData, description] = await Promise.all([
                fetchTranscript(youtubeUrl),
                includeDescription ? getVideoDescription(youtubeUrl) : Promise.resolve(undefined)
            ]);

            // Build response
            const response: any = {
                videoId,
                url: youtubeUrl,
                hasTranscript: false,
            };

            if (transcriptData) {
                response.hasTranscript = true;
                response.title = transcriptData.title;
                response.transcript = transcriptData.transcript;
                response.transcriptLength = transcriptData.transcript.length;
                
                if (transcriptData.duration) {
                    response.duration = transcriptData.duration * 60; // Convert to seconds
                    response.durationFormatted = formatDuration(response.duration);
                }
            } else {
                // No transcript - try to get duration separately
                log.info('No transcript available, fetching metadata only');
                const duration = await getVideoDuration(youtubeUrl);
                if (duration) {
                    response.duration = duration;
                    response.durationFormatted = formatDuration(duration);
                }
            }

            if (description) {
                response.description = description;
                response.descriptionLength = description.length;
            }

            log.info('✅ YouTube data fetched', {
                hasTranscript: response.hasTranscript,
                transcriptLength: response.transcriptLength,
                hasDuration: !!response.duration,
                hasDescription: !!response.description,
            });

            return response;

        } catch (error) {
            log.error('❌ YouTube Transcript Tool error', error);
            const parsedError = parseError(error, { serviceName: 'YouTube' });
            throw parsedError;
        }
    },
});
```

### Tool Formatter (for UI display)

```typescript
// Add to: src/components/ui/tools/formatters/registry.ts

const youtubeTranscriptFormatter = (
    args: any,
    result: any,
    status: 'pending' | 'success' | 'error'
): ToolFormatterResult => {
    if (status === 'pending') {
        return {
            title: 'Fetching YouTube Transcript',
            content: `Getting transcript for: ${args.youtubeUrl}`,
        };
    }

    if (status === 'error') {
        return {
            title: 'YouTube Transcript Error',
            content: result.message || 'Failed to fetch transcript',
        };
    }

    // Success
    const parts: string[] = [];
    
    if (result.title) {
        parts.push(`**Title:** ${result.title}`);
    }
    
    if (result.durationFormatted) {
        parts.push(`**Duration:** ${result.durationFormatted}`);
    }
    
    if (result.hasTranscript) {
        parts.push(`✅ **Transcript Available** (${result.transcriptLength.toLocaleString()} characters)`);
    } else {
        parts.push(`ℹ️ **No Transcript Available**`);
    }
    
    if (result.description) {
        parts.push(`**Description:** ${result.description.slice(0, 200)}...`);
    }

    return {
        title: 'YouTube Transcript Fetched',
        content: parts.join('\n\n'),
    };
};

// Add to registry
export const toolFormatterRegistry: ToolFormatterRegistry = {
    // ... existing formatters
    getYouTubeTranscript: youtubeTranscriptFormatter,
};
```

---

## Risk Analysis

### Low Risk ✅
- Phase 1: Creating new tool with thorough testing
- Phase 3: Video analysis fallback (optional enhancement)

### Medium Risk ⚠️
- Phase 2: Removing old tool and updating prompts (test thoroughly)
- Phase 4: Deleting old code (use git for rollback if needed)

**Mitigation Strategies:**
1. Test new tool extensively before removing old one
2. Have rollback plan ready (git revert)
3. Monitor for errors after deployment
4. Keep good git history for rollback
5. Document everything thoroughly

---

## Success Metrics

### Functionality
- [ ] Tool fetches transcripts successfully
- [ ] Main agent uses transcripts to answer questions
- [ ] Follow-up questions work correctly
- [ ] Error handling works properly

### Quality
- [ ] Answers are accurate and helpful
- [ ] Context retained across conversation
- [ ] Edge cases handled gracefully

### Maintainability
- [ ] Code complexity reduced
- [ ] Fewer abstraction layers
- [ ] Easier to debug and maintain

---

## Timeline Estimate

- **Phase 1**: 4-6 hours (implementation + testing)
- **Phase 2**: 3-4 hours (prompt updates + tool removal + testing)
- **Phase 3**: 4-8 hours (if implementing Option B)
- **Phase 4**: 2-3 hours (cleanup + documentation)

**Total**: ~1-2 days of focused work

---

## Next Steps

1. ✅ Review and approve this plan
2. ⏳ Start Phase 1 implementation
3. ⏳ Test new tool thoroughly
4. ⏳ Phase 2: Replace old tool with new one
5. ⏳ Monitor for any issues
6. ⏳ Complete cleanup (Phase 4)

---

## Notes

- Keep this document updated as migration progresses
- Document any issues or deviations from plan
- Add lessons learned at the end
- Consider similar migrations for other agent-based tools (PDF?)
