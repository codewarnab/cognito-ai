# Phase 7: Suggestion Generation via Backend

## Overview

This phase adds backend mode support for AI-generated contextual suggestions. Currently, suggestions require user API keys (BYOK mode) - users in backend mode see only fallback static suggestions.

**Goal:** Enable contextual AI suggestions for users without API keys.

**Scope:**
- ✅ Suggestion generation endpoint on backend
- ✅ Backend client for extension
- ✅ Generator routing based on backend mode
- ✅ Caching (client-side, with optional server-side)
- ❌ Complex page context (simplified for API efficiency)

## Prerequisites

- Phase 1 (basic backend chat) completed
- Understanding of current suggestion flow

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       CURRENT FLOW (BYOK Only)                          │
│                                                                         │
│  ┌─────────────────┐                         ┌─────────────────────────┐│
│  │  SuggestedActions│──── useSuggestions ───▶│  generator.ts           ││
│  │  (Component)     │                        │  • initializeModel()    ││
│  └─────────────────┘                         │  • generateObject()     ││
│                                              │  • Requires API key!    ││
│                                              └───────────┬─────────────┘│
│                                                          │              │
│                                              ┌───────────▼─────────────┐│
│                                              │  Falls back to static   ││
│                                              │  suggestions if no key  ││
│                                              └─────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       TARGET FLOW (Backend Mode)                        │
│                                                                         │
│  ┌─────────────────┐                         ┌─────────────────────────┐│
│  │  SuggestedActions│──── useSuggestions ───▶│  generator.ts           ││
│  │  (Component)     │                        │  • Check backendMode    ││
│  └─────────────────┘                         │  • Route accordingly    ││
│                                              └───────────┬─────────────┘│
│                               ┌──────────────────────────┼──────────────┤
│                               │                          │              │
│                    useBackendMode?               Has API Key?           │
│                               │                          │              │
│                    ┌──────────▼──────────┐    ┌──────────▼─────────────┐│
│                    │  backendSuggestions │    │  Local initializeModel ││
│                    │  POST /api/ai/      │    │  generateObject()      ││
│                    │  suggestions        │    │  (existing flow)       ││
│                    └──────────┬──────────┘    └────────────────────────┘│
│                               │                                         │
│                    ┌──────────▼──────────┐                              │
│                    │  Vercel Backend     │                              │
│                    │  Uses server API key│                              │
│                    └─────────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Files to Modify/Create

### Backend Files (Vercel)

| File | Action | Purpose |
|------|--------|---------|
| `src/routes/ai.ts` | MODIFY | Add `/api/ai/suggestions` endpoint |

### Extension Files

| File | Action | Purpose |
|------|--------|---------|
| `src/ai/suggestions/backendSuggestions.ts` | NEW | Backend client for suggestions |
| `src/ai/suggestions/generator.ts` | MODIFY | Route to backend when enabled |
| `src/ai/suggestions/index.ts` | MODIFY | Export backend client |

---

## Implementation Steps

### Step 1: Backend Endpoint for Suggestions

**File:** `packages/backend-vercel/src/routes/ai.ts`

```typescript
import { z } from 'zod';

// ============================================================================
// Suggestion Schema
// ============================================================================

const PageContextSchema = z.object({
    url: z.string(),
    title: z.string(),
    description: z.string().optional(),
    headings: z.array(z.object({
        level: z.number(),
        text: z.string(),
    })).optional(),
    buttons: z.array(z.object({
        text: z.string(),
    })).optional(),
    links: z.array(z.object({
        text: z.string(),
    })).optional(),
    textPreview: z.string().optional(),
});

const SuggestionsRequestSchema = z.object({
    pageContext: PageContextSchema.nullable(),
});

const SuggestionResponseSchema = z.object({
    suggestions: z.array(z.object({
        title: z.string(),
        action: z.string(),
    })).length(3),
});

// ============================================================================
// Suggestion Prompt Builder
// ============================================================================

const CAPABILITIES = [
    'navigate to websites and search the web',
    'manage and organize browser tabs into groups',
    'search browser history and find previously visited pages',
    'set reminders for tasks and deadlines',
    'save and retrieve information to/from memory',
    'interact with pages (click buttons, fill forms, read content)',
    'send emails using web-based email services',
    'analyze YouTube videos and provide insights',
];

function buildSuggestionPrompt(pageContext: z.infer<typeof PageContextSchema> | null): string {
    let prompt = `You are a browser AI assistant. Generate 3 contextual action suggestions based on the current page.

Your capabilities include:
${CAPABILITIES.map(c => `- ${c}`).join('\n')}

`;

    if (pageContext) {
        prompt += `Current Page Context:
- URL: ${pageContext.url}
- Title: ${pageContext.title}
`;

        if (pageContext.description) {
            prompt += `- Description: ${pageContext.description}\n`;
        }

        if (pageContext.headings && pageContext.headings.length > 0) {
            prompt += `\nKey Headings:\n`;
            pageContext.headings.slice(0, 5).forEach(h => {
                prompt += `  ${'#'.repeat(h.level)} ${h.text}\n`;
            });
        }

        if (pageContext.buttons && pageContext.buttons.length > 0) {
            prompt += `\nAvailable Buttons:\n`;
            pageContext.buttons.slice(0, 8).forEach(btn => {
                prompt += `  - "${btn.text}"\n`;
            });
        }

        if (pageContext.links && pageContext.links.length > 0) {
            prompt += `\nKey Links:\n`;
            pageContext.links.slice(0, 5).forEach(link => {
                prompt += `  - "${link.text}"\n`;
            });
        }

        if (pageContext.textPreview) {
            prompt += `\nPage Content Preview:\n${pageContext.textPreview}\n`;
        }
    } else {
        prompt += `Current Page: No specific page context available (may be on a restricted page)\n`;
    }

    prompt += `\nGenerate exactly 3 diverse, actionable suggestions.

CRITICAL - Title lengths must be progressively longer:
1. First: SHORTEST (2-3 words), e.g. "Check emails"
2. Second: MEDIUM (3-4 words), e.g. "Find recent GitHub visits"  
3. Third: LONGEST (4-6 words), e.g. "Set reminder for tomorrow meeting"

Each suggestion should:
- Be specific and actionable
- Relate to the current page or browser context
- Use natural language
- Vary in type (navigation, organization, search, etc.)`;

    return prompt;
}

// ============================================================================
// Suggestions Endpoint
// ============================================================================

/**
 * POST /api/ai/suggestions
 * 
 * Generate contextual suggestions based on page context.
 * Returns exactly 3 suggestions with progressive title lengths.
 */
router.post('/suggestions', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    
    // Use a lighter rate limit for suggestions (they're smaller requests)
    if (!checkSuggestionRateLimit(ip)) {
        return res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'Too many suggestion requests. Please wait a moment.',
            retryAfter: 30,
        });
    }

    try {
        const parsed = SuggestionsRequestSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: 'Invalid request',
                message: parsed.error.message,
            });
        }

        const { pageContext } = parsed.data;

        if (!config.googleAiApiKey) {
            console.error('[AI Suggestions] GOOGLE_AI_API_KEY not configured');
            return res.status(500).json({
                error: 'Server configuration error',
                message: 'AI service not properly configured',
            });
        }

        console.log('[AI Suggestions] Processing request:', {
            hasContext: !!pageContext,
            url: pageContext?.url?.substring(0, 50),
            ip: typeof ip === 'string' ? ip.substring(0, 20) : 'unknown',
        });

        const prompt = buildSuggestionPrompt(pageContext);

        const { createGoogleGenerativeAI, generateObject } = await getAIModules();
        const google = createGoogleGenerativeAI({ apiKey: config.googleAiApiKey });
        const model = google('gemini-2.5-flash-lite'); // Use lite model for suggestions

        const result = await generateObject({
            model,
            schema: SuggestionResponseSchema,
            prompt,
            temperature: 0.8, // More creative suggestions
        });

        console.log('[AI Suggestions] Generated successfully');

        return res.json({
            suggestions: result.object.suggestions,
            cached: false,
        });

    } catch (error) {
        console.error('[AI Suggestions] Error:', error instanceof Error ? error.message : 'Unknown error');
        return res.status(500).json({
            error: 'Suggestion generation failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
```

Add to `src/middleware/rateLimit.ts`:

```typescript
// Separate rate limit for suggestions (lighter, more frequent)
const suggestionRateLimits = new Map<string, { count: number; resetAt: number }>();

export const SUGGESTION_RATE_LIMIT = 60; // 60 requests per minute
export const SUGGESTION_RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

export function checkSuggestionRateLimit(ip: string): boolean {
    const now = Date.now();
    const record = suggestionRateLimits.get(ip);

    if (!record || now > record.resetAt) {
        suggestionRateLimits.set(ip, { count: 1, resetAt: now + SUGGESTION_RATE_LIMIT_WINDOW });
        return true;
    }

    if (record.count >= SUGGESTION_RATE_LIMIT) {
        return false;
    }

    record.count++;
    return true;
}
```

---

### Step 2: Backend Suggestions Client (Extension)

**File:** `apps/extension/src/ai/suggestions/backendSuggestions.ts` (NEW)

```typescript
/**
 * Backend Suggestions Client
 * Generates contextual suggestions via Vercel backend API
 */

import { createLogger } from '~logger';
import type { PageContext } from '@/utils/tabs';
import type { Suggestion } from './generator';

const log = createLogger('BackendSuggestions', 'AI_PROMPTS');

const BACKEND_URL = import.meta.env.WXT_BACKEND_API_URL || 'https://cognito-ai-api.vercel.app';

interface SimplifiedPageContext {
    url: string;
    title: string;
    description?: string;
    headings?: Array<{ level: number; text: string }>;
    buttons?: Array<{ text: string }>;
    links?: Array<{ text: string }>;
    textPreview?: string;
}

/**
 * Convert full PageContext to simplified version for API
 * Reduces payload size by limiting arrays and text length
 */
function simplifyPageContext(context: PageContext | null): SimplifiedPageContext | null {
    if (!context) return null;

    return {
        url: context.url,
        title: context.title,
        description: context.metadata.description,
        headings: context.headings.slice(0, 5).map(h => ({
            level: h.level,
            text: h.text.substring(0, 100),
        })),
        buttons: context.buttons.slice(0, 8).map(b => ({
            text: b.text.substring(0, 50),
        })),
        links: context.links.slice(0, 5).map(l => ({
            text: l.text.substring(0, 100),
        })),
        textPreview: context.text?.substring(0, 500),
    };
}

export interface BackendSuggestionsResult {
    suggestions: Suggestion[];
    cached: boolean;
}

/**
 * Generate suggestions using backend API
 */
export async function generateBackendSuggestions(
    pageContext: PageContext | null
): Promise<Suggestion[] | null> {
    log.info('Generating suggestions via backend:', { 
        url: pageContext?.url?.substring(0, 50) 
    });

    try {
        const simplifiedContext = simplifyPageContext(pageContext);

        const response = await fetch(`${BACKEND_URL}/api/ai/suggestions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pageContext: simplifiedContext,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Backend error: ${response.status}`);
        }

        const result: BackendSuggestionsResult = await response.json();
        
        log.info('Backend suggestions generated:', { 
            count: result.suggestions.length,
            cached: result.cached,
        });

        return result.suggestions;

    } catch (error) {
        log.error('Backend suggestion generation failed:', error);
        return null;
    }
}
```

---

### Step 3: Update Generator to Route Based on Mode

**File:** `apps/extension/src/ai/suggestions/generator.ts` (MODIFY)

```typescript
// Add imports at top
import { useSettingsStore } from '@/stores/settings/settingsStore';
import { generateBackendSuggestions } from './backendSuggestions';

// Update generateContextualSuggestions function:

/**
 * Generate contextual suggestions using AI
 * Routes to backend or local based on settings and API key availability
 * 
 * @param pageContext - Current page context
 * @param mode - AI mode ('remote' or 'local'). Only used if not in backend mode.
 */
export async function generateContextualSuggestions(
    pageContext: PageContext | null,
    mode: 'remote' | 'local' = 'remote'
): Promise<Suggestion[] | null> {
    // Check cache first
    const cacheKey = createCacheKey(pageContext);
    const cached = suggestionsCache.get(cacheKey);
    if (cached) {
        log.info('📦 Suggestions cache hit', { url: pageContext?.url });
        return cached;
    }

    try {
        // Check if we should use backend mode
        const { useBackendMode } = useSettingsStore.getState();
        
        if (useBackendMode) {
            log.info('🌐 Using backend mode for suggestions');
            const backendResult = await generateBackendSuggestions(pageContext);
            
            if (backendResult) {
                suggestionsCache.set(cacheKey, backendResult);
                log.debug('📦 Cached backend suggestions', { url: pageContext?.url });
                return backendResult;
            }
            
            // If backend fails, we can't fall back to local (no API key)
            log.warn('Backend suggestion generation failed, no fallback available');
            return null;
        }

        // If local mode requested, use local AI (but skip if HIDE_LOCAL_MODE is enabled)
        if (mode === 'local') {
            if (HIDE_LOCAL_MODE) {
                log.info('Local mode requested but HIDE_LOCAL_MODE is enabled, skipping local AI');
                return null;
            }
            log.info('Using local AI for suggestions');
            const localResult = await generateLocalContextualSuggestions(pageContext);
            if (localResult) {
                suggestionsCache.set(cacheKey, localResult);
                log.debug('📦 Cached local suggestions', { url: pageContext?.url });
            }
            return localResult;
        }

        // Remote mode with user's API key (existing flow)
        try {
            const { model, provider, modelName } = await initializeModel('gemini-2.5-flash-lite', 'remote');
            log.info('Generating remote suggestions with provider:', provider, 'model:', modelName);
            
            // ... rest of existing remote logic ...
        } catch (error) {
            log.error('Remote suggestion generation failed:', error);
            // Fallback logic...
        }

    } catch (error) {
        log.error('Failed to generate suggestions:', error);
        return null;
    }
}
```

---

### Step 4: Update Exports

**File:** `apps/extension/src/ai/suggestions/index.ts` (MODIFY)

```typescript
/**
 * Suggestions Module
 * Exports suggestion generation functionality for local, remote, and backend modes
 */

// Local suggestion generation
export { generateLocalContextualSuggestions } from './local';

// Main suggestion generator (supports local, remote, and backend)
export { generateContextualSuggestions } from './generator';
export type { Suggestion } from './generator';

// Backend suggestion generation
export { generateBackendSuggestions } from './backendSuggestions';
export type { BackendSuggestionsResult } from './backendSuggestions';
```

---

### Step 5: Update AI Services Module Export

**File:** `packages/backend-vercel/src/services/ai.ts` (MODIFY)

Add `generateObject` to the exports for suggestion generation:

```typescript
interface AIModules {
    createGoogleGenerativeAI: typeof import('@ai-sdk/google').createGoogleGenerativeAI;
    streamText: typeof import('ai').streamText;
    generateText: typeof import('ai').generateText;
    generateObject: typeof import('ai').generateObject; // Add this
    [key: string]: unknown;
}

export async function getAIModules(): Promise<AIModules> {
    if (!googleAI) {
        const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
        googleAI = createGoogleGenerativeAI;
    }
    if (!aiSdk) {
        aiSdk = await import('ai');
    }
    return {
        createGoogleGenerativeAI: googleAI,
        generateObject: aiSdk.generateObject, // Add this
        ...aiSdk,
    };
}
```

---

## Rate Limiting Considerations

Suggestions are lighter than chat but more frequent:

| Metric | Value |
|--------|-------|
| Typical request size | ~2KB (simplified context) |
| Typical response size | ~500 bytes |
| Frequency | Every page navigation + 30s refresh |
| Suggested rate limit | 60/minute per IP |

Consider caching on the backend for popular pages:

```typescript
// Optional: Server-side cache for popular URLs
const popularPageCache = new Map<string, { suggestions: Suggestion[]; expires: number }>();

function getCachedSuggestions(url: string): Suggestion[] | null {
    const cached = popularPageCache.get(url);
    if (cached && Date.now() < cached.expires) {
        return cached.suggestions;
    }
    return null;
}
```

---

## Testing Checklist

### Backend Testing
- [ ] `/api/ai/suggestions` returns 3 suggestions
- [ ] Suggestions have progressive title lengths
- [ ] Rate limiting works (60/min)
- [ ] Handles null page context
- [ ] Handles malformed requests gracefully

### Extension Testing
- [ ] Backend mode routes to backend API
- [ ] BYOK mode still uses initializeModel
- [ ] Cache works for both modes
- [ ] useSuggestions hook works in backend mode
- [ ] Fallback to static suggestions if backend fails

### Integration Testing
- [ ] End-to-end: Page load → Backend → Suggestions displayed
- [ ] Tab switching generates new suggestions
- [ ] Rate limit messaging in UI

---

## Success Criteria

Phase 7 is complete when:

1. **Backend endpoint works** - `/api/ai/suggestions` generates contextual suggestions
2. **Extension routes correctly** - Backend mode uses backend, BYOK uses local
3. **Caching works** - Client-side cache prevents redundant requests
4. **Rate limiting** - 60 requests/minute limit enforced
5. **UI unchanged** - SuggestedActions component works identically

---

## Performance Considerations

### Payload Size Optimization
- Limit headings to 5, buttons to 8, links to 5
- Truncate text preview to 500 chars
- Use `gemini-2.5-flash-lite` for speed

### Latency Targets
| Metric | Target |
|--------|--------|
| Cold start | < 1000ms |
| Warm request | < 500ms |
| Cache hit (client) | < 10ms |

### Cost Optimization
- Use lite model ($0.075/1M input tokens)
- Small context window (~2KB)
- Estimated cost: ~$0.01 per 1000 suggestions

---

## Future Enhancements

### Server-Side Caching
- Cache suggestions for popular URLs (GitHub, YouTube, Gmail)
- Redis-based cache with 10-minute TTL
- Reduces API costs for common pages

### Personalized Suggestions
- Consider user's recent actions
- Weight suggestions by usage patterns
- Requires user identification (Phase 8+)

### A/B Testing
- Track suggestion click-through rates
- Optimize prompt based on engagement
- Requires analytics (Phase 8+)

---

## Next Steps

Once Phase 7 is complete, users in backend mode get AI-generated suggestions.

→ **Phase 8:** Analytics and usage dashboards
→ **Phase 9:** User accounts and premium tiers
