## YouTube → Notion Multi‑Phase Refactor Plan

### Goals

- Always refetch the transcript from our transcript API at the start of each workflow run (no reliance on LLM to "return" the transcript).
- Keep a run-scoped in-memory cache of the transcript (and metadata) for the entire execution; remove it on completion/termination.
- Key by videoId to support concurrent different videos across multiple browser windows; handle edge cases when same video runs in parallel.
- If transcript API returns no transcript, degrade gracefully to video-based analysis (existing youtubeAgentTool flow).
- Use Gemini's structured output mode ([documented here](https://ai.google.dev/gemini-api/docs/structured-output?example=recipe)) for reliable JSON parsing with `response_mime_type: "application/json"` and `response_json_schema`.
- Split monolithic content generation into two sub-agents: - Question Planner: derive 6-10 unique section questions/titles (min 4) based on transcript + template, using structured output for guaranteed JSON. - Answer Writer: generate each page independently using the full transcript (simple retrieval for transcripts >6k chars to bound tokens).
- Create Notion pages incrementally (create main page once, capture pageId from tool response, then child pages per completed answer sequentially), maintaining compatibility with current MCP tool conversion and function calling loop.
- Prevent duplicate questions/pages from being created through validation and de-duplication logic.

### Non‑Goals

- Changing MCP transport or tool discovery (we keep `getMCPToolsFromBackground` → `convertAllTools` → Gemini function-calling loop).
- Replacing Notion toolset. We only add a thin orchestration layer or light agent APIs to support incremental creation.
- Feature flag rollout (we are building this as the primary flow from scratch).

## Current Implementation Snapshot (Reference)

- Orchestrator: `src/ai/agents/youtubeToNotion/youtubeToNotionAgent.ts`
- Calls `executeYouTubeAnalysis({ question: "Please provide the complete transcript..." })` to obtain transcript via LLM tool, not directly via transcript API payload.
- Detects video type via `detectVideoType`, selects template, then single-shot `generateStructuredNotes` (one LLM call) that returns all nested pages at once.
- Sends all nested pages to Notion in one call via `executeNotionCreator`.

- Notion agent: `src/ai/agents/notion/notionCreatorAgent.ts`
- Discovers MCP tools: `getMCPToolsFromBackground()` → filters `notion-*` → `convertAllTools(notionTools)`.
- Starts a Gemini chat with `tools: [{ functionDeclarations: geminiToolDeclarations }]`.
- The function-calling loop executes tool calls sequentially, with retries (`withRetry`) and up to `maxIterations`.
- System instruction warns about flat properties, Notion Markdown content, and parent structure. It creates main page then nested pages sequentially.

- YouTube agent tool: `src/ai/agents/youtube/youtubeAgentTool.ts`
- Has `fetchTranscript` (internal) calling a centralized API; also extracts description and duration.
- If transcript is available, it uses text-based analysis; otherwise, video analysis with chunking.

## Architecture Changes at a Glance

1. Fetch transcript directly and cache for the run

2. Plan questions (titles) using transcript + template

3. Generate page content per question (with retrieval if needed)

4. Create Notion pages incrementally (main page once, then children per answer)

5. Cleanup cache on success/failure

## Phase 1 · Transcript Access & Run‑Scoped Cache

### Changes

- **Transcript API Response Contract:** - Endpoint: `POST TRANSCRIPT_API_URL` with `{ url: youtubeUrl }` - Response: `{ duration: number | null, title: string | null, transcript: string | null }` - All fields can be null; must handle safely with fallbacks.

- **Transcript Fetching Strategy:** - Create `src/ai/agents/youtubeToNotion/transcript.ts` with `fetchTranscriptDirect(videoUrl)` function. - If API returns transcript: use it (no video analysis). - If API returns no transcript (null or empty): degrade to existing video-based analysis from `youtubeAgentTool.ts` (`analyzeYouTubeVideo` with no transcript parameter). - Handle null `duration` and `title` gracefully with sensible defaults.

- **Add a lightweight run‑scoped cache:** - Module: `src/ai/agents/youtubeToNotion/transcriptCache.ts` - API: - `withTranscriptCache(videoUrl, fetcher, fn)`: computes cache key from videoId, always refetches at start, stores entry until `fn` completes; performs `finally` cleanup. - `getCachedTranscript(videoUrl)` and `setCachedTranscript(entry)` internally. - Key by videoId (not full URL) to normalize cache keys. - Behavior: - Always refetch transcript at the start of a new workflow run (delete any existing entry for same videoId before fetching). - Within the run, reuse cached transcript across phases/sub‑agents. - Ensure `finally` cleanup to remove the entry after the workflow finishes (success or failure). - Support concurrent runs of different videos in different browser windows (separate cache entries per videoId). - Handle edge case: same video running in parallel in two windows (each window gets its own run-scoped cache; last to finish cleans up).

### Acceptance

- A new run always triggers an API transcript fetch.
- Null/empty transcript triggers graceful degradation to video analysis.
- Sub‑agents receive the transcript via in-memory handoff, no additional network calls.
- Cache is guaranteed cleared in all terminal paths.
- Multiple browser windows can run agents on different videos concurrently without interference.

## Phase 2 · Question Planning Sub‑Agent

### Agent

- File: `src/ai/agents/youtubeToNotion/questionPlannerAgent.ts`
- Input: - `transcript: string` - `videoTitle: string` - `videoUrl: string` - `videoType: VideoType` - `template: VideoNotesTemplate` (from existing `templates.ts` - authoritative source) - Optional: `min`, `max` (default 6–10)
- Output: - `questions: Array<{ title: string; question: string }>` - Titles shaped by template (e.g., lecture → Q&A question form; tutorial → "Step N: …").

### Prompting & Structured Output

- Use Gemini's structured output mode (config: `{ response_mime_type: "application/json", response_json_schema: <schema> }`) to guarantee valid JSON without manual parsing.
- Model: `gemini-2.5-flash`; `temperature: 0.5` for consistency.
- Retry policy: Use existing `createRetryManager` with 20 retries, backoff, jitter, and overload handling.
- Prompt guidelines from current templates, focusing on planning only (not generation).

### Validation & De-duplication

- Enforce uniqueness: no duplicate titles or semantically identical questions.
- Guarantee at least 4 questions; cap at 10 per template bounds.
- Validate template compliance (e.g., lecture questions must be question-form, tutorial must be "Step N: ...").

## Phase 3 · Answer Generation Sub‑Agent

### Agent

- File: `src/ai/agents/youtubeToNotion/answerWriterAgent.ts`
- Input (per question): - `question: string` - `title: string` - `transcript: string` (from cache) - `template: VideoNotesTemplate` - Optional: `videoTitle`, `videoUrl` - Optional: `useRetrieval?: boolean` (default: auto-detect based on transcript length)
- Output: - `{ title: string; content: string }` matching `NestedPage` contract.

### Simple Retrieval (for long transcripts)

- Utility: `src/ai/agents/youtubeToNotion/simpleRetrieval.ts`
- **Trigger:** Automatically enable when `transcript.length > 6000` characters.
- **Method:** Split transcript into overlapping windows (e.g., 4000 chars with 500 char overlap).
- Keyword score using question terms to pick top 2-3 windows.
- Provide the top window(s) to the LLM to keep tokens bounded and avoid context limits.
- Note: Transcript API always returns the same full transcript; retrieval is purely for token management in answer generation.

### Structured Output & Validation

- Use Gemini's structured output mode (config: `{ response_mime_type: "application/json", response_json_schema: <schema> }`) to guarantee valid JSON.
- Model: `gemini-2.5-flash`; `temperature: 0.6` for creative but grounded answers.
- Retry policy: Use existing `createRetryManager` with 20 retries per answer.
- Ensure substantial content (≥200 words); if short, retry that specific answer only (not the whole batch).
- Validate no duplicate content across pages.

## Phase 4 · Incremental Notion Creation

### Current Integration (keep)

- `notionCreatorAgent.ts`: - Discovers MCP tools with `getMCPToolsFromBackground()`. - Converts to Gemini function declarations via `convertAllTools(notionTools)`. - Runs a Gemini chat with tools and a function-calling loop; tools like `notion-create-pages` are invoked by the model as needed. - System instruction enforces: flat properties, Notion Markdown content format, and parent structure.

### Incremental Strategy (Option 2: New Slim Agent)

- **Decision:** Create new `src/ai/agents/notion/notionPageWriterAgent.ts` (Option 2) to avoid modifying stable bulk-creator tool.
- **API:** - `createMainPage({ title, videoUrl?, parentPageId? })`: Creates the main page; returns `{ success, pageId?, pageUrl?, message? }`. - `createChildPage({ parentPageId, title, content })`: Creates a single child page under the given parent; returns same shape.
- **Implementation:** - Uses same MCP tools discovery and function-calling loop as `notionCreatorAgent.ts`. - Simplified system instruction focused on creating ONE page per call. - Captures `pageId` from `notion-create-pages` tool response to use as parent for subsequent child pages. - Maxes at 8 function-calling iterations per page (shorter than bulk agent).

### Sequential Creation & Retrying

- Create pages **sequentially:** main page first, then child pages one-by-one.
- Retry policy: 10 retries per Notion tool call (existing `withRetry` wrapper).
- If a child page creation fails after retries, log error and continue to next page (don't block entire run).
- De-duplicate: Skip creating a child page if its title already exists among created pages (track titles in a Set).

## Phase 5 · Orchestration in `youtubeToNotionAgent`

### Control Flow

1.  **Transcript Fetch & Cache**

            - Enter `withTranscriptCache(youtubeUrl, fetcherFn, workflowFn)`
            - Fetcher calls transcript API; if transcript is null/empty, degrade to video-based analysis (call `analyzeYouTubeVideo` from `youtubeAgentTool.ts` to get transcript-like text).
            - Store in cache (keyed by videoId) with duration/title (handle nulls).

2.  **Detect Type & Template**

            - `detectVideoType(transcript, videoTitle)` → `getTemplate(videoType)` (from existing authoritative `templates.ts`).

3.  **Plan Questions**

            - `planQuestions(...)` → list of 6–10 unique questions/titles (min 4, template-aware, de-duplicated).
            - Use structured output mode for guaranteed JSON parsing.

4.  **Create Main Notion Page**

            - Call `createMainPage({ title: `${videoTitle} Notes [Cognito AI]`, videoUrl, parentPageId }) `from new `notionPageWriterAgent`.
            - Capture `mainPageId` from response (returned by `notion-create-pages` tool).
            - If main page creation fails, abort workflow and return error.

5.  **Generate Answers & Create Child Pages (Sequential Loop)**

            - For each question:
                    - Check for duplicate title in Set; skip if duplicate.
                    - `writeAnswer(...)` → `{ title, content }` (uses retrieval if transcript >6k chars).
                    - Validate answer length (≥200 words); if invalid, retry answer generation once; if still fails, skip.
                    - `createChildPage({ parentPageId: mainPageId, title, content })`.
                    - Track created page titles in Set and count successes.
                    - Log progress: "Created 4/8 pages".

6.  **Finalize**

            - Return `{ success: true, mainPageUrl, pageCount: created + 1, videoType, message, childPageUrls?: [...] }`.

7.  **Cleanup**

            - `finally` in `withTranscriptCache` clears the run-scoped cache entry.

### Progress Logging

- Log phases with emoji: 📝 transcript, 🎯 type detection, 🧠 planning count, ✍️ per-page generation, ✅ Notion creation progress (e.g., "✅ Created 4/8 pages").

## Phase 6 · Telemetry, Limits, and Timeouts

- Keep aggressive but bounded retries per-step: AI generation (20 retries), Notion tool calls (10 retries).
- Cap tokens for writer prompts using retrieval (trigger at >6k chars) to avoid exceeding context limits.
- Emit concise, user-visible progress messages in the workflow layer with emoji indicators.

## Phase 7 · Types & Contracts

- **New types** (add to `src/ai/agents/youtubeToNotion/types.ts`): - `QuestionItem { title: string; question: string }` - `AnswerItem { title: string; content: string }` - `TranscriptEntry { videoUrl: string; videoId: string; title?: string; durationSeconds?: number; transcript: string }` (in `transcriptCache.ts`)

- **Update existing types:** - `YouTubeToNotionOutput`: Add optional `childPageUrls?: string[]` field.

- **No changes to** `notionCreatorAgentTool.ts` (Option 2: new agent instead).

## Implementation Strategy (No Feature Flags)

- Build all phases in sequence as the primary flow (not behind flags).
- Steps:

        1. Transcript utility + run-scoped cache
        2. Question Planner agent with structured output
        3. Answer Writer agent with retrieval
        4. Notion Page Writer agent (new slim agent)
        5. Wire orchestration in `youtubeToNotionAgent.ts`
        6. Test end-to-end on sample videos

## Appendix · How Notion Tools Are Wired Today (Keep This Flow)

- Tool discovery: `getMCPToolsFromBackground()` returns `mcpManager.tools`.
- Filter: names starting with `notion-` only.
- Conversion: `convertAllTools(notionTools)` → Gemini `functionDeclarations` array.
- Chat session: `client.chats.create({ model: 'gemini-2.5-flash', config: { systemInstruction: NOTION_CREATOR_SYSTEM_INSTRUCTION, tools: [{ functionDeclarations }] } })`.
- Function-calling loop:
- Read `response.functionCalls`
- For each call: `tool.execute(args)` with `withRetry`
- Send `functionResponse` back to the model
- Repeat until no more calls or `maxIterations`
- Final parse: Attempt to extract JSON from final assistant text, fallback to textual success heuristic.

## Success Criteria

- Each workflow run performs a fresh transcript fetch (or degrades to video analysis), then uses an execution-scoped cache keyed by videoId.
- Multiple browser windows can run agents on different videos concurrently without cache interference.
- The output pages are generated per unique question (no duplicates), validated (≥200 words), and written to Notion incrementally and sequentially.
- Failures isolate to the smallest unit (question/page) with localized retries; partial success continues.
- No transcript or partial results remain in memory after the run completes (guaranteed cleanup in `finally` block).
- Structured output mode eliminates JSON parsing errors for planner and writer agents.

## Implementation Sketches (with Code Snippets)

These are reference-quality snippets to guide implementation. Names/paths match the structure used in the current codebase.

### 1) Transcript Utility + Run‑Scoped Cache

File: `src/ai/agents/youtubeToNotion/transcriptCache.ts`

```ts
import { createLogger } from "../../../logger"

const log = createLogger("TranscriptCache")

export interface TranscriptEntry {
  videoUrl: string
  videoId: string
  title?: string
  durationSeconds?: number
  transcript: string
}

const runCache = new Map<string, TranscriptEntry>()

function getVideoId(url: string): string {
  try {
    const u = new URL(url)
    const id = u.searchParams.get("v")
    if (id) return id
    // youtu.be/<id>
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.replace("/", "")
    }
    // Fallback hash
    return Buffer.from(url).toString("base64").slice(0, 16)
  } catch {
    return Buffer.from(url).toString("base64").slice(0, 16)
  }
}

export function getCacheKey(videoUrl: string): string {
  return getVideoId(videoUrl)
}

export function getCachedTranscript(
  videoUrl: string
): TranscriptEntry | undefined {
  return runCache.get(getCacheKey(videoUrl))
}

export function setCachedTranscript(entry: TranscriptEntry): void {
  runCache.set(getCacheKey(entry.videoUrl), entry)
}

export function clearCachedTranscript(videoUrl: string): void {
  runCache.delete(getCacheKey(videoUrl))
}

export async function withTranscriptCache<T>(
  videoUrl: string,
  fetcher: () => Promise<TranscriptEntry>,
  fn: (entry: TranscriptEntry) => Promise<T>
): Promise<T> {
  // Always refetch at start of workflow run per requirements
  const key = getCacheKey(videoUrl)
  if (runCache.has(key)) {
    runCache.delete(key)
  }

  const entry = await fetcher()
  setCachedTranscript(entry)

  try {
    return await fn(entry)
  } finally {
    log.info("🧹 Disposing transcript cache for run", { videoUrl })
    clearCachedTranscript(videoUrl)
  }
}
```

File: `src/ai/agents/youtubeToNotion/transcript.ts`

```ts
import { TRANSCRIPT_API_URL } from "../../../constants"
import { createLogger } from "../../../logger"
import { analyzeYouTubeVideo } from "../youtube/youtubeAgentTool"
import type { TranscriptEntry } from "./transcriptCache"

const log = createLogger("TranscriptFetch")

/**
 * Fetch transcript from API, with graceful degradation to video analysis if no transcript available.
 * Handles null/empty values safely.
 */
export async function fetchTranscriptDirect(
  videoUrl: string
): Promise<TranscriptEntry> {
  log.info("📝 Fetching transcript from API", { videoUrl })

  try {
    const res = await fetch(TRANSCRIPT_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: videoUrl })
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      log.warn(
        `⚠️ Transcript API error ${res.status}, will degrade to video analysis`,
        data
      )
      return await degradeToVideoAnalysis(videoUrl)
    }

    const data = await res.json()

    // Handle null/empty transcript - degrade to video analysis
    if (!data.transcript || data.transcript.trim().length === 0) {
      log.info(
        "ℹ️ No transcript returned from API, degrading to video analysis"
      )
      return await degradeToVideoAnalysis(videoUrl)
    }

    // API returns duration in minutes (can be null)
    const durationSeconds = data.duration
      ? Math.floor(data.duration * 60)
      : undefined

    const entry: TranscriptEntry = {
      videoUrl,
      videoId: extractVideoId(videoUrl),
      title: data.title || "Untitled Video",
      durationSeconds,
      transcript: data.transcript
    }

    log.info("✅ Transcript fetched successfully", {
      videoId: entry.videoId,
      title: entry.title,
      transcriptLength: entry.transcript.length,
      durationSeconds: entry.durationSeconds
    })

    return entry
  } catch (error) {
    log.error(
      "❌ Transcript API request failed, degrading to video analysis",
      error
    )
    return await degradeToVideoAnalysis(videoUrl)
  }
}

/**
 * Degrade to video-based analysis when transcript is unavailable.
 * Uses existing youtubeAgentTool's analyzeYouTubeVideo function.
 */
async function degradeToVideoAnalysis(
  videoUrl: string
): Promise<TranscriptEntry> {
  log.info("🎥 Using video-based analysis as fallback", { videoUrl })

  // Call existing video analysis tool with a generic question to get comprehensive content
  const question =
    "Please provide a detailed overview of this video's content, including all major topics, key points, and discussions."
  const analysisText = await analyzeYouTubeVideo(videoUrl, question)

  return {
    videoUrl,
    videoId: extractVideoId(videoUrl),
    title: "Video Analysis",
    durationSeconds: undefined,
    transcript: analysisText || "Unable to analyze video content."
  }
}

/**
 * Extract YouTube video ID from URL
 */
function extractVideoId(url: string): string {
  try {
    const u = new URL(url)
    const id = u.searchParams.get("v")
    if (id) return id
    // youtu.be/<id>
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.replace("/", "")
    }
    // Fallback hash
    return Buffer.from(url).toString("base64").slice(0, 16)
  } catch {
    return Buffer.from(url).toString("base64").slice(0, 16)
  }
}
```

Usage inside `youtubeToNotionAgent.ts`:

```ts
import { withTranscriptCache } from './transcriptCache';
import { fetchTranscriptDirect } from './transcript';

// In executeYouTubeToNotionAgent:
return await withTranscriptCache(input.youtubeUrl, async () => {
    const entry = await fetchTranscriptDirect(input.youtubeUrl);
    if (!entry.transcript) {
        throw new Error('Transcript not available for this video.');
    }
    return entry;
}, async (entry) => {
    // Use entry.transcript, entry.durationSeconds, entry.title throughout the run
    // ... proceed with type detection, planning, per-question answer generation, and Notion writes
});
```

### 2) Question Planner Agent

File: `src/ai/agents/youtubeToNotion/questionPlannerAgent.ts`

```ts
import { createRetryManager } from "../../../errors/retryManager"
import { createLogger } from "../../../logger"
import { initializeGenAIClient } from "../../core/genAIFactory"
import type { VideoNotesTemplate } from "./types"

const log = createLogger("QuestionPlannerAgent")

export interface QuestionItem {
  title: string // final Notion page title (template-shaped)
  question: string // analysis question the writer will use
}

// JSON schema for structured output
const questionSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Section title for the Notion page"
          },
          question: {
            type: "string",
            description: "Question to guide content generation"
          }
        },
        required: ["title", "question"]
      }
    }
  },
  required: ["questions"]
}

export async function planQuestions(params: {
  transcript: string
  videoTitle: string
  videoUrl: string
  template: VideoNotesTemplate
  min?: number
  max?: number
}): Promise<QuestionItem[]> {
  const { transcript, videoTitle, videoUrl, template } = params
  const min = params.min ?? 6
  const max = params.max ?? 10
  const client = await initializeGenAIClient()

  const targetMin = Math.max(template.sectionGuidelines.minSections, min)
  const targetMax = Math.min(template.sectionGuidelines.maxSections, max)

  const prompt = `You are planning sections for Notion notes based on a YouTube video transcript.

Video Title: ${videoTitle}
Video URL: ${videoUrl}
Template Type: ${template.name} (${template.format})

Your task:
- Generate ${targetMin}-${targetMax} UNIQUE sections based on the transcript content.
- For "${template.format}" format: ${template.format === "Q&A" ? 'titles MUST be questions ("What is...?", "How does...?", "Why...?")' : template.format === "Step-by-Step" ? 'titles MUST be "Step N: [action]"' : "use clear descriptive titles"}.
- NO DUPLICATES: each section must cover a distinct topic.
- Base sections ONLY on content actually present in the transcript.
- Example titles for this template: ${template.exampleTitles.slice(0, 3).join("; ")}

Transcript:
${transcript.slice(0, 8000)}${transcript.length > 8000 ? "\n\n[Transcript truncated for planning...]" : ""}

Generate the sections array with unique, template-compliant titles.`

  const retry = createRetryManager({
    maxRetries: 20,
    initialDelay: 2000,
    maxDelay: 60000,
    backoffMultiplier: 1.5,
    useJitter: true
  })

  const response = await retry.execute(async () => {
    return await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.5,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        responseSchema: questionSchema
      }
    })
  })

  const text = response.text || "{}"
  try {
    const parsed = JSON.parse(text)
    const list = Array.isArray(parsed.questions) ? parsed.questions : []

    // De-duplicate by title (case-insensitive)
    const seenTitles = new Set<string>()
    const items: QuestionItem[] = list
      .filter((q: any) => {
        if (!q || !q.title || !q.question) return false
        const titleLower = q.title.toLowerCase().trim()
        if (seenTitles.has(titleLower)) {
          log.warn("🔄 Duplicate title detected, skipping", { title: q.title })
          return false
        }
        seenTitles.add(titleLower)
        return true
      })
      .slice(0, targetMax)

    if (items.length < targetMin) {
      log.warn("⚠️ Planned fewer questions than minimum required", {
        count: items.length,
        required: targetMin
      })
    }

    log.info("🧠 Questions planned", {
      count: items.length,
      min: targetMin,
      max: targetMax
    })
    return items
  } catch (e) {
    log.error("❌ Failed to parse planner response", e)
    throw new Error("Question planning failed: invalid response format")
  }
}
```

### 3) Simple Retrieval Utility (Optional but Recommended)

File: `src/ai/agents/youtubeToNotion/simpleRetrieval.ts`

```ts
export interface RetrievalOptions {
  windowSize: number // e.g., 4000 chars
  overlap: number // e.g., 500 chars
  topK: number // e.g., 2-3 windows
}

export function retrieveContextFromTranscript(
  transcript: string,
  question: string,
  options: RetrievalOptions = { windowSize: 4000, overlap: 500, topK: 2 }
): string {
  if (!transcript) return ""
  const { windowSize, overlap, topK } = options

  const windows: Array<{ i: number; text: string; score: number }> = []
  for (let i = 0; i < transcript.length; i += windowSize - overlap) {
    const slice = transcript.slice(
      i,
      Math.min(i + windowSize, transcript.length)
    )
    windows.push({ i, text: slice, score: 0 })
    if (i + windowSize >= transcript.length) break
  }

  const terms = question.toLowerCase().split(/\W+/).filter(Boolean)
  for (const w of windows) {
    const lower = w.text.toLowerCase()
    w.score = terms.reduce((acc, t) => acc + (lower.includes(t) ? 1 : 0), 0)
  }

  windows.sort((a, b) => b.score - a.score)
  const top = windows
    .slice(0, Math.max(1, Math.min(topK, windows.length)))
    .map((w) => w.text)
  return top.join("\n\n---\n\n")
}
```

### 4) Answer Writer Agent

File: `src/ai/agents/youtubeToNotion/answerWriterAgent.ts`

```ts
import { createRetryManager } from "../../../errors/retryManager"
import { createLogger } from "../../../logger"
import { initializeGenAIClient } from "../../core/genAIFactory"
import { retrieveContextFromTranscript } from "./simpleRetrieval"
import type { VideoNotesTemplate } from "./types"

const log = createLogger("AnswerWriterAgent")

export interface AnswerItem {
  title: string
  content: string
}

// JSON schema for structured output
const answerSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "Section title" },
    content: {
      type: "string",
      description: "Detailed content in Notion Markdown format"
    }
  },
  required: ["title", "content"]
}

const RETRIEVAL_THRESHOLD = 6000 // chars

export async function writeAnswer(params: {
  title: string
  question: string
  transcript: string
  template: VideoNotesTemplate
  videoTitle: string
  videoUrl: string
  useRetrieval?: boolean
}): Promise<AnswerItem> {
  const { title, question, transcript, template, videoTitle, videoUrl } = params

  // Auto-detect retrieval based on transcript length
  const shouldUseRetrieval =
    params.useRetrieval ?? transcript.length > RETRIEVAL_THRESHOLD

  const client = await initializeGenAIClient()
  const context = shouldUseRetrieval
    ? retrieveContextFromTranscript(transcript, question)
    : transcript

  log.info(`✍️ Writing answer for: ${title}`, {
    useRetrieval: shouldUseRetrieval,
    contextLength: context.length
  })

  const prompt = `You are generating ONE detailed section for Notion notes based on a YouTube video.

Title: ${title}
Video: ${videoTitle} (${videoUrl})
Template: ${template.name} (${template.format})

Your task:
- Write a thorough, self-contained answer (200-500 words minimum).
- Ground your answer ONLY in the provided context - do not hallucinate or add external facts.
- Use Notion Markdown format (headings with #, lists with -, code with \`\`\`, etc.).
- Be specific and cite relevant details from the context.

Context:
${context}

Generate the answer for the section titled "${title}".`

  const retry = createRetryManager({
    maxRetries: 20,
    initialDelay: 2000,
    maxDelay: 60000,
    backoffMultiplier: 1.5,
    useJitter: true
  })

  const response = await retry.execute(async () => {
    return await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.6,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema: answerSchema
      }
    })
  })

  const text = response.text || "{}"
  try {
    const parsed = JSON.parse(text)
    const answer: AnswerItem = {
      title: parsed.title || title,
      content: parsed.content || ""
    }

    // Validate content length (≥200 words heuristic: ~1000 chars)
    if (answer.content.length < 1000) {
      log.warn("⚠️ Answer content is shorter than expected", {
        title,
        length: answer.content.length
      })
    }

    log.info("✅ Answer written", {
      title,
      contentLength: answer.content.length
    })
    return answer
  } catch (e) {
    log.error("❌ Failed to parse answer response", e)
    throw new Error(
      `Answer generation failed for "${title}": invalid response format`
    )
  }
}
```

### 5) Incremental Notion Page Writer (Option 2: New Slim Agent)

File: `src/ai/agents/notion/notionPageWriterAgent.ts`

````ts
import { createLogger } from "../../../logger"
import { initializeGenAIClient } from "../../core/genAIFactory"
import { convertAllTools } from "../../geminiLive/toolConverter"
import { getMCPToolsFromBackground } from "../../mcp/proxy"

const log = createLogger("NotionPageWriterAgent")

const SYSTEM = `You create ONE Notion page per request using Notion MCP tools.
Rules:
- Properties are flat key-value pairs (string | number | null).
- Content is Notion Markdown (not block JSON).
- If parentPageId is provided, use { "parent": { "page_id": parentPageId } }.
- Return JSON: { "success": true, "pageUrl": "...", "pageId": "..." }`

export async function createMainPage(params: {
  title: string
  videoUrl?: string
  parentPageId?: string
}): Promise<{
  pageId?: string
  pageUrl?: string
  success: boolean
  message?: string
}> {
  return await createSinglePage({
    ...params,
    content: `# ${params.title}\n\nVideo: ${params.videoUrl || ""}`
  })
}

export async function createChildPage(params: {
  parentPageId: string
  title: string
  content: string
}): Promise<{
  pageId?: string
  pageUrl?: string
  success: boolean
  message?: string
}> {
  return await createSinglePage(params)
}

async function createSinglePage(params: {
  title: string
  content: string
  parentPageId?: string
  videoUrl?: string
}): Promise<{
  pageId?: string
  pageUrl?: string
  success: boolean
  message?: string
}> {
  const notionToolsAll = await getMCPToolsFromBackground()
  const notionTools = Object.fromEntries(
    Object.entries(notionToolsAll.tools).filter(([name]) =>
      name.startsWith("notion-")
    )
  )

  const client = await initializeGenAIClient()
  const toolDecls = convertAllTools(notionTools)

  const chat = client.chats.create({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: SYSTEM,
      tools: [{ functionDeclarations: toolDecls }]
    }
  })

  const task = `Create one page with:
- Title: "${params.title}"
- Parent: ${params.parentPageId ? `{ "page_id": "${params.parentPageId}" }` : "none"}
- Properties: ${params.videoUrl ? `{ "Video URL": "${params.videoUrl}" }` : "{}"}
- Content (Notion Markdown):
${params.content}

Return JSON as specified.`

  let resp = await chat.sendMessage({ message: task })

  for (let i = 0; i < 8; i++) {
    const calls = resp.functionCalls || []
    if (!calls.length) break

    const results: any[] = []
    for (const fc of calls) {
      const tool = notionTools[fc.name!]
      if (!tool) {
        results.push({ name: fc.name!, response: { error: "Tool not found" } })
        continue
      }
      try {
        const out = await tool.execute(fc.args)
        results.push({ name: fc.name!, response: out })
      } catch (e: any) {
        results.push({
          name: fc.name!,
          response: { error: e?.message || String(e) }
        })
      }
    }

    resp = await chat.sendMessage({
      message: results.map((r) => ({
        functionResponse: { name: r.name, response: r.response }
      }))
    })
  }

  const text = resp.text || ""
  try {
    const match =
      text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/)
    const json = match ? match[1] || match[0] : "{}"
    const parsed = JSON.parse(json)
    return {
      success: parsed.success !== false,
      pageId: parsed.pageId,
      pageUrl: parsed.pageUrl,
      message: parsed.message
    }
  } catch {
    return { success: text.toLowerCase().includes("success"), message: text }
  }
}
````

### 6) Orchestrator Changes (High‑Signal Excerpt)

In `src/ai/agents/youtubeToNotion/youtubeToNotionAgent.ts`, replace the single-shot generation with staged calls. The following excerpt shows the flow, not the full file.

```ts
import { createLogger } from "../../../logger"
import {
  createChildPage,
  createMainPage
} from "../notion/notionPageWriterAgent"
import { writeAnswer } from "./answerWriterAgent"
import { planQuestions } from "./questionPlannerAgent"
import { detectVideoType, getTemplate } from "./templates"
import { fetchTranscriptDirect } from "./transcript"
import { withTranscriptCache } from "./transcriptCache"
import type { YouTubeToNotionInput, YouTubeToNotionOutput } from "./types"

const log = createLogger("YouTubeToNotionAgent")

export async function executeYouTubeToNotionAgent(
  input: YouTubeToNotionInput
): Promise<YouTubeToNotionOutput> {
  log.info("🎬 Starting YouTube to Notion workflow", {
    videoTitle: input.videoTitle,
    youtubeUrl: input.youtubeUrl
  })

  return await withTranscriptCache(
    input.youtubeUrl,
    // Fetcher function
    async () => {
      const entry = await fetchTranscriptDirect(input.youtubeUrl)
      if (!entry.transcript) {
        throw new Error("Unable to obtain transcript or analyze video.")
      }
      return entry
    },
    // Workflow function
    async (entry) => {
      const transcript = entry.transcript
      const videoTitle = entry.title || input.videoTitle

      // 1. Detect video type and get template
      log.info("🎯 Detecting video type")
      const videoType = detectVideoType(transcript, videoTitle)
      const template = getTemplate(videoType)
      log.info(`📋 Template selected: ${template.name} (${template.format})`)

      // 2. Plan questions
      log.info("🧠 Planning questions")
      const questions = await planQuestions({
        transcript,
        videoTitle,
        videoUrl: input.youtubeUrl,
        template,
        min: 6,
        max: 10
      })

      if (questions.length < 4) {
        log.error("❌ Insufficient questions planned", {
          count: questions.length
        })
        return {
          success: false,
          message: `Planner produced only ${questions.length} questions (minimum 4 required)`,
          error: "PLANNING_FAILED"
        }
      }

      log.info(`✅ ${questions.length} questions planned`)

      // 3. Create main Notion page
      log.info("📄 Creating main Notion page")
      const main = await createMainPage({
        title: `${videoTitle} Notes [Cognito AI]`,
        videoUrl: input.youtubeUrl,
        parentPageId: input.parentPageId
      })

      if (!main.success || !main.pageId) {
        log.error("❌ Failed to create main page", main)
        return {
          success: false,
          message: "Failed to create main Notion page",
          error: "NOTION_MAIN_FAILED"
        }
      }

      log.info("✅ Main page created", {
        pageId: main.pageId,
        pageUrl: main.pageUrl
      })

      // 4. Generate answers and create child pages sequentially
      const createdTitles = new Set<string>()
      const childPageUrls: string[] = []
      let created = 0

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]
        log.info(
          `📝 Processing question ${i + 1}/${questions.length}: ${q.title}`
        )

        // Check for duplicate
        const titleKey = q.title.toLowerCase().trim()
        if (createdTitles.has(titleKey)) {
          log.warn("🔄 Duplicate page title detected, skipping", {
            title: q.title
          })
          continue
        }

        try {
          // Generate answer
          const ans = await writeAnswer({
            title: q.title,
            question: q.question,
            transcript,
            template,
            videoTitle,
            videoUrl: input.youtubeUrl
          })

          // Validate answer length (heuristic: ≥1000 chars ~200 words)
          if (!ans.content || ans.content.length < 1000) {
            log.warn("⚠️ Answer too short, retrying once", {
              title: q.title,
              length: ans.content?.length
            })

            // Retry once
            const retryAns = await writeAnswer({
              title: q.title,
              question: q.question,
              transcript,
              template,
              videoTitle,
              videoUrl: input.youtubeUrl
            })

            if (!retryAns.content || retryAns.content.length < 1000) {
              log.error("❌ Answer still too short after retry, skipping", {
                title: q.title
              })
              continue
            }

            ans.content = retryAns.content
          }

          // Create child page
          const child = await createChildPage({
            parentPageId: main.pageId,
            title: ans.title,
            content: ans.content
          })

          if (child.success) {
            created++
            createdTitles.add(titleKey)
            if (child.pageUrl) childPageUrls.push(child.pageUrl)
            log.info(
              `✅ Created page ${created}/${questions.length}: ${ans.title}`
            )
          } else {
            log.error("❌ Failed to create child page", {
              title: ans.title,
              error: child.message
            })
          }
        } catch (error) {
          log.error("❌ Error processing question", { title: q.title, error })
          // Continue to next question
        }
      }

      const totalPages = created + 1 // +1 for main page
      log.info(`🎉 Workflow complete: ${totalPages} pages created`)

      return {
        success: true,
        mainPageUrl: main.pageUrl,
        pageCount: totalPages,
        videoType,
        childPageUrls,
        message: `Created "${videoTitle}" notes with ${totalPages} pages in Notion`
      }
    }
  )
}
```

### 7) Optional: Extend Existing Notion Creator Tool (Option 1)

If you prefer modifying the existing bulk tool instead of adding `notionPageWriterAgent`, add an optional `mainPageId` to the `parametersJsonSchema` in `notionCreatorAgentTool.ts` and update system instruction logic to “skip main page creation when `mainPageId` is provided; only create the provided `nestedPages` under that parent.”

Snippet (schema addition):

```ts
parametersJsonSchema: {
  type: 'object',
  properties: {
    // existing...
    mainPageId: {
      type: 'string',
      description: 'Optional parent main page id. If provided, agent will only create nested pages under this parent.',
      nullable: true
    }
  },
  required: ['mainPageTitle', 'videoUrl', 'nestedPages']
}
```

System instruction delta:

```md
If "mainPageId" is provided:

- Do NOT create a new main page.
- Use parent: { "page_id": mainPageId } for each nested page.
  Else:
- Create main page first, then children.
```

Either Option 2 (new slim agent) or Option 1 (extend tool) achieves incremental creation; Option 2 avoids altering the stable bulk path.

---

## Implementation Summary & Key Decisions

### Architecture Overview

This refactor transforms the YouTube-to-Notion workflow from a monolithic single-shot generation into a multi-phase pipeline:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. TRANSCRIPT FETCH (with graceful degradation)                │
│    • API call → transcript (if available)                       │
│    • OR (use video analysis when the transipt fails for thi logic if you need
create new function do create but make sure to implenent this logic ) video analysis → transcript-like text                   │
│    • Cache in-memory (keyed by videoId)                         │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. VIDEO TYPE DETECTION & TEMPLATE SELECTION                    │
│    • Heuristic-based (no LLM call)                             │
│    • Uses existing templates.ts (authoritative)                 │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. QUESTION PLANNING (Planner Agent)                            │
│    • Input: transcript + template                               │
│    • LLM: gemini-2.5-flash with structured output              │
│    • Output: 6-10 unique questions (min 4)                      │
│    • De-duplication: case-insensitive title matching            │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. MAIN PAGE CREATION (Notion Page Writer Agent)                │
│    • Create single main page                                    │
│    • Capture pageId from tool response                          │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. ANSWER GENERATION + CHILD PAGE CREATION (Sequential Loop)    │
│    For each question:                                           │
│    • Check duplicate title → skip if exists                     │
│    • Generate answer (Writer Agent) with retrieval if >6k chars│
│    • Validate length (≥1000 chars) → retry once if short        │
│    • Create child page under main pageId                        │
│    • Track success + log progress                               │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. CLEANUP & FINALIZE                                           │
│    • Return summary (URLs, count, type)                         │
│    • Clear transcript cache (finally block)                     │
└─────────────────────────────────────────────────────────────────┘
```

### Key Technical Decisions

#### 1. **Transcript API Response Handling**

- **Decision:** Safely handle null `duration`, `title`, and `transcript` fields
- **Fallback:** If no transcript, degrade to video analysis using existing `analyzeYouTubeVideo` from `youtubeAgentTool.ts`
- **Reasoning:** Provides robustness for videos without captions while maintaining quality

#### 2. **Run-Scoped Caching**

- **Decision:** Key cache by `videoId` (not full URL)
- **Behavior:** Always refetch at workflow start; clear in `finally` block
- **Concurrency:** Supports multiple browser windows running different videos simultaneously
- **Edge Case:** Same video in parallel windows → each gets own cache entry, last to finish cleans up

#### 3. **Structured Output Mode**

- **Decision:** Use Gemini's native structured output (`responseMimeType: 'application/json'` + `responseSchema`) for both planner and writer agents
- **Link:** [Gemini Structured Output Docs](https://ai.google.dev/gemini-api/docs/structured-output?example=recipe)
- **Benefit:** Eliminates JSON parsing errors; guaranteed valid format; no manual regex extraction

#### 4. **Simple Retrieval for Long Transcripts**

- **Decision:** Auto-enable retrieval when `transcript.length > 6000` chars
- **Method:** Split into overlapping windows (4000 chars, 500 overlap), keyword-score, return top 2-3
- **Reasoning:** Bounds token usage for answer generation; prevents context overflow

#### 5. **Incremental Notion Page Creation (Option 2)**

- **Decision:** Create new slim `notionPageWriterAgent.ts` instead of modifying existing bulk tool
- **API:** `createMainPage()` and `createChildPage()` with simplified function-calling loop
- **Reasoning:** Avoids risk to stable bulk-creator; enables per-page progress tracking

#### 6. **Sequential Child Page Creation**

- **Decision:** Create pages one-by-one (not parallel)
- **Retry:** 10 retries per Notion tool call; if page fails, log and continue
- **De-duplication:** Track created titles in Set; skip if duplicate detected
- **Reasoning:** Simplifies error handling; ensures order; prevents duplicate pages

#### 7. **Validation & Retry Policy**

- **Question Planning:** Min 4 questions; fail workflow if below threshold
- **Answer Generation:** Min 1000 chars (~200 words); retry once if short; skip if still invalid
- **Page Creation:** Fail main page → abort workflow; fail child page → continue
- **Retry Counts:** AI generation (20 retries), Notion tools (10 retries)

#### 8. **Templates & Type Detection**

- **Decision:** Keep existing `templates.ts` and `detectVideoType` as authoritative (no changes)
- **Reasoning:** Already proven; heuristic-based (fast); no LLM call overhead

### File Structure

```
src/ai/agents/youtubeToNotion/
├── youtubeToNotionAgent.ts          # Orchestrator (UPDATED)
├── transcriptCache.ts                # NEW: Run-scoped cache
├── transcript.ts                     # NEW: Fetch with degradation
├── questionPlannerAgent.ts           # NEW: Planner sub-agent
├── answerWriterAgent.ts              # NEW: Writer sub-agent
├── simpleRetrieval.ts                # NEW: Keyword-based retrieval
├── types.ts                          # UPDATED: Add QuestionItem, AnswerItem, childPageUrls
└── templates.ts                      # UNCHANGED: Existing templates

src/ai/agents/notion/
├── notionCreatorAgent.ts             # UNCHANGED: Bulk creator
├── notionCreatorAgentTool.ts         # UNCHANGED: Tool wrapper
└── notionPageWriterAgent.ts          # NEW: Single-page creator
```

### Testing Strategy

1. **Unit Tests per Agent:**

   - `transcriptCache.ts`: Test cache lifecycle, cleanup, concurrent access
   - `questionPlannerAgent.ts`: Validate de-duplication, min/max bounds, template compliance
   - `answerWriterAgent.ts`: Test retrieval trigger, length validation, retry logic
   - `notionPageWriterAgent.ts`: Mock MCP tools, verify pageId extraction

2. **Integration Tests:**

   - Full workflow with mock transcript API (happy path)
   - Null transcript → degradation to video analysis
   - Short answers → retry mechanism
   - Duplicate titles → skip logic
   - Main page creation failure → workflow abort

3. **End-to-End Tests:**
   - Real YouTube video (with transcript)
   - Real YouTube video (without transcript)
   - Long transcript (>6k chars) → retrieval
   - Multiple browser windows running concurrently

### Performance Characteristics

- **Latency:** Sequential page creation adds ~5-10s per child page (LLM + Notion API)
- **Token Usage:** Reduced via retrieval for long transcripts (4k context vs 20k+ full transcript)
- **Error Resilience:** Partial success possible (main page + N child pages even if M fail)
- **Progress Visibility:** Logs per phase with emoji indicators for user feedback

### Migration Path

Since this is built as the primary flow (no feature flags):

1. **Phase 1 (Week 1):** Implement transcript cache + fetch utility
2. **Phase 2 (Week 1):** Implement planner agent with structured output
3. **Phase 3 (Week 2):** Implement writer agent + retrieval utility
4. **Phase 4 (Week 2):** Implement Notion page writer agent
5. **Phase 5 (Week 3):** Wire orchestration in `youtubeToNotionAgent.ts`
6. **Phase 6 (Week 3):** Integration testing + fixes
7. **Phase 7 (Week 4):** End-to-end testing on sample videos
8. **Phase 8 (Week 4):** Deploy to production

### Open Questions Resolved

All 15 clarifying questions have been answered and incorporated into this plan:

✅ Transcript API contract and null handling  
✅ Graceful degradation to video analysis  
✅ Cache keying by videoId for concurrent windows  
✅ Single URL per run (no multi-video batching)  
✅ Heuristic video type detection (no LLM)  
✅ Existing templates as authoritative source  
✅ Question count: 6-10 default, min 4  
✅ Retrieval auto-trigger at >6k chars  
✅ Option 2: New slim Notion agent  
✅ ParentPageId from tool response  
✅ Sequential child page creation  
✅ Retry counts: AI=20, Notion=10  
✅ No feature flags (primary flow)  
✅ Output includes childPageUrls array  
✅ Duplicate prevention via Set tracking

---

**Next Steps:** Begin Phase 1 implementation (`transcriptCache.ts` + `transcript.ts`).
