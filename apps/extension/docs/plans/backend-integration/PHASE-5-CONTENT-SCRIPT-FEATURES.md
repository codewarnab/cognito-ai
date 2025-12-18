# Phase 5: Content Script Features (Writer, Rewriter, Summarizer)

## Overview

This phase adds backend mode support for content script features that currently rely on BYOK credentials. These features run in webpage contexts (via content scripts) and use message passing to background script handlers.

**Goal:** Enable Writer, Rewriter, and Summarizer features without requiring user API keys.

**Scope:**
- ✅ Writer (text generation with streaming)
- ✅ Rewriter (text transformation with presets)
- ✅ Summarizer (text summarization with types/lengths)
- ✅ All provider features (URL context, Google Search grounding)
- ❌ Vertex AI support (remains BYOK-only for enterprise users)

## Prerequisites

- Phase 1 (basic backend chat) completed
- Understanding of current content script → background → Gemini API flow

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       CURRENT FLOW (BYOK)                               │
│                                                                         │
│  ┌─────────────────┐    Port     ┌─────────────────┐    HTTP    ┌─────┐│
│  │ Content Script  │────────────▶│ Background      │───────────▶│Gemini│
│  │ (Selection UI)  │◀────────────│ (Handler +      │◀───────────│ API ││
│  └─────────────────┘   Stream    │  GeminiWriter)  │   Stream   └─────┘│
│                                  └─────────────────┘                    │
│                                         │                               │
│                                         ▼                               │
│                                  Uses User's API Key                    │
│                                  from chrome.storage                    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Target Architecture (Backend Mode)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       TARGET FLOW (Backend Mode)                        │
│                                                                         │
│  ┌─────────────────┐    Port     ┌─────────────────┐    HTTP    ┌─────┐│
│  │ Content Script  │────────────▶│ Background      │───────────▶│Vercel│
│  │ (Selection UI)  │◀────────────│ (Handler +      │◀───────────│Backend│
│  └─────────────────┘   Stream    │  BackendWriter) │   Stream   └─────┘│
│                                  └─────────────────┘                    │
│                                         │                 │             │
│                                         ▼                 ▼             │
│                                  Checks useBackendMode    Uses Server   │
│                                  from settings store      API Key       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Files to Modify/Create

### Extension Files

| File | Action | Purpose |
|------|--------|---------|
| `src/background/writer/backendWriter.ts` | NEW | Backend mode writer client |
| `src/background/rewriter/backendRewriter.ts` | NEW | Backend mode rewriter client |
| `src/background/summarizer/backendSummarizer.ts` | NEW | Backend mode summarizer client |
| `src/background/writer/handler.ts` | MODIFY | Route to backend when enabled |
| `src/background/rewriter/handler.ts` | MODIFY | Route to backend when enabled |
| `src/background/summarizer/handler.ts` | MODIFY | Route to backend when enabled |

### Backend Files (Vercel)

| File | Action | Purpose |
|------|--------|---------|
| `src/routes/ai.ts` | MODIFY | Add /write, /rewrite, /summarize endpoints |
| `src/services/ai.ts` | MODIFY | Add streaming generation helpers |

---

## Implementation Steps

### Step 1: Backend Endpoints

**File:** `packages/backend-vercel/src/routes/ai.ts`

> [!NOTE]
> Add three new endpoints to the existing `src/routes/ai.ts` file.
> All endpoints follow the same patterns as `/api/ai/chat`.

```typescript
// Add to src/routes/ai.ts

import { z } from 'zod';

// ============================================================================
// Schema Definitions
// ============================================================================

const WriteRequestSchema = z.object({
    prompt: z.string().min(1),
    tone: z.enum(['professional', 'casual', 'formal', 'friendly']).optional(),
    platform: z.string().optional(),
    pageContext: z.object({
        title: z.string(),
        url: z.string(),
        domain: z.string(),
        platform: z.string().optional(),
    }).optional(),
    enableUrlContext: z.boolean().optional(),
    enableGoogleSearch: z.boolean().optional(),
});

const RewriteRequestSchema = z.object({
    text: z.string().min(1),
    preset: z.enum([
        'shorter', 'longer', 'professional', 'casual',
        'improve', 'simplify', 'enthusiastic', 'conversational'
    ]).optional(),
    instruction: z.string().optional(),
    enableUrlContext: z.boolean().optional(),
    enableGoogleSearch: z.boolean().optional(),
});

const SummarizeRequestSchema = z.object({
    text: z.string().min(1),
    summaryType: z.enum(['key-points', 'tl-dr', 'headline', 'teaser']).default('tl-dr'),
    summaryLength: z.enum(['short', 'medium', 'long']).default('medium'),
    pageContext: z.object({
        title: z.string(),
        url: z.string(),
        domain: z.string(),
    }).optional(),
});

// ============================================================================
// Prompt Builders
// ============================================================================

const TONE_INSTRUCTIONS: Record<string, string> = {
    professional: 'Use a professional, business-appropriate tone.',
    casual: 'Use a casual, relaxed tone. Be friendly and conversational.',
    formal: 'Use a formal tone. Be precise, respectful, and proper.',
    friendly: 'Use a warm, friendly tone. Be approachable and personable.',
};

const PLATFORM_INSTRUCTIONS: Record<string, string> = {
    Gmail: 'You are writing an email. Be clear, professional, and include appropriate greetings/closings.',
    LinkedIn: 'You are writing for a professional network. Be engaging and business-appropriate.',
    Twitter: 'You are writing a tweet. Be concise (under 280 chars if possible) and engaging.',
    GitHub: 'You are writing for developers. Be technical and clear.',
    Slack: 'You are writing a workplace message. Be concise and professional.',
    Discord: 'You are writing a chat message. Be casual and conversational.',
    Web: 'You are writing general web content. Be clear and helpful.',
};

const PRESET_PROMPTS: Record<string, string> = {
    shorter: 'Make this text shorter and more concise while preserving the key meaning.',
    longer: 'Expand this text by adding more detail, context, and elaboration.',
    professional: 'Rewrite this in a more professional and formal tone.',
    casual: 'Rewrite this in a more casual and friendly tone.',
    improve: 'Improve this text by fixing grammar, clarity, and flow.',
    simplify: 'Simplify this text for easier understanding.',
    enthusiastic: 'Rewrite this in a more enthusiastic and positive tone.',
    conversational: 'Rewrite this in a more natural, conversational style.',
};

const SUMMARY_TYPE_INSTRUCTIONS: Record<string, string> = {
    'key-points': 'Extract the key points from the text as a bulleted list.',
    'tl-dr': 'Provide a concise TL;DR summary of the text in 2-3 sentences.',
    'headline': 'Create a single headline that captures the main idea.',
    'teaser': 'Write a brief teaser that would make someone want to read more.',
};

const SUMMARY_LENGTH_TOKENS: Record<string, number> = {
    short: 100,
    medium: 250,
    long: 500,
};

// ============================================================================
// Endpoints
// ============================================================================

/**
 * POST /api/ai/write
 * 
 * Generate text based on prompt with optional tone and platform context.
 * Streams response back compatible with AI SDK.
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

        const { prompt, tone, platform, pageContext, enableUrlContext, enableGoogleSearch } = parsed.data;

        if (!config.googleAiApiKey) {
            console.error('[AI Write] GOOGLE_AI_API_KEY not configured');
            return res.status(500).json({
                error: 'Server configuration error',
                message: 'AI service not properly configured',
            });
        }

        console.log('[AI Write] Processing request:', {
            promptLength: prompt.length,
            tone,
            platform,
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

        const { createGoogleGenerativeAI, streamText } = await getAIModules();
        const google = createGoogleGenerativeAI({ apiKey: config.googleAiApiKey });
        const model = google('gemini-2.0-flash');

        const result = streamText({
            model,
            messages: [{ role: 'user', content: prompt }],
            system: systemPrompt,
            maxTokens: 2048,
        });

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        return result.pipeDataStreamToResponse(res);
    } catch (error) {
        console.error('[AI Write] Error:', error instanceof Error ? error.message : 'Unknown error');
        return res.status(500).json({
            error: 'Write generation failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/ai/rewrite
 * 
 * Rewrite text with preset or custom instruction.
 * Non-streaming response for replace-in-place behavior.
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

        const { text, preset, instruction } = parsed.data;

        if (!config.googleAiApiKey) {
            console.error('[AI Rewrite] GOOGLE_AI_API_KEY not configured');
            return res.status(500).json({
                error: 'Server configuration error',
                message: 'AI service not properly configured',
            });
        }

        console.log('[AI Rewrite] Processing request:', {
            textLength: text.length,
            preset,
            hasInstruction: !!instruction,
            ip: typeof ip === 'string' ? ip.substring(0, 20) : 'unknown',
        });

        // Build prompt
        let rewriteInstruction = instruction || (preset && PRESET_PROMPTS[preset]) || PRESET_PROMPTS.improve;
        const systemPrompt = `You are a text rewriting assistant. ${rewriteInstruction}
If the text is a question or prompt, transform the question/prompt itself - do NOT answer it.
Output ONLY the rewritten text, no explanations.`;

        const { createGoogleGenerativeAI, generateText } = await getAIModules();
        const google = createGoogleGenerativeAI({ apiKey: config.googleAiApiKey });
        const model = google('gemini-2.0-flash');

        const result = await generateText({
            model,
            messages: [{ role: 'user', content: text }],
            system: systemPrompt,
            maxTokens: 2048,
        });

        return res.json({
            text: result.text,
            preset,
        });
    } catch (error) {
        console.error('[AI Rewrite] Error:', error instanceof Error ? error.message : 'Unknown error');
        return res.status(500).json({
            error: 'Rewrite failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/ai/summarize
 * 
 * Summarize text with configurable type and length.
 * Streams response back for progressive display.
 */
router.post('/summarize', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!checkAIChatRateLimit(ip)) {
        return res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please wait a moment and try again.',
            retryAfter: AI_RATE_LIMIT_WINDOW / 1000,
        });
    }

    try {
        const parsed = SummarizeRequestSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: 'Invalid request',
                message: parsed.error.message,
            });
        }

        const { text, summaryType, summaryLength, pageContext } = parsed.data;

        if (!config.googleAiApiKey) {
            console.error('[AI Summarize] GOOGLE_AI_API_KEY not configured');
            return res.status(500).json({
                error: 'Server configuration error',
                message: 'AI service not properly configured',
            });
        }

        console.log('[AI Summarize] Processing request:', {
            textLength: text.length,
            summaryType,
            summaryLength,
            ip: typeof ip === 'string' ? ip.substring(0, 20) : 'unknown',
        });

        // Build system prompt
        const typeInstruction = SUMMARY_TYPE_INSTRUCTIONS[summaryType] || SUMMARY_TYPE_INSTRUCTIONS['tl-dr'];
        const maxTokens = SUMMARY_LENGTH_TOKENS[summaryLength] || 250;
        
        let systemPrompt = `You are a summarization assistant. ${typeInstruction}`;
        if (pageContext) {
            systemPrompt += ` This text is from: ${pageContext.title} (${pageContext.domain}).`;
        }
        systemPrompt += ' Output ONLY the summary, no preamble or explanations.';

        const { createGoogleGenerativeAI, streamText } = await getAIModules();
        const google = createGoogleGenerativeAI({ apiKey: config.googleAiApiKey });
        const model = google('gemini-2.0-flash');

        const result = streamText({
            model,
            messages: [{ role: 'user', content: `Summarize this text:\n\n${text}` }],
            system: systemPrompt,
            maxTokens,
        });

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        return result.pipeDataStreamToResponse(res);
    } catch (error) {
        console.error('[AI Summarize] Error:', error instanceof Error ? error.message : 'Unknown error');
        return res.status(500).json({
            error: 'Summarization failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
```

> [!TIP]
> Update `src/services/ai.ts` to also export `generateText` for non-streaming rewrite:
> ```typescript
> export async function getAIModules(): Promise<AIModules> {
>     // ... existing code
>     return {
>         createGoogleGenerativeAI: googleAI,
>         generateText: aiSdk.generateText,  // Add for rewrite
>         streamText: aiSdk.streamText,
>         ...aiSdk,
>     };
> }
> ```

---

### Step 2: Backend Writer Client (Extension)

**File:** `apps/extension/src/background/writer/backendWriter.ts` (NEW)

```typescript
/**
 * Backend Writer Client
 * Routes write requests to Vercel backend instead of direct Gemini API
 */

import { createLogger } from '~logger';
import { ENV } from '@/utils/env';
import type { WriterOptions } from './geminiWriter';

const log = createLogger('BackendWriter', 'BACKGROUND');

// Use centralized ENV for backend URL
const BACKEND_URL = ENV.BACKEND_API_URL;

export interface BackendWriteOptions extends Pick<WriterOptions, 'tone' | 'pageContext'> {
    enableUrlContext?: boolean;
    enableGoogleSearch?: boolean;
}

/**
 * Generate text using backend (streaming)
 */
export async function* generateWithBackend(
    prompt: string,
    options: BackendWriteOptions = {}
): AsyncGenerator<string, void, unknown> {
    log.info('Generating with backend:', { promptLength: prompt.length, ...options });

    const response = await fetch(`${BACKEND_URL}/api/ai/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt,
            tone: options.tone,
            platform: options.pageContext?.platform,
            pageContext: options.pageContext,
            enableUrlContext: options.enableUrlContext,
            enableGoogleSearch: options.enableGoogleSearch,
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
                // Text delta in AI SDK format
                try {
                    const text = JSON.parse(line.slice(2));
                    yield text;
                } catch {
                    // Skip malformed chunks
                }
            }
        }
    }

    log.info('Backend generation complete');
}

/**
 * Non-streaming version for simpler use cases
 */
export async function generateTextWithBackend(
    prompt: string,
    options: BackendWriteOptions = {}
): Promise<string> {
    const chunks: string[] = [];
    for await (const chunk of generateWithBackend(prompt, options)) {
        chunks.push(chunk);
    }
    return chunks.join('');
}
```

---

### Step 3: Backend Rewriter Client (Extension)

**File:** `apps/extension/src/background/rewriter/backendRewriter.ts` (NEW)

```typescript
/**
 * Backend Rewriter Client
 * Routes rewrite requests to Vercel backend instead of direct Gemini API
 */

import { createLogger } from '~logger';
import { ENV } from '@/utils/env';
import type { RewriterOptions } from './geminiRewriter';

const log = createLogger('BackendRewriter', 'BACKGROUND');

// Use centralized ENV for backend URL
const BACKEND_URL = ENV.BACKEND_API_URL;

export interface BackendRewriteOptions extends Pick<RewriterOptions, 'preset' | 'instruction'> {
    enableUrlContext?: boolean;
    enableGoogleSearch?: boolean;
}

export interface BackendRewriteResult {
    text: string;
    preset?: string;
}

/**
 * Rewrite text using backend (non-streaming)
 */
export async function rewriteWithBackend(
    text: string,
    options: BackendRewriteOptions = {}
): Promise<BackendRewriteResult> {
    log.info('Rewriting with backend:', { textLength: text.length, preset: options.preset });

    const response = await fetch(`${BACKEND_URL}/api/ai/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text,
            preset: options.preset,
            instruction: options.instruction,
            enableUrlContext: options.enableUrlContext,
            enableGoogleSearch: options.enableGoogleSearch,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Backend error: ${response.status}`);
    }

    const result = await response.json();
    log.info('Backend rewrite complete:', { resultLength: result.text?.length });

    return result;
}
```

---

### Step 4: Backend Summarizer Client (Extension)

**File:** `apps/extension/src/background/summarizer/backendSummarizer.ts` (NEW)

```typescript
/**
 * Backend Summarizer Client
 * Routes summarize requests to Vercel backend instead of direct Gemini API
 */

import { createLogger } from '~logger';
import { ENV } from '@/utils/env';
import type { SummarizerOptions } from './geminiSummarizer';

const log = createLogger('BackendSummarizer', 'BACKGROUND');

// Use centralized ENV for backend URL
const BACKEND_URL = ENV.BACKEND_API_URL;

export interface BackendSummarizeOptions extends Pick<SummarizerOptions, 'summaryType' | 'summaryLength' | 'pageContext'> {}

/**
 * Summarize text using backend (streaming)
 */
export async function* summarizeWithBackend(
    text: string,
    options: BackendSummarizeOptions = { summaryType: 'tl-dr', summaryLength: 'medium' }
): AsyncGenerator<string, void, unknown> {
    log.info('Summarizing with backend:', { textLength: text.length, ...options });

    const response = await fetch(`${BACKEND_URL}/api/ai/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text,
            summaryType: options.summaryType,
            summaryLength: options.summaryLength,
            pageContext: options.pageContext,
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

    log.info('Backend summarization complete');
}

/**
 * Non-streaming version
 */
export async function summarizeTextWithBackend(
    text: string,
    options: BackendSummarizeOptions = { summaryType: 'tl-dr', summaryLength: 'medium' }
): Promise<string> {
    const chunks: string[] = [];
    for await (const chunk of summarizeWithBackend(text, options)) {
        chunks.push(chunk);
    }
    return chunks.join('');
}
```

---

### Step 5: Update Handlers to Route to Backend

**File:** `apps/extension/src/background/writer/handler.ts` (MODIFY)

Add backend mode check at the top of the handler:

```typescript
import { getSettingsStore } from '@/stores/settingsStore';
import { generateWithBackend } from './backendWriter';

// In the write handler, before calling geminiWriter:
export async function handleWriteRequest(request: WriteGenerateRequest, port: chrome.runtime.Port) {
    const { prompt, options } = request;

    try {
        // Check if backend mode is enabled
        const settings = await getSettingsStore();
        const useBackend = settings.useBackendMode && !settings.hasApiKey;

        if (useBackend) {
            log.info('Using backend mode for write generation');
            
            // Stream from backend
            for await (const chunk of generateWithBackend(prompt, {
                tone: options?.tone,
                pageContext: options?.pageContext,
                enableUrlContext: options?.enableUrlContext,
                enableGoogleSearch: options?.enableGoogleSearch,
            })) {
                port.postMessage({ type: 'chunk', text: chunk });
            }
            
            port.postMessage({ type: 'complete' });
            return;
        }

        // Existing BYOK flow...
        const text = await geminiWriter.generate(prompt, options);
        // ...
    } catch (error) {
        // ...
    }
}
```

Apply similar changes to:
- `apps/extension/src/background/rewriter/handler.ts`
- `apps/extension/src/background/summarizer/handler.ts`

---

### Step 6: Update Exports

**File:** `apps/extension/src/background/writer/index.ts`

```typescript
export { geminiWriter, GeminiWriter } from './geminiWriter';
export type { WriterOptions } from './geminiWriter';
export { handleWriteRequest } from './handler';
export { generateWithBackend, generateTextWithBackend } from './backendWriter';
export type { BackendWriteOptions } from './backendWriter';
```

Similar updates for rewriter and summarizer index files.

---

## Rate Limiting Considerations

Content script features may have different usage patterns than chat:

| Feature | Typical Usage | Suggested Rate Limit |
|---------|---------------|---------------------|
| Writer | 10-20 generations/session | 30/min |
| Rewriter | Higher frequency, shorter text | 50/min |
| Summarizer | Medium frequency | 30/min |

Consider separate rate limit buckets:

```typescript
// In rateLimit.ts
export function checkWriteRateLimit(ip: string): boolean { /* ... */ }
export function checkRewriteRateLimit(ip: string): boolean { /* ... */ }
export function checkSummarizeRateLimit(ip: string): boolean { /* ... */ }
```

---

## Testing Checklist

### Backend Testing
- [ ] `/api/ai/write` generates text with streaming
- [ ] `/api/ai/rewrite` transforms text correctly with all presets
- [ ] `/api/ai/summarize` creates appropriate summaries for all types
- [ ] Rate limiting works for all endpoints
- [ ] Error responses are properly formatted

### Extension Testing
- [ ] Writer works in backend mode (Gmail, LinkedIn, etc.)
- [ ] Rewriter works in backend mode (all presets)
- [ ] Summarizer works in backend mode (all types/lengths)
- [ ] Streaming displays progressively in UI
- [ ] Fallback to BYOK when backend unavailable
- [ ] Settings toggle correctly switches modes

### Integration Testing
- [ ] Content script → Background → Backend → Response flow complete
- [ ] Port-based streaming works end-to-end
- [ ] Error handling shows user-friendly messages
- [ ] Caching still works for summarizer

---

## Feature Parity Matrix

| Feature | BYOK | Backend Mode |
|---------|------|--------------|
| **Writer** |
| Basic generation | ✅ | ✅ |
| Tone selection | ✅ | ✅ |
| Platform detection | ✅ | ✅ |
| URL context (tool) | ✅ | ❌ (Phase 6) |
| Google Search grounding | ✅ | ❌ (Phase 6) |
| Supermemory search | ✅ | ❌ (Phase 6) |
| Attachments (images) | ✅ | ❌ (not planned) |
| **Rewriter** |
| All presets | ✅ | ✅ |
| Custom instructions | ✅ | ✅ |
| URL context | ✅ | ❌ (Phase 6) |
| **Summarizer** |
| All summary types | ✅ | ✅ |
| All lengths | ✅ | ✅ |
| Cache (LRU) | ✅ | ✅ (client-side) |

---

## Success Criteria

Phase 5 is complete when:

1. **Writer works** without API key in backend mode
2. **Rewriter works** with all presets in backend mode
3. **Summarizer works** with all types/lengths in backend mode
4. **Streaming displays** progressively in content script UI
5. **Rate limiting** properly restricts usage
6. **Fallback** to BYOK mode works when backend is unavailable

---

## Future Enhancements (Phase 6+)

### Gemini Tools Support
Backend endpoints could support Gemini's built-in tools:
- URL Context fetching
- Google Search grounding
- Code execution

### Supermemory Integration
- Backend could have its own memory search
- Or forward memory queries back to extension

### Advanced Features
- Writing style presets saved to cloud
- Cross-device prompt history
- Usage analytics per feature

---

## Next Steps

Once Phase 5 is complete, all core AI features work in backend mode.
Proceed to Phase 6 for tool support:

→ [PHASE-6-GEMINI-TOOLS.md](./PHASE-6-GEMINI-TOOLS.md) - URL context, Google Search grounding

Future phases:
→ **Phase 7:** Analytics and usage dashboards
→ **Phase 8:** User accounts and premium tiers
