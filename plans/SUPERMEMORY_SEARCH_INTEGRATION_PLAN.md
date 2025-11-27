# Supermemory Search Integration for Writer & Rewriter Overlays

## Executive Summary

This plan outlines the multi-phase implementation of Supermemory's semantic search capabilities into the Writer Overlay (`/write` command) and Rewriter Tooltip features. Since content scripts cannot use the AI SDK directly, we'll implement a native fetch-based approach using Supermemory's REST API, with proper gating based on API key configuration.

## Current Architecture Analysis

### Content Script → Background Communication Flow

```
User types "/write prompt" or selects text
         ↓
Content Script (write-command.tsx / text-rewriter.tsx)
         ↓
chrome.runtime.connect({ name: 'write-command' / 'rewriter' })
         ↓
Background Router (src/background/messaging/router.ts)
         ↓
Handler (src/background/writer/handler.ts / src/background/rewriter/handler.ts)
         ↓
Gemini Client (geminiWriter.ts / geminiRewriter.ts)
         ↓
Gemini API (with tools: url_context, google_search)
         ↓
Response → port.postMessage() → Content Script → UI Update
```

### Key Files Involved

| Component | File Path | Purpose |
|-----------|-----------|---------|
| Writer Overlay UI | `src/contents/write-command/WriterOverlay.tsx` | Floating panel with prompt input & tool toggles |
| Rewriter Tooltip UI | `src/contents/text-rewriter/RewriterTooltip.tsx` | Floating tooltip with presets & tool toggles |
| Tools Toggle | `src/contents/shared/ToolsToggle.tsx` | Compact toggle component for URL Context & Google Search |
| Writer Settings | `src/utils/settings/writeCommandSettings.ts` | Settings storage for write command |
| Rewriter Settings | `src/utils/settings/rewriteSettings.ts` | Settings storage for text rewriter |
| Gemini Writer | `src/background/writer/geminiWriter.ts` | Text generation with Gemini API |
| Gemini Rewriter | `src/background/rewriter/geminiRewriter.ts` | Text rewriting with Gemini API |
| Writer Handler | `src/background/writer/handler.ts` | Handles WRITE_GENERATE messages |
| Rewriter Handler | `src/background/rewriter/handler.ts` | Handles REWRITE_TEXT messages |
| Message Router | `src/background/messaging/router.ts` | Routes port messages to handlers |
| Supermemory Credentials | `src/utils/supermemory/credentials.ts` | API key storage & validation |
| Supermemory User ID | `src/utils/supermemory/userId.ts` | Per-user container ID management |

### Existing Supermemory Integration Pattern

The sidepanel uses `@supermemory/tools/ai-sdk` package which works with AI SDK. For content scripts, we need a direct REST API approach:

```typescript
// Current AI SDK approach (sidepanel only - NOT usable in content scripts)
import { supermemoryTools } from '@supermemory/tools/ai-sdk';
const smTools = supermemoryTools(apiKey, { containerTags: [userId] });
```

### Supermemory Search REST API

```bash
curl -X POST "https://api.supermemory.ai/v4/search" \
  -H "Authorization: Bearer $SUPERMEMORY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "q": "search query",
    "limit": 5,
    "containerTag": "user-id",
    "threshold": 0.7,
    "rerank": true
  }'
```

**Response Structure:**
```typescript
interface SupermemorySearchResponse {
  results: Array<{
    id: string;
    memory: string;           // The actual memory content
    similarity: number;       // 0-1 score
    metadata?: Record<string, unknown>;
    updatedAt: string;
    version: number;
    context?: {
      parents?: Array<{ memory: string; relation: string }>;
      children?: Array<{ memory: string; relation: string }>;
    };
    documents?: Array<{ id: string; title: string; type: string }>;
  }>;
  timing: number;
  total: number;
}
```

---

## Phase 1: Supermemory Search Service (Background)

**Goal:** Create a standalone service in the background that calls Supermemory's REST API directly.

### Files to Create

#### 1.1 `src/background/supermemory/searchService.ts`

A new service module that handles Supermemory search via REST API:

```typescript
/**
 * Supermemory Search Service
 * Direct REST API integration for searching user memories
 * Used by Writer and Rewriter features
 */

import { createLogger } from '~logger';
import { getSupermemoryApiKey, isSupermemoryReady } from '@/utils/supermemory';
import { getSupermemoryUserId } from '@/utils/supermemory';

const log = createLogger('SupermemorySearch', 'BACKGROUND');

const SUPERMEMORY_SEARCH_URL = 'https://api.supermemory.ai/v4/search';

export interface MemorySearchResult {
  id: string;
  memory: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}

export interface SearchMemoriesOptions {
  query: string;
  limit?: number;           // Default: 5
  threshold?: number;       // Default: 0.5
  rerank?: boolean;         // Default: true
  includeFullDocs?: boolean;
}

export interface SearchMemoriesResponse {
  success: boolean;
  results: MemorySearchResult[];
  timing?: number;
  total?: number;
  error?: string;
}

/**
 * Search Supermemory for relevant memories
 */
export async function searchMemories(
  options: SearchMemoriesOptions
): Promise<SearchMemoriesResponse> {
  // Validate Supermemory is ready
  const ready = await isSupermemoryReady();
  if (!ready) {
    return {
      success: false,
      results: [],
      error: 'Supermemory not configured. Please add your API key in settings.',
    };
  }

  const apiKey = await getSupermemoryApiKey();
  if (!apiKey) {
    return {
      success: false,
      results: [],
      error: 'Supermemory API key not found.',
    };
  }

  const userId = await getSupermemoryUserId();

  const { query, limit = 5, threshold = 0.5, rerank = true } = options;

  log.debug('Searching memories', { queryLength: query.length, limit, threshold });

  try {
    const response = await fetch(SUPERMEMORY_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        limit,
        threshold,
        rerank,
        containerTag: userId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('Supermemory API error', { status: response.status, error: errorText });
      
      // Handle specific error cases
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          results: [],
          error: 'Invalid Supermemory API key. Please check your credentials.',
        };
      }
      
      return {
        success: false,
        results: [],
        error: `Supermemory error: ${response.status}`,
      };
    }

    const data = await response.json();
    
    // Extract relevant fields from results
    const results: MemorySearchResult[] = (data.results || []).map((r: any) => ({
      id: r.id,
      memory: r.memory,
      similarity: r.similarity,
      metadata: r.metadata,
    }));

    log.info('Memory search complete', { 
      resultCount: results.length, 
      timing: data.timing,
      total: data.total 
    });

    return {
      success: true,
      results,
      timing: data.timing,
      total: data.total,
    };
  } catch (error) {
    log.error('Memory search failed', { error: error instanceof Error ? error.message : 'Unknown' });
    return {
      success: false,
      results: [],
      error: error instanceof Error ? error.message : 'Failed to search memories',
    };
  }
}

/**
 * Format memory results for inclusion in AI prompts
 */
export function formatMemoriesForPrompt(results: MemorySearchResult[]): string {
  if (results.length === 0) return '';

  const formattedMemories = results
    .map((r, i) => `[Memory ${i + 1}] (relevance: ${(r.similarity * 100).toFixed(0)}%)\n${r.memory}`)
    .join('\n\n');

  return `\n\n--- Relevant User Memories ---\n${formattedMemories}\n--- End Memories ---\n`;
}
```

#### 1.2 `src/background/supermemory/index.ts`

Export the service:

```typescript
/**
 * Supermemory Background Services
 */
export { 
  searchMemories, 
  formatMemoriesForPrompt,
  type MemorySearchResult,
  type SearchMemoriesOptions,
  type SearchMemoriesResponse 
} from './searchService';
```

---

## Phase 2: Update Settings & Types

**Goal:** Add Supermemory toggle to settings storage.

### 2.1 Update `src/utils/settings/writeCommandSettings.ts`

Add new property:

```typescript
export interface WriteCommandSettings {
    enabled: boolean;
    defaultTone: 'professional' | 'casual' | 'formal' | 'friendly';
    includePageContext: boolean;
    maxOutputTokens: number;
    // Gemini Tool settings
    enableUrlContext: boolean;
    enableGoogleSearch: boolean;
    // NEW: Supermemory integration
    enableSupermemorySearch: boolean;
}

export const DEFAULT_WRITE_SETTINGS: WriteCommandSettings = {
    enabled: true,
    defaultTone: 'professional',
    includePageContext: true,
    maxOutputTokens: 1024,
    enableUrlContext: false,
    enableGoogleSearch: false,
    enableSupermemorySearch: false, // NEW
};
```

### 2.2 Update `src/utils/settings/rewriteSettings.ts`

Add new property:

```typescript
export interface RewriteSettings {
    enabled: boolean;
    showPresets: boolean;
    defaultPreset: RewritePreset | null;
    minSelectionLength: number;
    enableUrlContext: boolean;
    enableGoogleSearch: boolean;
    // NEW: Supermemory integration
    enableSupermemorySearch: boolean;
}

export const DEFAULT_REWRITE_SETTINGS: RewriteSettings = {
    enabled: true,
    showPresets: true,
    defaultPreset: null,
    minSelectionLength: 10,
    enableUrlContext: false,
    enableGoogleSearch: false,
    enableSupermemorySearch: false, // NEW
};
```

### 2.3 Update Types in `src/types/writeCommand.ts`

Add to payload settings:

```typescript
export interface WriteSettings {
    tone?: WriteTone;
    maxTokens?: number;
    enableUrlContext?: boolean;
    enableGoogleSearch?: boolean;
    enableSupermemorySearch?: boolean; // NEW
}
```

### 2.4 Update Types in `src/types/rewriteCommand.ts`

Add to settings if applicable.

---

## Phase 3: Update ToolsToggle Component

**Goal:** Add Supermemory toggle with proper gating (disabled if API key not configured).

### 3.1 Update `src/contents/shared/ToolsToggle.tsx`

```typescript
interface ToolsToggleProps {
    enableUrlContext: boolean;
    enableGoogleSearch: boolean;
    enableSupermemorySearch: boolean; // NEW
    onUrlContextChange: (enabled: boolean) => void;
    onGoogleSearchChange: (enabled: boolean) => void;
    onSupermemorySearchChange: (enabled: boolean) => void; // NEW
    supermemoryConfigured: boolean; // NEW - for gating
    disabled?: boolean;
}

// Add brain/memory icon
const BrainIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
        <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
        <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
        <path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/>
        <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/>
        <path d="M3.477 10.896a4 4 0 0 1 .585-.396"/>
        <path d="M19.938 10.5a4 4 0 0 1 .585.396"/>
        <path d="M6 18a4 4 0 0 1-1.967-.516"/>
        <path d="M19.967 17.484A4 4 0 0 1 18 18"/>
    </svg>
);

// Add warning icon for gated state
const AlertIcon = () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
```

**Expanded Panel Addition:**
```tsx
{/* Supermemory Search Toggle */}
<button
    type="button"
    className={`tools-toggle-item ${enableSupermemorySearch ? 'tools-toggle-item--active' : ''} ${!supermemoryConfigured ? 'tools-toggle-item--gated' : ''}`}
    onClick={handleSupermemorySearchToggle}
    disabled={disabled || (!supermemoryConfigured && !enableSupermemorySearch)}
    title={supermemoryConfigured 
        ? "Search memories - Use your saved knowledge" 
        : "Configure Supermemory API key in settings to enable"}
>
    <span className="tools-toggle-item-icon"><BrainIcon /></span>
    <span className="tools-toggle-item-label">
        Memories
        {!supermemoryConfigured && (
            <span className="tools-toggle-item-warning"><AlertIcon /></span>
        )}
    </span>
    <span className={`tools-toggle-item-switch ${enableSupermemorySearch ? 'tools-toggle-item-switch--on' : ''}`}>
        <span className="tools-toggle-item-switch-thumb" />
    </span>
</button>
```

### 3.2 Add CSS for Gated State

In `src/styles/features/write-command.css` and `text-rewriter.css`:

```css
.tools-toggle-item--gated {
    opacity: 0.6;
    cursor: not-allowed;
}

.tools-toggle-item-warning {
    margin-left: 4px;
    color: var(--warning-color, #f59e0b);
    display: inline-flex;
    align-items: center;
}

.tools-toggle-item--gated:hover::after {
    content: 'Configure API key in settings';
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    padding: 4px 8px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 10px;
    white-space: nowrap;
    z-index: 100;
}
```

---

## Phase 4: Update Background Handlers

**Goal:** Integrate memory search into text generation flow.

### 4.1 Update `src/background/writer/handler.ts`

```typescript
import { searchMemories, formatMemoriesForPrompt } from '../supermemory';

export async function handleWriteGenerate(
    request: WriteGenerateRequest,
    port: chrome.runtime.Port
): Promise<void> {
    const { prompt, pageContext, settings } = request.payload;

    // Build writer options
    const options: WriterOptions = {
        tone: settings?.tone,
        maxTokens: settings?.maxTokens,
        pageContext,
        enableUrlContext: settings?.enableUrlContext ?? false,
        enableGoogleSearch: settings?.enableGoogleSearch ?? false,
    };

    // NEW: Search memories if enabled
    let memoryContext = '';
    if (settings?.enableSupermemorySearch) {
        const searchResult = await searchMemories({
            query: prompt,
            limit: 5,
            threshold: 0.5,
        });
        
        if (searchResult.success && searchResult.results.length > 0) {
            memoryContext = formatMemoriesForPrompt(searchResult.results);
            log.debug('Added memory context', { 
                memoryCount: searchResult.results.length 
            });
        }
    }

    // Prepend memory context to prompt if available
    const enrichedPrompt = memoryContext 
        ? `${prompt}\n${memoryContext}`
        : prompt;

    // Continue with generation using enrichedPrompt...
    const text = await geminiWriter.generate(enrichedPrompt, options);
    // ... rest of handler
}
```

### 4.2 Update `src/background/rewriter/handler.ts`

Similar pattern - inject memory context into the rewrite request.

---

## Phase 5: Update Content Script Components

**Goal:** Wire up the UI to the new settings.

### 5.1 Update `src/contents/write-command/WriterOverlay.tsx`

```typescript
// Add state
const [enableSupermemorySearch, setEnableSupermemorySearch] = useState(false);
const [supermemoryConfigured, setSupermemoryConfigured] = useState(false);

// Load settings on mount
useEffect(() => {
    Promise.all([
        getWriteCommandSettings(),
        isSupermemoryReady()
    ]).then(([settings, smReady]) => {
        setEnableUrlContext(settings.enableUrlContext);
        setEnableGoogleSearch(settings.enableGoogleSearch);
        setEnableSupermemorySearch(settings.enableSupermemorySearch);
        setSupermemoryConfigured(smReady);
    }).catch(() => {
        // Use defaults on error
    });
}, []);

// Handle Supermemory toggle
const handleSupermemorySearchChange = useCallback((enabled: boolean) => {
    // Only allow enabling if configured
    if (enabled && !supermemoryConfigured) return;
    
    setEnableSupermemorySearch(enabled);
    void updateWriteCommandSetting('enableSupermemorySearch', enabled);
}, [supermemoryConfigured]);

// Update onGenerate call
onGenerate(prompt, { 
    enableUrlContext, 
    enableGoogleSearch,
    enableSupermemorySearch 
});

// Update ToolsToggle usage
<ToolsToggle
    enableUrlContext={enableUrlContext}
    enableGoogleSearch={enableGoogleSearch}
    enableSupermemorySearch={enableSupermemorySearch}
    onUrlContextChange={handleUrlContextChange}
    onGoogleSearchChange={handleGoogleSearchChange}
    onSupermemorySearchChange={handleSupermemorySearchChange}
    supermemoryConfigured={supermemoryConfigured}
    disabled={isGenerating}
/>
```

### 5.2 Update `src/contents/text-rewriter/RewriterTooltip.tsx`

Same pattern as WriterOverlay.

### 5.3 Update Content Script Main Files

Update `write-command.tsx` and `text-rewriter.tsx` to pass the new setting through the port message.

---

## Phase 6: Gemini Function Calling Integration (Optional Enhancement)

**Goal:** Leverage Gemini's function calling to let the AI decide when to search memories.

Instead of always searching, define a function declaration that Gemini can call:

### 6.1 Update `src/background/writer/geminiWriter.ts`

```typescript
// Define the search_memories function for Gemini
const MEMORY_SEARCH_FUNCTION = {
    name: 'search_memories',
    description: 'Search the user\'s personal knowledge base for relevant information, past conversations, notes, and saved content. Use this when the user refers to something they mentioned before, asks about their preferences, or when context from their history would be helpful.',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'The search query to find relevant memories'
            },
            limit: {
                type: 'number',
                description: 'Maximum number of results to return (default: 5)'
            }
        },
        required: ['query']
    }
};

// In generate method, add to tools if enabled
if (options?.enableSupermemorySearch) {
    tools.push({
        function_declarations: [MEMORY_SEARCH_FUNCTION]
    });
}

// Handle function call response
// If Gemini calls search_memories, execute it and continue
```

This approach is more sophisticated but requires handling the function call-response loop in the generation flow.

---

## Phase 7: Testing & Error Handling

### 7.1 Test Cases

1. **Gating Test**: Toggle should be disabled when Supermemory API key is not configured
2. **Enable Test**: Toggle should work when API key is configured and enabled
3. **Search Test**: When enabled, memories should be searched and included in generation
4. **No Results Test**: Gracefully handle when no memories match the query
5. **API Error Test**: Handle 401, 403, 500 errors gracefully
6. **Network Error Test**: Handle network failures without breaking the flow

### 7.2 Error Messages

| Error Type | User Message |
|------------|--------------|
| No API Key | "Configure Supermemory API key in settings to use memory search" |
| Invalid Key | "Invalid Supermemory API key. Please check your credentials." |
| Rate Limited | "Memory search rate limited. Please wait a moment." |
| Network Error | "Could not connect to Supermemory. Check your connection." |
| No Results | (Silent - no error shown, just proceed without memories) |

---

## Phase 8: UI Polish

### 8.1 Add Tooltip/Info for Supermemory Toggle

Show info tooltip explaining what "Memories" does:
- "Search your saved knowledge and past conversations"
- "Requires Supermemory API key (configure in Settings → Integrations)"

### 8.2 Add Visual Indicator When Memories Are Used

Show a subtle badge or indicator when the response used memory context:
- Small "🧠" icon next to the response
- Or a small pill: "Used 3 memories"

---

## Implementation Order Summary

| Phase | Priority | Effort | Dependencies |
|-------|----------|--------|--------------|
| Phase 1: Search Service | High | Medium | None |
| Phase 2: Settings Updates | High | Low | Phase 1 |
| Phase 3: ToolsToggle Update | High | Medium | Phase 2 |
| Phase 4: Handler Updates | High | Medium | Phase 1, 2 |
| Phase 5: Content Script Updates | High | Medium | Phase 3, 4 |
| Phase 6: Function Calling | Low | High | Phase 1-5 |
| Phase 7: Testing | High | Medium | Phase 1-5 |
| Phase 8: UI Polish | Low | Low | Phase 1-5 |

---

## Files to Create/Modify Summary

### New Files
- `src/background/supermemory/searchService.ts` - REST API search service
- `src/background/supermemory/index.ts` - Module exports

### Modified Files
- `src/utils/settings/writeCommandSettings.ts` - Add `enableSupermemorySearch`
- `src/utils/settings/rewriteSettings.ts` - Add `enableSupermemorySearch`
- `src/types/writeCommand.ts` - Add to WriteSettings interface
- `src/contents/shared/ToolsToggle.tsx` - Add Supermemory toggle with gating
- `src/contents/write-command/WriterOverlay.tsx` - Wire up new setting
- `src/contents/text-rewriter/RewriterTooltip.tsx` - Wire up new setting
- `src/contents/write-command.tsx` - Pass new setting to background
- `src/contents/text-rewriter.tsx` - Pass new setting to background
- `src/background/writer/handler.ts` - Integrate memory search
- `src/background/writer/geminiWriter.ts` - (Optional) Function calling
- `src/background/rewriter/handler.ts` - Integrate memory search
- `src/styles/features/write-command.css` - Gated toggle styles
- `src/styles/features/text-rewriter.css` - Gated toggle styles

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| API Key Exposure | Keys stored in chrome.storage.local, never sent to content scripts |
| Rate Limiting | Add exponential backoff, cache recent searches |
| Latency | Search async, don't block UI; show loading state |
| No Memories | Graceful fallback - proceed without context |
| Large Memory Context | Limit results to 5, truncate if needed |

---

## Future Enhancements

1. **Add Memory from Writer/Rewriter**: Allow saving generated content to Supermemory
2. **Memory Preview**: Show matched memories before generation
3. **Selective Memory Use**: Let user pick which memories to include
4. **Memory Caching**: Cache recent searches to reduce API calls
5. **Offline Fallback**: Use local memory store when Supermemory is unavailable
