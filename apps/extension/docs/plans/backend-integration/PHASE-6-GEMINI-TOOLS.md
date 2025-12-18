# Phase 6: Gemini Tools for Content Script Features

## Status: ✅ IMPLEMENTED

## Overview

This phase adds Gemini built-in tool support (URL Context, Google Search grounding) to the content script features (Writer, Rewriter, Summarizer) in backend mode.

**Goal:** Enable URL context fetching and Google Search grounding in backend mode, matching BYOK feature parity.

**Scope:**
- ✅ URL Context tool (fetch and analyze URLs) - **IMPLEMENTED**
- ✅ Google Search grounding (real-time web data) - **IMPLEMENTED**
- ✅ Supermemory search integration (function calling or pre-search) - N/A for backend (local-only)
- ❌ Image attachments (requires multimodal streaming, complex)

## Implementation Summary

### Backend Changes (`packages/backend-vercel/`)
- **New Service:** `src/services/geminiTools.ts` - Handles Gemini built-in tools (url_context, google_search)
- **Updated Routes:** `src/routes/ai.ts` - Write, Rewrite, Summarize endpoints now support `enableUrlContext` and `enableGoogleSearch` options

### Extension Changes (`apps/extension/`)
- **Updated:** `src/background/writer/backendWriter.ts` - Added tool options and grounding metadata support
- **Updated:** `src/background/rewriter/backendRewriter.ts` - Added tool options and grounding metadata support
- **Updated:** `src/background/summarizer/backendSummarizer.ts` - Added tool options and grounding metadata support

## Prerequisites

- Phase 5 completed (basic Writer, Rewriter, Summarizer endpoints)
- Understanding of Gemini's built-in tools

---

## Gemini Built-in Tools Overview

Gemini API provides two powerful built-in tools:

### 1. URL Context (`url_context`)
- Fetches and analyzes content from URLs mentioned in the prompt
- Useful for: writing about a webpage, citing sources, summarizing links
- Request format:
```json
{
  "tools": [{ "url_context": {} }]
}
```

### 2. Google Search Grounding (`google_search`)
- Searches Google and incorporates real-time data
- Useful for: current events, facts, recent information
- Request format:
```json
{
  "tools": [{ "google_search": {} }]
}
```

### Important Limitation
**Built-in tools cannot be mixed with function calling** in the same request.
When using `url_context` or `google_search`, custom functions (like memory search) must use a pre-search approach instead.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PHASE 6 FLOW (Backend with Tools)                    │
│                                                                         │
│  ┌─────────────────┐                           ┌──────────────────────┐ │
│  │   Extension     │   POST /api/ai/write      │   Vercel Backend     │ │
│  │                 │   {                       │                      │ │
│  │   Writer UI     │     prompt: "...",        │   1. Parse request   │ │
│  │   ────────────  │     enableUrlContext,     │   2. Build tools[]   │ │
│  │   [x] URL       │     enableGoogleSearch,   │   3. Configure model │ │
│  │   [x] Search    │   }                       │   4. Stream response │ │
│  └────────┬────────┘──────────────────────────▶│                      │ │
│           │                                    └──────────┬───────────┘ │
│           │                                               │             │
│           │◀──────────────────────────────────────────────┘             │
│           │   Streaming response (with grounded content)                │
│           ▼                                                             │
│   Display generated text with citations/sources                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Update Backend Endpoints with Tools Support

**File:** `packages/backend-vercel/src/routes/ai.ts`

Update the endpoints from Phase 5 to support Gemini tools:

```typescript
// ============================================================================
// Tool Configuration Helpers
// ============================================================================

interface GeminiTool {
    url_context?: Record<string, never>;
    google_search?: Record<string, never>;
}

/**
 * Build Gemini tools array based on request options
 */
function buildGeminiTools(options: {
    enableUrlContext?: boolean;
    enableGoogleSearch?: boolean;
}): GeminiTool[] {
    const tools: GeminiTool[] = [];
    
    if (options.enableUrlContext) {
        tools.push({ url_context: {} });
    }
    if (options.enableGoogleSearch) {
        tools.push({ google_search: {} });
    }
    
    return tools;
}

// ============================================================================
// Updated Write Endpoint with Tools
// ============================================================================

/**
 * POST /api/ai/write
 * 
 * Generate text with optional Gemini tools (URL context, Google Search).
 */
router.post('/write', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!checkAIChatRateLimit(ip)) {
        return res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please wait a moment and try again.',
            retryAfter: AI_RATE_LIMIT_WINDOW / 1000,
        });
    }

    try {
        const parsed = WriteRequestSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: 'Invalid request',
                message: parsed.error.message,
            });
        }

        const { 
            prompt, 
            tone, 
            platform, 
            pageContext, 
            enableUrlContext, 
            enableGoogleSearch 
        } = parsed.data;

        if (!config.googleAiApiKey) {
            console.error('[AI Write] GOOGLE_AI_API_KEY not configured');
            return res.status(500).json({
                error: 'Server configuration error',
                message: 'AI service not properly configured',
            });
        }

        const tools = buildGeminiTools({ enableUrlContext, enableGoogleSearch });

        console.log('[AI Write] Processing request:', {
            promptLength: prompt.length,
            tone,
            platform,
            tools: tools.length > 0 ? tools.map(t => Object.keys(t)[0]) : [],
            ip: typeof ip === 'string' ? ip.substring(0, 20) : 'unknown',
        });

        // Build system prompt
        let systemPrompt = 'You are a helpful writing assistant. Generate text based on the user\'s prompt.';
        if (tone && TONE_INSTRUCTIONS[tone]) {
            systemPrompt += ` ${TONE_INSTRUCTIONS[tone]}`;
        }
        if (platform && PLATFORM_INSTRUCTIONS[platform]) {
            systemPrompt += ` ${PLATFORM_INSTRUCTIONS[platform]}`;
        }
        if (pageContext) {
            systemPrompt += ` Context: Writing for ${pageContext.title} (${pageContext.domain}).`;
        }
        systemPrompt += ' Output ONLY the generated text, no explanations or preamble.';

        // Add tool-specific instructions
        if (enableUrlContext) {
            systemPrompt += ' When URLs are mentioned, fetch and analyze their content to inform your response.';
        }
        if (enableGoogleSearch) {
            systemPrompt += ' Use Google Search to find current, accurate information when needed.';
        }

        const { createGoogleGenerativeAI, streamText } = await getAIModules();
        const google = createGoogleGenerativeAI({ apiKey: config.googleAiApiKey });
        
        // Use a model that supports tools well
        const model = google('gemini-2.0-flash', {
            // Pass tools to the model configuration
        });

        // For Gemini tools, we need to use the raw API
        // AI SDK doesn't directly support url_context and google_search
        const result = await streamWithGeminiTools({
            model: 'gemini-2.0-flash',
            prompt,
            systemPrompt,
            tools,
            maxTokens: 2048,
            apiKey: config.googleAiApiKey,
        });

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Stream the response
        for await (const chunk of result) {
            res.write(formatAsAISDKStream(chunk));
        }
        res.end();

    } catch (error) {
        console.error('[AI Write] Error:', error instanceof Error ? error.message : 'Unknown error');
        return res.status(500).json({
            error: 'Write generation failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
```

---

### Step 2: Create Gemini Tools Service

**File:** `packages/backend-vercel/src/services/geminiTools.ts` (NEW)

```typescript
/**
 * Gemini Tools Service
 * 
 * Handles streaming with Gemini's built-in tools (url_context, google_search)
 * since AI SDK doesn't natively support these.
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiTool {
    url_context?: Record<string, never>;
    google_search?: Record<string, never>;
}

interface StreamWithToolsOptions {
    model: string;
    prompt: string;
    systemPrompt: string;
    tools: GeminiTool[];
    maxTokens: number;
    apiKey: string;
}

interface GeminiStreamChunk {
    text?: string;
    groundingMetadata?: {
        webSearchQueries?: string[];
        searchEntryPoint?: { renderedContent?: string };
        groundingSupports?: Array<{
            segment: { text: string };
            groundingChunkIndices: number[];
        }>;
    };
}

/**
 * Stream text generation with Gemini built-in tools
 */
export async function* streamWithGeminiTools(
    options: StreamWithToolsOptions
): AsyncGenerator<GeminiStreamChunk, void, unknown> {
    const { model, prompt, systemPrompt, tools, maxTokens, apiKey } = options;

    const url = `${GEMINI_API_BASE}/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const body = {
        systemInstruction: {
            parts: [{ text: systemPrompt }],
        },
        contents: [
            {
                role: 'user',
                parts: [{ text: prompt }],
            },
        ],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: maxTokens,
            topP: 0.95,
        },
        ...(tools.length > 0 && { tools }),
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    const data = JSON.parse(line.slice(6));
                    const candidate = data?.candidates?.[0];

                    if (candidate?.content?.parts?.[0]?.text) {
                        yield {
                            text: candidate.content.parts[0].text,
                            groundingMetadata: candidate.groundingMetadata,
                        };
                    }
                } catch {
                    // Skip malformed chunks
                }
            }
        }
    }
}

/**
 * Non-streaming generation with Gemini tools
 */
export async function generateWithGeminiTools(
    options: Omit<StreamWithToolsOptions, 'maxTokens'> & { maxTokens?: number }
): Promise<{ text: string; groundingMetadata?: unknown }> {
    const { model, prompt, systemPrompt, tools, maxTokens = 2048, apiKey } = options;

    const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`;

    const body = {
        systemInstruction: {
            parts: [{ text: systemPrompt }],
        },
        contents: [
            {
                role: 'user',
                parts: [{ text: prompt }],
            },
        ],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: maxTokens,
            topP: 0.95,
        },
        ...(tools.length > 0 && { tools }),
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];

    if (!candidate?.content?.parts?.[0]?.text) {
        throw new Error('No text generated');
    }

    return {
        text: candidate.content.parts[0].text,
        groundingMetadata: candidate.groundingMetadata,
    };
}

/**
 * Format a chunk as AI SDK stream format
 */
export function formatAsAISDKStream(chunk: GeminiStreamChunk): string {
    if (chunk.text) {
        return `0:${JSON.stringify(chunk.text)}\n`;
    }
    return '';
}
```

---

### Step 3: Update Rewrite Endpoint with Tools

**File:** `packages/backend-vercel/src/routes/ai.ts` (Update rewrite endpoint)

```typescript
/**
 * POST /api/ai/rewrite
 * 
 * Rewrite text with optional Gemini tools for context.
 * Non-streaming for replace-in-place behavior.
 */
router.post('/rewrite', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!checkAIChatRateLimit(ip)) {
        return res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please wait a moment and try again.',
            retryAfter: AI_RATE_LIMIT_WINDOW / 1000,
        });
    }

    try {
        const parsed = RewriteRequestSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: 'Invalid request',
                message: parsed.error.message,
            });
        }

        const { text, preset, instruction, enableUrlContext, enableGoogleSearch } = parsed.data;

        if (!config.googleAiApiKey) {
            console.error('[AI Rewrite] GOOGLE_AI_API_KEY not configured');
            return res.status(500).json({
                error: 'Server configuration error',
                message: 'AI service not properly configured',
            });
        }

        const tools = buildGeminiTools({ enableUrlContext, enableGoogleSearch });

        console.log('[AI Rewrite] Processing request:', {
            textLength: text.length,
            preset,
            hasInstruction: !!instruction,
            tools: tools.length > 0 ? tools.map(t => Object.keys(t)[0]) : [],
            ip: typeof ip === 'string' ? ip.substring(0, 20) : 'unknown',
        });

        // Build prompt and system prompt
        const rewriteInstruction = instruction || (preset && PRESET_PROMPTS[preset]) || PRESET_PROMPTS.improve;
        
        let systemPrompt = `You are a text rewriting assistant. ${rewriteInstruction}
If the text is a question or prompt, transform the question/prompt itself - do NOT answer it.
Output ONLY the rewritten text, no explanations.`;

        // Add tool-specific instructions
        if (enableUrlContext) {
            systemPrompt += ' If the text contains URLs, use their content to inform the rewrite.';
        }
        if (enableGoogleSearch) {
            systemPrompt += ' Use search to verify facts or find better alternatives when appropriate.';
        }

        // Use tools if enabled, otherwise use AI SDK
        if (tools.length > 0) {
            const result = await generateWithGeminiTools({
                model: 'gemini-2.0-flash',
                prompt: text,
                systemPrompt,
                tools,
                maxTokens: Math.max(text.length * 2, 500),
                apiKey: config.googleAiApiKey,
            });

            return res.json({
                text: result.text,
                preset,
                groundingMetadata: result.groundingMetadata,
            });
        } else {
            // No tools - use AI SDK (simpler)
            const { createGoogleGenerativeAI, generateText } = await getAIModules();
            const google = createGoogleGenerativeAI({ apiKey: config.googleAiApiKey });
            const model = google('gemini-2.0-flash');

            const result = await generateText({
                model,
                messages: [{ role: 'user', content: text }],
                system: systemPrompt,
                maxTokens: Math.max(text.length * 2, 500),
            });

            return res.json({
                text: result.text,
                preset,
            });
        }
    } catch (error) {
        console.error('[AI Rewrite] Error:', error instanceof Error ? error.message : 'Unknown error');
        return res.status(500).json({
            error: 'Rewrite failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
```

---

### Step 4: Update Extension Backend Clients

**File:** `apps/extension/src/background/writer/backendWriter.ts` (UPDATE)

```typescript
/**
 * Backend Writer Client
 * Routes write requests to Vercel backend with optional Gemini tools
 */

import { createLogger } from '~logger';
import type { WriterOptions } from './geminiWriter';

const log = createLogger('BackendWriter', 'BACKGROUND');

const BACKEND_URL = import.meta.env.WXT_BACKEND_API_URL || 'https://cognito-ai-api.vercel.app';

export interface BackendWriteOptions extends Pick<WriterOptions, 'tone' | 'pageContext'> {
    enableUrlContext?: boolean;
    enableGoogleSearch?: boolean;
}

/**
 * Generate text using backend with optional Gemini tools (streaming)
 */
export async function* generateWithBackend(
    prompt: string,
    options: BackendWriteOptions = {}
): AsyncGenerator<string, void, unknown> {
    const { enableUrlContext, enableGoogleSearch, ...otherOptions } = options;
    
    const hasTools = enableUrlContext || enableGoogleSearch;
    log.info('Generating with backend:', { 
        promptLength: prompt.length, 
        hasTools,
        enableUrlContext,
        enableGoogleSearch,
        ...otherOptions 
    });

    const response = await fetch(`${BACKEND_URL}/api/ai/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt,
            tone: options.tone,
            platform: options.pageContext?.platform,
            pageContext: options.pageContext,
            enableUrlContext,
            enableGoogleSearch,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Backend error: ${response.status}`);
    }

    // Parse AI SDK stream format
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
            if (line.startsWith('0:')) {
                try {
                    const text = JSON.parse(line.slice(2));
                    yield text;
                } catch {
                    // Skip malformed chunks
                }
            }
        }
    }

    log.info('Backend generation complete', { hadTools: hasTools });
}
```

**File:** `apps/extension/src/background/rewriter/backendRewriter.ts` (UPDATE)

```typescript
/**
 * Backend Rewriter Client
 * Routes rewrite requests to Vercel backend with optional Gemini tools
 */

import { createLogger } from '~logger';
import type { RewriterOptions } from './geminiRewriter';

const log = createLogger('BackendRewriter', 'BACKGROUND');

const BACKEND_URL = import.meta.env.WXT_BACKEND_API_URL || 'https://cognito-ai-api.vercel.app';

export interface BackendRewriteOptions extends Pick<RewriterOptions, 'preset' | 'instruction'> {
    enableUrlContext?: boolean;
    enableGoogleSearch?: boolean;
}

export interface BackendRewriteResult {
    text: string;
    preset?: string;
    groundingMetadata?: {
        webSearchQueries?: string[];
        groundingSupports?: Array<{
            segment: { text: string };
            groundingChunkIndices: number[];
        }>;
    };
}

/**
 * Rewrite text using backend with optional Gemini tools (non-streaming)
 */
export async function rewriteWithBackend(
    text: string,
    options: BackendRewriteOptions = {}
): Promise<BackendRewriteResult> {
    const { enableUrlContext, enableGoogleSearch } = options;
    const hasTools = enableUrlContext || enableGoogleSearch;

    log.info('Rewriting with backend:', { 
        textLength: text.length, 
        preset: options.preset,
        hasTools,
        enableUrlContext,
        enableGoogleSearch,
    });

    const response = await fetch(`${BACKEND_URL}/api/ai/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text,
            preset: options.preset,
            instruction: options.instruction,
            enableUrlContext,
            enableGoogleSearch,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Backend error: ${response.status}`);
    }

    const result = await response.json();
    log.info('Backend rewrite complete:', { 
        resultLength: result.text?.length,
        hasGroundingMetadata: !!result.groundingMetadata,
    });

    return result;
}
```

---

### Step 5: Handle Grounding Metadata in UI (Optional Enhancement)

When using Google Search grounding, the response includes metadata about sources. The UI can optionally display this:

**File:** `apps/extension/src/components/features/selection-panel/panels/RewritePanel.tsx` (Example)

```tsx
interface GroundingMetadata {
    webSearchQueries?: string[];
    groundingSupports?: Array<{
        segment: { text: string };
    }>;
}

// In the component:
const [groundingMetadata, setGroundingMetadata] = useState<GroundingMetadata | null>(null);

// After rewrite completes:
if (result.groundingMetadata) {
    setGroundingMetadata(result.groundingMetadata);
}

// In the UI:
{groundingMetadata?.webSearchQueries && (
    <div className="text-xs text-muted-foreground mt-2">
        <span className="font-medium">Searched:</span>{' '}
        {groundingMetadata.webSearchQueries.join(', ')}
    </div>
)}
```

---

## Tool Usage Examples

### Writer with URL Context
```
User prompt: "Write a summary of https://example.com/article"
Tools: [{ url_context: {} }]

Backend will:
1. Fetch the URL content
2. Analyze it
3. Generate a summary based on actual content
```

### Writer with Google Search
```
User prompt: "Write about the latest developments in AI"
Tools: [{ google_search: {} }]

Backend will:
1. Search Google for current AI news
2. Incorporate real-time information
3. Generate grounded, up-to-date content
```

### Rewriter with Both Tools
```
User input: "The article at https://example.com says AI is growing fast"
Options: { enableUrlContext: true, enableGoogleSearch: true }
Tools: [{ url_context: {} }, { google_search: {} }]

Backend will:
1. Verify the URL content
2. Search for current AI growth data
3. Rewrite with accurate, sourced information
```

---

## Rate Limiting Considerations

Tool-enabled requests are more expensive (more API tokens, external fetches):

| Request Type | Suggested Weight |
|--------------|-----------------|
| Basic write/rewrite | 1x |
| With URL context | 2x |
| With Google Search | 2x |
| With both tools | 3x |

Consider weighted rate limiting:

```typescript
function getRequestWeight(options: { enableUrlContext?: boolean; enableGoogleSearch?: boolean }): number {
    let weight = 1;
    if (options.enableUrlContext) weight += 1;
    if (options.enableGoogleSearch) weight += 1;
    return weight;
}

function checkWeightedRateLimit(ip: string, weight: number): boolean {
    const current = getRateLimitCount(ip);
    const limit = 30; // requests per minute
    return (current + weight) <= limit;
}
```

---

## Testing Checklist

### Backend Testing
- [ ] `/api/ai/write` with `enableUrlContext: true` fetches URL content
- [ ] `/api/ai/write` with `enableGoogleSearch: true` includes grounded data
- [ ] `/api/ai/rewrite` with tools returns `groundingMetadata`
- [ ] Both tools can be enabled simultaneously
- [ ] Error handling for failed URL fetches
- [ ] Error handling for search failures

### Extension Testing
- [ ] Writer UI shows URL context toggle
- [ ] Writer UI shows Google Search toggle  
- [ ] Rewriter works with both tools enabled
- [ ] Grounding metadata displays in UI (if implemented)
- [ ] Toggle states persist in settings

### Integration Testing
- [ ] End-to-end: Write with URL → grounded content
- [ ] End-to-end: Rewrite with search → verified facts
- [ ] Rate limiting respects tool weights
- [ ] Fallback when tools fail

---

## Feature Parity Matrix (Updated)

| Feature | BYOK | Backend Mode (Phase 6) |
|---------|------|------------------------|
| **Writer** |
| Basic generation | ✅ | ✅ |
| Tone selection | ✅ | ✅ |
| Platform detection | ✅ | ✅ |
| URL context (tool) | ✅ | ✅ |
| Google Search grounding | ✅ | ✅ |
| Supermemory search | ✅ | ❌ (requires extension memory) |
| Attachments (images) | ✅ | ❌ (not planned) |
| **Rewriter** |
| All presets | ✅ | ✅ |
| Custom instructions | ✅ | ✅ |
| URL context | ✅ | ✅ |
| Google Search | ✅ | ✅ |
| **Summarizer** |
| All summary types | ✅ | ✅ |
| All lengths | ✅ | ✅ |

---

## Success Criteria

Phase 6 is complete when:

1. **URL Context works** in backend mode for Writer and Rewriter
2. **Google Search grounding works** in backend mode
3. **Both tools can be combined** in a single request
4. **Grounding metadata** is returned for search-enabled requests
5. **UI toggles** control tool usage
6. **Rate limiting** accounts for tool usage weight

---

## Known Limitations

1. **Supermemory Search**: Cannot work in backend mode since memories are stored locally in the extension. Would require:
   - Backend memory storage (privacy implications)
   - Or forwarding memory queries back to extension (complex)

2. **Image Attachments**: Requires multimodal request handling. Phase 6 focuses on text tools.

3. **Code Execution**: Gemini's code execution tool exists but is not included (security concerns on shared backend).

---

## Future Considerations (Phase 7+)

### Supermemory Backend Integration
- Store memories in cloud (opt-in, privacy-conscious)
- Sync memories across devices
- Enable memory search in backend mode

### Advanced Tool Features
- Citation formatting in responses
- Source link display
- Search query refinement

### Analytics
- Track tool usage per user
- Monitor grounding quality
- A/B test tool-enabled vs basic responses

---

## Next Steps

Once Phase 6 is complete, content script features have full tool parity with BYOK mode (except local-only features like Supermemory).

→ **Phase 7:** Analytics and usage dashboards
→ **Phase 8:** User accounts and premium tiers
→ **Phase 9:** Supermemory cloud sync (optional)
