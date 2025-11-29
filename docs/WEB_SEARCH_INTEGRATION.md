# Web Search Integration Documentation

## Overview

The web search integration enables the AI assistant to search the internet for real-time information, retrieve content from specific URLs, and provide cited responses. This feature is built as a modular, provider-agnostic system with caching, error handling, and accessibility support.

## Search Mode Behavior

When web search mode is **enabled**, the following changes occur:

### 1. System Prompt Replacement
- The normal agent system prompt is **completely replaced** with a dedicated web search prompt
- The AI becomes a focused research assistant that can ONLY search the web
- No browser automation capabilities are available in search mode

### 2. Tools Restriction
- **ONLY** `webSearch` and `retrieve` tools are available
- All other tools (navigation, interaction, DOM analysis, etc.) are disabled
- This creates a focused, distraction-free search experience

### 3. UI Changes
- Tools button in chat input shows "2 (Search)" and is **disabled**
- Users cannot modify tool selection while search mode is active
- Search depth selector appears next to the search toggle

### 4. AI Behavior
- AI proactively searches without asking permission
- All responses include inline citations from search results
- AI acknowledges when it cannot perform browser automation tasks

### When Search Mode is Disabled
- Search tools (`webSearch`, `retrieve`) are removed from available tools
- Normal agent prompt and full tool set are restored
- Tools button becomes clickable again

## Architecture Block Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    USER INTERFACE LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  ┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────────┐   │
│  │  SearchModeToggle    │    │  SearchDepthSelector │    │  SearchSettingsSection   │   │
│  │  (Enable/Disable)    │    │  (Basic/Advanced)    │    │  (API Key Config)        │   │
│  └──────────┬───────────┘    └──────────┬───────────┘    └────────────┬─────────────┘   │
│             │                           │                              │                 │
│             └───────────────────────────┼──────────────────────────────┘                 │
│                                         ▼                                                │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐   │
│  │                           SearchControls (Combined UI)                            │   │
│  └──────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                          │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         Search Results Display Components                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │   │
│  │  │SearchSection│  │SearchResults│  │RetrieveSectn│  │SearchResultsImageSection│  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                          │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐   │
│  │                           Citation & Enhancement Components                       │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────────┐   │   │
│  │  │  SourceCitation │  │  CitationList   │  │       RelatedQuestions          │   │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                      HOOKS LAYER                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  ┌────────────────────────────┐         ┌────────────────────────────────────────────┐  │
│  │      useSearchMode         │────────▶│         useSearchModeWithAI                │  │
│  │  - isSearchMode            │         │  - Extends useSearchMode                   │  │
│  │  - toggleSearchMode        │         │  - aiConfig (SearchAgentConfig)            │  │
│  │  - searchDepth             │         │  - isSearchActive                          │  │
│  │  - hasApiKey               │         │  - Integrates with AI agent config         │  │
│  │  - isLoading               │         └────────────────────────────────────────────┘  │
│  └────────────────────────────┘                                                          │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   AI INTEGRATION LAYER                                   │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │                            searchAgentConfig.ts                                  │    │
│  │  - createSearchAgentConfig()  → SearchAgentConfig                               │    │
│  │  - mergeSearchConfig()        → Merged AI options                               │    │
│  │  - getSearchState()           → Active state check                              │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│                                         │                                                │
│                                         ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │                            searchPrompt.ts                                       │    │
│  │  - buildWebSearchSystemPrompt() → Complete search-only system prompt            │    │
│  │  - getWebSearchSystemPrompt()   → Get the full replacement prompt               │    │
│  │  - SEARCH_SYSTEM_PROMPT         → Legacy prompt addition (deprecated)           │    │
│  │  - SEARCH_USER_REMINDER         → User message reminder                         │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│                                         │                                                │
│                                         ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │                            searchToolFilter.ts                                   │    │
│  │  - SEARCH_TOOL_NAMES         → ['webSearch', 'retrieve']                        │    │
│  │  - isSearchTool()            → Type guard                                       │    │
│  │  - filterToolsBySearchMode() → Include/exclude search tools                     │    │
│  │  - getActiveSearchTools()    → Active tool list                                 │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    TOOLS LAYER                                           │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  ┌─────────────────────────────────┐    ┌─────────────────────────────────────────┐     │
│  │        useWebSearch.tsx         │    │           useRetrieve.tsx               │     │
│  │  Tool Name: 'webSearch'         │    │  Tool Name: 'retrieve'                  │     │
│  │                                 │    │                                         │     │
│  │  Parameters (Zod Schema):       │    │  Parameters (Zod Schema):               │     │
│  │  - query: string (required)     │    │  - url: string (required, valid URL)    │     │
│  │  - max_results: 1-20 (opt)      │    │                                         │     │
│  │  - search_depth: basic|advanced │    │  Execution:                             │     │
│  │  - include_domains: string[]    │    │  - Fetches via Jina Reader API          │     │
│  │  - exclude_domains: string[]    │    │  - Extracts main content                │     │
│  │                                 │    │  - Truncates to 10,000 chars            │     │
│  │  Execution:                     │    │                                         │     │
│  │  - Gets settings & API key      │    │  Returns: SearchResults                 │     │
│  │  - Creates search provider      │    │  - results: [{title, url, content}]     │     │
│  │  - Executes search              │    │                                         │     │
│  │  - Returns SearchResults        │    │  UI Renderer:                           │     │
│  │                                 │    │  - Shows domain being retrieved         │     │
│  │  UI Renderer:                   │    │  - Shows content length on success      │     │
│  │  - Shows query & depth badge    │    │                                         │     │
│  │  - Lists results with links     │    └─────────────────────────────────────────┘     │
│  │  - Shows image count            │                                                     │
│  └─────────────────────────────────┘                                                     │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    CORE SEARCH LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │                              src/search/                                         │    │
│  │                                                                                  │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │    │
│  │  │  types.ts   │  │  schema.ts  │  │  errors.ts  │  │       cache.ts          │ │    │
│  │  │             │  │             │  │             │  │                         │ │    │
│  │  │SearchResults│  │searchSchema │  │SearchError  │  │getCachedResults()       │ │    │
│  │  │SearchResult │  │retrieveSchem│  │SearchErrCode│  │setCachedResults()       │ │    │
│  │  │  Item       │  │SearchParams │  │createSearch │  │clearSearchCache()       │ │    │
│  │  │SearchResult │  │RetrieveParam│  │  ErrorFrom  │  │getCacheStats()          │ │    │
│  │  │  Image      │  │             │  │  Response() │  │                         │ │    │
│  │  │SearchDepth  │  │             │  │createSearch │  │TTL: 1 hour              │ │    │
│  │  │SearchProvide│  │             │  │  ErrorFrom  │  │Max entries: 50          │ │    │
│  │  │  rType      │  │             │  │  Exception()│  │Storage: chrome.storage  │ │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────────┘ │    │
│  │                                                                                  │    │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐│    │
│  │  │                              a11y.ts                                        ││    │
│  │  │  - announceToScreenReader()  → Screen reader announcements                  ││    │
│  │  │  - createFocusTrap()         → Modal focus management                       ││    │
│  │  │  - handleListKeyNavigation() → Arrow key navigation                         ││    │
│  │  └─────────────────────────────────────────────────────────────────────────────┘│    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   PROVIDERS LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │                           src/search/providers/                                  │    │
│  │                                                                                  │    │
│  │  ┌─────────────────────────────┐    ┌─────────────────────────────────────────┐ │    │
│  │  │         base.ts             │    │            tavily.ts                    │ │    │
│  │  │                             │    │                                         │ │    │
│  │  │  interface SearchProvider   │    │  class TavilySearchProvider             │ │    │
│  │  │  - search(query, ...)       │◀───│    extends BaseSearchProvider           │ │    │
│  │  │                             │    │                                         │ │    │
│  │  │  abstract BaseSearchProvider│    │  API: https://api.tavily.com/search     │ │    │
│  │  │  - validateApiKey()         │    │                                         │ │    │
│  │  │  - sanitizeUrl()            │    │  Features:                              │ │    │
│  │  │  - createEmptyResult()      │    │  - Basic/Advanced search depth          │ │    │
│  │  │                             │    │  - Image results with descriptions      │ │    │
│  │  └─────────────────────────────┘    │  - Domain filtering                     │ │    │
│  │                                      │  - Min 5 results per query              │ │    │
│  │  ┌─────────────────────────────┐    │  - Query padding (min 5 chars)          │ │    │
│  │  │         index.ts            │    │                                         │ │    │
│  │  │                             │    └─────────────────────────────────────────┘ │    │
│  │  │  createSearchProvider()     │                                                │    │
│  │  │  - Factory function         │                                                │    │
│  │  │  - Returns provider by type │                                                │    │
│  │  └─────────────────────────────┘                                                │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   SETTINGS LAYER                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │                       src/utils/settings/searchSettings.ts                       │    │
│  │                                                                                  │    │
│  │  Storage Keys:                                                                   │    │
│  │  - searchSettings      → SearchSettings object                                   │    │
│  │  - searchApiKeys       → SearchApiKeys object (separate for security)            │    │
│  │                                                                                  │    │
│  │  SearchSettings Interface:                                                       │    │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐│    │
│  │  │  enabled: boolean              // Master toggle                             ││    │
│  │  │  defaultProvider: 'tavily'     // Provider selection                        ││    │
│  │  │  defaultSearchDepth: 'basic'   // Default depth                             ││    │
│  │  │  maxResults: 10                // Results per search                        ││    │
│  │  │  includeImages: true           // Include image results                     ││    │
│  │  └─────────────────────────────────────────────────────────────────────────────┘│    │
│  │                                                                                  │    │
│  │  Functions:                                                                      │    │
│  │  - getSearchSettings()        → Load settings from storage                       │    │
│  │  - saveSearchSettings()       → Persist settings                                 │    │
│  │  - getSearchApiKeys()         → Load API keys                                    │    │
│  │  - saveSearchApiKeys()        → Persist API keys                                 │    │
│  │  - isSearchEnabled()          → Quick enabled check                              │    │
│  │  - getApiKeyForProvider()     → Get specific provider key                        │    │
│  │  - hasApiKeyForProvider()     → Check if key exists                              │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                  EXTERNAL SERVICES                                       │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  ┌─────────────────────────────────┐    ┌─────────────────────────────────────────┐     │
│  │        Tavily Search API        │    │         Jina Reader API                 │     │
│  │  https://api.tavily.com/search  │    │  https://r.jina.ai/{url}                │     │
│  │                                 │    │                                         │     │
│  │  Used by: webSearch tool        │    │  Used by: retrieve tool                 │     │
│  │                                 │    │                                         │     │
│  │  Features:                      │    │  Features:                              │     │
│  │  - AI-optimized results         │    │  - Content extraction                   │     │
│  │  - 1000 free searches/month     │    │  - Removes ads/navigation               │     │
│  │  - Image search support         │    │  - Generated alt text                   │     │
│  │  - Domain filtering             │    │  - No API key required                  │     │
│  └─────────────────────────────────┘    └─────────────────────────────────────────┘     │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              WEB SEARCH DATA FLOW                                        │
└─────────────────────────────────────────────────────────────────────────────────────────┘

User Input                    AI Processing                    External API
    │                              │                                │
    ▼                              │                                │
┌─────────┐                        │                                │
│ "Search │                        │                                │
│ for X"  │                        │                                │
└────┬────┘                        │                                │
     │                             │                                │
     ▼                             │                                │
┌─────────────────┐                │                                │
│ Check Search    │                │                                │
│ Mode Enabled    │                │                                │
└────────┬────────┘                │                                │
         │                         │                                │
    ┌────┴────┐                    │                                │
    │ Enabled │                    │                                │
    └────┬────┘                    │                                │
         │                         │                                │
         ▼                         │                                │
┌─────────────────┐                │                                │
│ AI Receives     │                │                                │
│ Search Prompt   │◀───────────────┤                                │
│ Addition        │                │                                │
└────────┬────────┘                │                                │
         │                         │                                │
         ▼                         │                                │
┌─────────────────┐                │                                │
│ AI Decides to   │                │                                │
│ Call webSearch  │────────────────┤                                │
└────────┬────────┘                │                                │
         │                         │                                │
         ▼                         ▼                                │
┌─────────────────┐    ┌─────────────────┐                          │
│ Tool Execution  │───▶│ Load Settings   │                          │
│ Triggered       │    │ & API Key       │                          │
└─────────────────┘    └────────┬────────┘                          │
                                │                                   │
                                ▼                                   │
                       ┌─────────────────┐                          │
                       │ Check Cache     │                          │
                       └────────┬────────┘                          │
                                │                                   │
                    ┌───────────┴───────────┐                       │
                    │                       │                       │
               Cache Hit              Cache Miss                    │
                    │                       │                       │
                    ▼                       ▼                       │
           ┌─────────────┐         ┌─────────────────┐              │
           │ Return      │         │ Create Provider │              │
           │ Cached      │         │ (Tavily)        │              │
           │ Results     │         └────────┬────────┘              │
           └─────────────┘                  │                       │
                                            ▼                       │
                                   ┌─────────────────┐              │
                                   │ Execute Search  │──────────────┤
                                   │ API Call        │              │
                                   └────────┬────────┘              │
                                            │                       │
                                            │◀──────────────────────┤
                                            │    API Response       │
                                            ▼                       │
                                   ┌─────────────────┐              │
                                   │ Process Results │              │
                                   │ - Sanitize URLs │              │
                                   │ - Process Images│              │
                                   └────────┬────────┘              │
                                            │                       │
                                            ▼                       │
                                   ┌─────────────────┐              │
                                   │ Cache Results   │              │
                                   └────────┬────────┘              │
                                            │                       │
                                            ▼                       │
                                   ┌─────────────────┐              │
                                   │ Return to AI    │              │
                                   │ SearchResults   │              │
                                   └────────┬────────┘              │
                                            │                       │
         ┌──────────────────────────────────┘                       │
         │                                                          │
         ▼                                                          │
┌─────────────────┐                                                 │
│ AI Synthesizes  │                                                 │
│ Response with   │                                                 │
│ Citations       │                                                 │
└────────┬────────┘                                                 │
         │                                                          │
         ▼                                                          │
┌─────────────────┐                                                 │
│ Display Results │                                                 │
│ in Chat UI      │                                                 │
└─────────────────┘                                                 │
```

## Component Details

### 1. Core Search Module (`src/search/`)

| File | Purpose |
|------|---------|
| `index.ts` | Barrel exports for all search functionality |
| `types.ts` | TypeScript interfaces: `SearchResults`, `SearchResultItem`, `SearchResultImage`, `SearchDepth`, `SearchProviderType` |
| `schema.ts` | Zod schemas for tool parameters: `searchSchema`, `retrieveSchema` |
| `errors.ts` | Error handling: `SearchError` class, error codes, factory functions |
| `cache.ts` | Result caching with 1-hour TTL, max 50 entries, Chrome storage |
| `a11y.ts` | Accessibility utilities: screen reader announcements, focus traps, keyboard navigation |

### 2. Search Providers (`src/search/providers/`)

| File | Purpose |
|------|---------|
| `base.ts` | Abstract `BaseSearchProvider` class with common utilities |
| `tavily.ts` | `TavilySearchProvider` implementation for Tavily API |
| `index.ts` | Factory function `createSearchProvider()` |

### 3. AI Tools (`src/actions/search/`)

| Tool | Name | Purpose |
|------|------|---------|
| `useWebSearch.tsx` | `webSearch` | Search the web for current information |
| `useRetrieve.tsx` | `retrieve` | Extract content from specific URLs via Jina Reader |

### 4. AI Integration (`src/ai/`)

| File | Purpose |
|------|---------|
| `agents/searchAgentConfig.ts` | Creates AI agent configuration with search capabilities |
| `prompts/searchPrompt.ts` | System prompt additions for search mode |
| `tools/searchToolFilter.ts` | Filters tools based on search mode state |

### 5. React Hooks (`src/hooks/`)

| Hook | Purpose |
|------|---------|
| `useSearchMode.ts` | Manages search mode state with Chrome storage persistence |
| `useSearchModeWithAI.ts` | Extends `useSearchMode` with AI configuration |

### 6. Settings (`src/utils/settings/`)

| File | Purpose |
|------|---------|
| `searchSettings.ts` | CRUD operations for search settings and API keys |

### 7. UI Components (`src/components/features/chat/components/search/`)

| Component | Purpose |
|-----------|---------|
| `SearchModeToggle.tsx` | Toggle button to enable/disable search mode |
| `SearchDepthSelector.tsx` | Selector for basic/advanced search depth |
| `SearchControls.tsx` | Combined search control panel |
| `SearchSection.tsx` | Container for search results display |
| `SearchResults.tsx` | List of search result items |
| `SearchResultsImageSection.tsx` | Image results grid |
| `RetrieveSection.tsx` | Display for retrieved URL content |
| `SourceCitation.tsx` | Individual source citation component |
| `CitationList.tsx` | List of all citations |
| `RelatedQuestions.tsx` | Suggested follow-up questions |

### 8. Settings UI (`src/components/features/settings/`)

| Component | Purpose |
|-----------|---------|
| `SearchSettingsSection.tsx` | Full settings panel for web search configuration |

## Configuration Options

### SearchSettings Interface

```typescript
interface SearchSettings {
    enabled: boolean;              // Master toggle for web search
    defaultProvider: 'tavily';     // Search provider (currently only Tavily)
    defaultSearchDepth: 'basic' | 'advanced';  // Default search depth
    maxResults: number;            // Max results per search (1-20)
    includeImages: boolean;        // Include image results
}
```

### SearchApiKeys Interface

```typescript
interface SearchApiKeys {
    tavily?: string;  // Tavily API key
}
```

## Tool Schemas

### webSearch Tool

```typescript
const searchSchema = z.object({
    query: z.string().min(1),
    max_results: z.number().int().min(1).max(20).optional().default(10),
    search_depth: z.enum(['basic', 'advanced']).optional().default('basic'),
    include_domains: z.array(z.string()).optional().default([]),
    exclude_domains: z.array(z.string()).optional().default([]),
});
```

### retrieve Tool

```typescript
const retrieveSchema = z.object({
    url: z.string().url(),
});
```

## Error Handling

### Error Codes

| Code | Description | Retryable |
|------|-------------|-----------|
| `NO_API_KEY` | API key not configured | No |
| `INVALID_API_KEY` | API key rejected | No |
| `RATE_LIMITED` | Rate limit exceeded | Yes |
| `NETWORK_ERROR` | Network request failed | Yes |
| `PROVIDER_ERROR` | Provider returned error | Yes |
| `TIMEOUT` | Request timed out | Yes |
| `INVALID_QUERY` | Query validation failed | No |
| `UNKNOWN` | Unknown error | No |

## Caching Strategy

- **Storage**: Chrome local storage
- **TTL**: 1 hour (3,600,000 ms)
- **Max Entries**: 50
- **Cache Key Format**: `{query}:{provider}:{depth}`
- **Pruning**: LRU-based when exceeding max entries

## AI Prompt Integration

When search mode is enabled, the AI receives additional system prompt instructions:

1. **When to use webSearch**: Current events, uncertain facts, time-sensitive data
2. **When to use retrieve**: Deep-dive into specific URLs from search results
3. **Search depth selection**: Basic for simple queries, advanced for complex topics
4. **Citation format**: `[Source Title](url)` inline citations
5. **Response structure**: Search → Synthesize → Cite → Note time-sensitivity

## Security Considerations

1. API keys stored separately from settings
2. Keys stored in Chrome local storage (extension-only access)
3. URL sanitization removes tracking parameters
4. No API keys logged or exposed in UI
5. Password input type for API key fields

## Accessibility Features

1. Screen reader announcements for search status
2. Focus trap for modal dialogs
3. Keyboard navigation for result lists
4. ARIA labels on all interactive elements
5. Proper heading hierarchy in settings


## Sequence Diagrams

### Web Search Flow

```
┌──────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌────────────┐     ┌───────────┐
│ User │     │ Chat UI     │     │ AI Agent     │     │ webSearch   │     │ Provider   │     │ Tavily    │
│      │     │             │     │              │     │ Tool        │     │ Factory    │     │ API       │
└──┬───┘     └──────┬──────┘     └──────┬───────┘     └──────┬──────┘     └─────┬──────┘     └─────┬─────┘
   │                │                   │                    │                  │                  │
   │ "Search for    │                   │                    │                  │                  │
   │  latest news"  │                   │                    │                  │                  │
   │───────────────▶│                   │                    │                  │                  │
   │                │                   │                    │                  │                  │
   │                │ Send message      │                    │                  │                  │
   │                │ + search prompt   │                    │                  │                  │
   │                │──────────────────▶│                    │                  │                  │
   │                │                   │                    │                  │                  │
   │                │                   │ Decide to search   │                  │                  │
   │                │                   │ Call webSearch     │                  │                  │
   │                │                   │───────────────────▶│                  │                  │
   │                │                   │                    │                  │                  │
   │                │                   │                    │ Load settings    │                  │
   │                │                   │                    │ Get API key      │                  │
   │                │                   │                    │─────────────────▶│                  │
   │                │                   │                    │                  │                  │
   │                │                   │                    │ Create provider  │                  │
   │                │                   │                    │◀─────────────────│                  │
   │                │                   │                    │                  │                  │
   │                │                   │                    │ Execute search   │                  │
   │                │                   │                    │─────────────────────────────────────▶│
   │                │                   │                    │                  │                  │
   │                │                   │                    │                  │   JSON Response  │
   │                │                   │                    │◀─────────────────────────────────────│
   │                │                   │                    │                  │                  │
   │                │                   │                    │ Process & cache  │                  │
   │                │                   │                    │ results          │                  │
   │                │                   │                    │                  │                  │
   │                │                   │ SearchResults      │                  │                  │
   │                │                   │◀───────────────────│                  │                  │
   │                │                   │                    │                  │                  │
   │                │                   │ Synthesize answer  │                  │                  │
   │                │                   │ with citations     │                  │                  │
   │                │                   │                    │                  │                  │
   │                │ Stream response   │                    │                  │                  │
   │                │◀──────────────────│                    │                  │                  │
   │                │                   │                    │                  │                  │
   │ Display answer │                   │                    │                  │                  │
   │ with sources   │                   │                    │                  │                  │
   │◀───────────────│                   │                    │                  │                  │
   │                │                   │                    │                  │                  │
```

### URL Retrieve Flow

```
┌──────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌───────────┐
│ User │     │ Chat UI     │     │ AI Agent     │     │ retrieve    │     │ Jina      │
│      │     │             │     │              │     │ Tool        │     │ Reader    │
└──┬───┘     └──────┬──────┘     └──────┬───────┘     └──────┬──────┘     └─────┬─────┘
   │                │                   │                    │                  │
   │ "Read this     │                   │                    │                  │
   │  article"      │                   │                    │                  │
   │───────────────▶│                   │                    │                  │
   │                │                   │                    │                  │
   │                │ Send message      │                    │                  │
   │                │──────────────────▶│                    │                  │
   │                │                   │                    │                  │
   │                │                   │ Call retrieve      │                  │
   │                │                   │ with URL           │                  │
   │                │                   │───────────────────▶│                  │
   │                │                   │                    │                  │
   │                │                   │                    │ GET /url         │
   │                │                   │                    │─────────────────▶│
   │                │                   │                    │                  │
   │                │                   │                    │ Extracted content│
   │                │                   │                    │◀─────────────────│
   │                │                   │                    │                  │
   │                │                   │                    │ Truncate to      │
   │                │                   │                    │ 10,000 chars     │
   │                │                   │                    │                  │
   │                │                   │ SearchResults      │                  │
   │                │                   │◀───────────────────│                  │
   │                │                   │                    │                  │
   │                │                   │ Summarize content  │                  │
   │                │                   │                    │                  │
   │                │ Stream response   │                    │                  │
   │                │◀──────────────────│                    │                  │
   │                │                   │                    │                  │
   │ Display        │                   │                    │                  │
   │ summary        │                   │                    │                  │
   │◀───────────────│                   │                    │                  │
   │                │                   │                    │                  │
```

### Settings Configuration Flow

```
┌──────┐     ┌─────────────────────┐     ┌─────────────────┐     ┌───────────────┐
│ User │     │ SearchSettings      │     │ searchSettings  │     │ Chrome        │
│      │     │ Section             │     │ .ts             │     │ Storage       │
└──┬───┘     └──────────┬──────────┘     └────────┬────────┘     └───────┬───────┘
   │                    │                         │                      │
   │ Open Settings      │                         │                      │
   │───────────────────▶│                         │                      │
   │                    │                         │                      │
   │                    │ getSearchSettings()     │                      │
   │                    │────────────────────────▶│                      │
   │                    │                         │                      │
   │                    │                         │ chrome.storage.get() │
   │                    │                         │─────────────────────▶│
   │                    │                         │                      │
   │                    │                         │ Settings data        │
   │                    │                         │◀─────────────────────│
   │                    │                         │                      │
   │                    │ SearchSettings          │                      │
   │                    │◀────────────────────────│                      │
   │                    │                         │                      │
   │ Display settings   │                         │                      │
   │◀───────────────────│                         │                      │
   │                    │                         │                      │
   │ Enter API key      │                         │                      │
   │───────────────────▶│                         │                      │
   │                    │                         │                      │
   │                    │ saveSearchApiKeys()     │                      │
   │                    │────────────────────────▶│                      │
   │                    │                         │                      │
   │                    │                         │ chrome.storage.set() │
   │                    │                         │─────────────────────▶│
   │                    │                         │                      │
   │                    │                         │ Success              │
   │                    │                         │◀─────────────────────│
   │                    │                         │                      │
   │ Click "Test"       │                         │                      │
   │───────────────────▶│                         │                      │
   │                    │                         │                      │
   │                    │ Test API call to Tavily │                      │
   │                    │─────────────────────────────────────────────────────────▶ Tavily API
   │                    │                         │                      │
   │                    │ Response (200 OK)       │                      │
   │                    │◀─────────────────────────────────────────────────────────
   │                    │                         │                      │
   │ Show "Success"     │                         │                      │
   │◀───────────────────│                         │                      │
   │                    │                         │                      │
```

## File Structure Summary

```
src/
├── search/                              # Core search module
│   ├── index.ts                         # Barrel exports
│   ├── types.ts                         # TypeScript interfaces
│   ├── schema.ts                        # Zod validation schemas
│   ├── errors.ts                        # Error handling
│   ├── cache.ts                         # Result caching
│   ├── a11y.ts                          # Accessibility utilities
│   └── providers/                       # Search providers
│       ├── index.ts                     # Provider factory
│       ├── base.ts                      # Abstract base class
│       └── tavily.ts                    # Tavily implementation
│
├── actions/search/                      # AI tool actions
│   ├── index.ts                         # Barrel exports
│   ├── useWebSearch.tsx                 # Web search tool
│   └── useRetrieve.tsx                  # URL retrieve tool
│
├── ai/
│   ├── agents/
│   │   └── searchAgentConfig.ts         # Search agent configuration
│   ├── prompts/
│   │   └── searchPrompt.ts              # Search system prompts
│   └── tools/
│       └── searchToolFilter.ts          # Tool filtering by search mode
│
├── hooks/
│   ├── useSearchMode.ts                 # Search mode state hook
│   └── useSearchModeWithAI.ts           # Extended hook with AI config
│
├── utils/settings/
│   └── searchSettings.ts                # Settings CRUD operations
│
└── components/features/
    ├── chat/components/search/          # Chat search components
    │   ├── index.ts                     # Barrel exports
    │   ├── SearchModeToggle.tsx         # Enable/disable toggle
    │   ├── SearchDepthSelector.tsx      # Depth selector
    │   ├── SearchControls.tsx           # Combined controls
    │   ├── SearchSection.tsx            # Results container
    │   ├── SearchResults.tsx            # Results list
    │   ├── SearchResultsImageSection.tsx# Image results
    │   ├── RetrieveSection.tsx          # Retrieved content
    │   ├── SourceCitation.tsx           # Single citation
    │   ├── CitationList.tsx             # Citation list
    │   └── RelatedQuestions.tsx         # Follow-up suggestions
    │
    └── settings/components/
        └── SearchSettingsSection.tsx    # Settings UI panel
```

## Integration Points

### 1. Tool Registration

Tools are registered via React hooks that call `registerTool()`:

```typescript
// In useWebSearch.tsx
registerTool({
    name: WEB_SEARCH_TOOL_NAME,
    description: TOOL_DESCRIPTION,
    parameters: searchSchema,
    execute: executeWebSearch,
});
```

### 2. AI Agent Configuration

Search configuration is merged into AI agent options:

```typescript
// In searchAgentConfig.ts
const config = createSearchAgentConfig(baseTools, searchEnabled, searchDepth);
const mergedOptions = mergeSearchConfig(baseOptions, config);
```

### 3. Tool Filtering

Tools are filtered based on search mode state:

```typescript
// In searchToolFilter.ts
const activeTools = filterToolsBySearchMode(allTools, searchEnabled);
```

### 4. Settings Persistence

Settings use Chrome storage with separate keys for security:

```typescript
// Settings stored at 'searchSettings'
// API keys stored at 'searchApiKeys' (separate for security)
```

## Future Extensibility

The architecture supports adding new search providers:

1. Create new provider class extending `BaseSearchProvider`
2. Add provider type to `SearchProviderType` union
3. Update `createSearchProvider()` factory
4. Add API key field to `SearchApiKeys` interface
5. Update settings UI with new provider option

## Performance Considerations

1. **Caching**: 1-hour TTL reduces redundant API calls
2. **Lazy Loading**: Settings loaded on-demand
3. **Debouncing**: UI updates batched during streaming
4. **Content Limits**: Retrieved content truncated to 10,000 characters
5. **Result Limits**: Max 20 results per search to control payload size
