# Multi-Phase Implementation Plan: Web Search Integration for Cognito AI

## Overview

Integrate Morphic-style web search capabilities into the Cognito Chrome Extension, adding a search icon in the chat input composer beside the tools icon, with controllable search depth and rich search result display.

---

## Phase 1: Search Infrastructure Setup

### 1.1 Search Provider Architecture
**Goal:** Create a flexible search provider system similar to Morphic's architecture

**Tasks:**
1. Create `src/search/` directory structure:
   ```
   src/search/
   ├── providers/
   │   ├── base.ts           # BaseSearchProvider abstract class
   │   ├── tavily.ts         # Tavily search provider
   │   ├── serper.ts         # Serper.dev search (alternative)
   │   ├── brave.ts          # Brave Search API (alternative)
   │   └── index.ts          # Provider factory
   ├── types.ts              # SearchResults, SearchResultItem types
   ├── schema.ts             # Zod schemas for search parameters
   └── index.ts              # Main exports
   ```

2. Define search types (adapt from Morphic's `lib/types/index.ts`):
   - `SearchResults` interface
   - `SearchResultItem` interface
   - `SearchResultImage` type
   - `SearchDepth` enum ('basic' | 'advanced')

3. Implement `BaseSearchProvider` abstract class with:
   - `search()` method signature
   - API key validation helpers
   - Error handling patterns

4. Implement at least one provider (recommend Tavily as default like Morphic)

### 1.2 Search Configuration Storage
**Goal:** Store search API keys and preferences using Chrome storage

**Tasks:**
1. Extend `src/utils/providerCredentials.ts` to include search provider credentials
2. Add search settings to `src/utils/settingsStorage.ts`:
   - Default search provider
   - Default search depth
   - Max results preference
3. Create `src/constants/searchProviders.tsx` for provider configurations

---

## Phase 2: Search Tool Registration

### 2.1 Create Search Tool Hook
**Goal:** Register web search as an AI tool following the existing tool pattern

**Tasks:**
1. Create `src/actions/search/` directory:
   ```
   src/actions/search/
   ├── useWebSearch.tsx      # Main search tool hook
   ├── useRetrieve.tsx       # URL content retrieval tool
   ├── index.ts              # Exports
   └── types.ts              # Tool-specific types
   ```

2. Implement `useWebSearch` hook following the tool pattern:
   - Register with `registerTool()` from `src/ai/tools/registryUtils.ts`
   - Zod schema with `.describe()` for parameters:
     - `query` (required)
     - `max_results` (optional, default 10)
     - `search_depth` ('basic' | 'advanced')
     - `include_domains` (optional array)
     - `exclude_domains` (optional array)
   - Tool description in USE/REQUIRES/BEHAVIOR/RETURNS format
   - Register UI with `registerToolUI()` for CompactToolRenderer

3. Implement `useRetrieve` hook for URL content extraction:
   - Uses Jina Reader API or similar
   - Extracts main content from URLs
   - Character limit handling (10000 chars like Morphic)

4. Update `src/actions/registerAll.ts` to include search tools

5. Add descriptions to `src/constants/toolDescriptions.ts`

### 2.2 Search Mode State Management
**Goal:** Create a search mode toggle similar to Morphic's cookie-based approach

**Tasks:**
1. Create `src/hooks/useSearchMode.ts`:
   - Store search mode preference in Chrome storage
   - Default enabled state
   - Toggle functionality
2. Expose search mode state to AI agent prompts
3. Update agent system instructions to use search tools when search mode is enabled

---

## Phase 3: Composer UI Components

### 3.1 Search Mode Toggle Component
**Goal:** Create a toggle button for the composer left section

**Tasks:**
1. Create `src/components/features/chat/components/SearchModeToggle.tsx`:
   - Similar to Morphic's `search-mode-toggle.tsx`
   - Globe icon from Lucide
   - Toggle pressed state with visual feedback
   - Tooltip explaining search mode
   - Styling consistent with existing composer buttons

2. Style file: `src/styles/components/search-mode-toggle.css`:
   - Default/pressed states
   - Hover/focus states
   - Icon animations

### 3.2 Search Depth Selector
**Goal:** Allow users to control search depth (basic/advanced)

**Tasks:**
1. Create `src/components/features/chat/components/SearchDepthSelector.tsx`:
   - Dropdown or popover component
   - Options: Basic (faster) / Advanced (deeper)
   - Description of each mode
   - Icon indicator for current depth

2. Integrate into `SearchModeToggle` as a sub-option or separate button

### 3.3 Composer Integration
**Goal:** Add search controls to the composer's left section

**Tasks:**
1. Update `Composer.tsx`:
   - Add `SearchModeToggle` next to `ModeSelector` and tools button
   - Pass search mode state and handlers
   - Conditionally show search depth when search mode is on

2. Update `ChatInput.tsx`:
   - Add search mode state management
   - Pass to Composer

3. Add props to `CopilotChatWindow.tsx` for search state

---

## Phase 4: Search Results Display Components

### 4.1 Search Section Component
**Goal:** Display search tool invocation and results

**Tasks:**
1. Create `src/components/features/chat/components/SearchSection.tsx`:
   - Collapsible container (similar to Morphic's pattern)
   - Header showing query and result count
   - Uses existing `CollapsibleMessage` or new collapsible pattern
   - Loading skeleton state

2. Adapt styles from Morphic for consistency

### 4.2 Search Results Grid/List
**Goal:** Display individual search results

**Tasks:**
1. Create `src/components/features/chat/components/SearchResults.tsx`:
   - Grid mode (2-4 columns) for compact view
   - List mode for detailed view
   - Each result shows:
     - Favicon (from Google's favicon service)
     - Title (truncated)
     - Content snippet
     - Source domain
   - "View more" button for expanded results

2. Create `src/components/features/chat/components/SearchResultCard.tsx`:
   - Individual result card component
   - Click to open URL in new tab
   - Hover effects

### 4.3 Search Images Section
**Goal:** Display image results from search

**Tasks:**
1. Create `src/components/features/chat/components/SearchResultsImageSection.tsx`:
   - Horizontal scroll or grid layout
   - Thumbnail previews
   - Full image view on click
   - Optional image descriptions

### 4.4 Tool UI Registration
**Goal:** Connect search UI to the tool rendering system

**Tasks:**
1. Register search tool UI in `useWebSearch.tsx`:
   ```typescript
   registerToolUI('webSearch', (props) => (
     <SearchSection 
       tool={props.toolInvocation}
       isOpen={props.isOpen}
       onOpenChange={props.onOpenChange}
     />
   ));
   ```

2. Update `ToolRenderer` or message rendering to handle search tool

---

## Phase 5: AI Agent Integration

### 5.1 Update Browser Action Agent Prompts
**Goal:** Instruct the AI when and how to use search

**Tasks:**
1. Update `src/ai/agents/browser/prompts.ts`:
   - Add search tool usage guidelines
   - Citation format instructions (Morphic uses `[number](url)`)
   - When to search vs. use existing knowledge
   - Search depth selection logic

2. Add search-specific system instructions:
   - Use search for current events, facts, recent information
   - Use retrieve for deep-diving into specific URLs
   - Always cite sources in responses

### 5.2 Search Mode Conditional Tools
**Goal:** Enable/disable search tools based on search mode

**Tasks:**
1. Update tool filtering in `src/ai/core/aiLogic.ts`:
   - Check search mode setting
   - Include/exclude search tools from active tools
   - Similar to Morphic's `experimental_activeTools`

2. Create helper to get enabled search tools

---

## Phase 6: Settings & Configuration UI

### 6.1 Search Settings Section
**Goal:** Add search configuration to settings page

**Tasks:**
1. Create `src/components/features/settings/components/SearchSettings.tsx`:
   - Search provider selection
   - API key input for selected provider
   - Default search depth preference
   - Default max results slider
   - Enable/disable search by default

2. Update `SettingsPage.tsx` to include SearchSettings section

### 6.2 Provider Setup for Search
**Goal:** Guide users through search API setup

**Tasks:**
1. Update `ProviderSetup.tsx` or create `SearchProviderSetup.tsx`:
   - Instructions for getting API keys
   - Links to provider dashboards (Tavily, Serper, etc.)
   - Test connection button
   - Pricing/usage information

---

## Phase 7: Answer Enhancement

### 7.1 Source Citations in Messages
**Goal:** Display cited sources in AI responses

**Tasks:**
1. Create `src/components/features/chat/components/SourceCitation.tsx`:
   - Inline citation links `[1]`, `[2]`, etc.
   - Hover preview of source
   - Click to open source URL

2. Update markdown renderer to parse and render citations

### 7.2 Related Questions
**Goal:** Show follow-up question suggestions (like Morphic)

**Tasks:**
1. Create `src/components/features/chat/components/RelatedQuestions.tsx`:
   - Display AI-generated follow-up questions
   - Click to search/ask that question
   - Collapsible section

2. Add related questions tool or annotation parsing

---

## Phase 8: Testing & Polish

### 8.1 Error Handling
**Tasks:**
1. Handle search API errors gracefully
2. Fallback behavior when search fails
3. Rate limit handling
4. Display user-friendly error messages

### 8.2 Performance Optimization
**Tasks:**
1. Implement result caching (similar to Morphic's Redis approach, but using Chrome storage or IndexedDB)
2. Debounce search triggers
3. Lazy load search result images

### 8.3 Accessibility
**Tasks:**
1. Keyboard navigation for search results
2. Screen reader support for search sections
3. Focus management for collapsible sections

### 8.4 Testing
**Tasks:**
1. Test with different search providers
2. Test search depth variations
3. Test error scenarios (no API key, rate limits, network errors)
4. Test UI responsiveness in sidepanel dimensions

---

## Implementation Priority & Dependencies

```
Phase 1 ─────► Phase 2 ─────► Phase 5
    │              │              │
    ▼              ▼              ▼
Phase 6        Phase 3        Phase 7
                   │
                   ▼
               Phase 4
                   │
                   ▼
               Phase 8
```

**Recommended Order:**
1. **Phase 1** → Core infrastructure (required for everything)
2. **Phase 2** → Tool registration (enables AI usage)
3. **Phase 3** → Composer UI (user interaction)
4. **Phase 4** → Results display (complete user experience)
5. **Phase 5** → Agent integration (AI behavior)
6. **Phase 6** → Settings (configuration)
7. **Phase 7** → Polish features (enhanced UX)
8. **Phase 8** → Testing & polish

---

## Key Files to Modify

### Existing Files:
| File | Changes |
|------|---------|
| `src/components/features/chat/components/Composer.tsx` | Add search toggle |
| `src/components/features/chat/components/ChatInput.tsx` | Search state |
| `src/components/core/CopilotChatWindow.tsx` | Props passing |
| `src/actions/registerAll.ts` | Register search tools |
| `src/constants/toolDescriptions.ts` | Tool descriptions |
| `src/ai/agents/browser/prompts.ts` | Agent instructions |
| `src/ai/core/aiLogic.ts` | Tool filtering |
| `src/utils/providerCredentials.ts` | Search API keys |
| `src/utils/settingsStorage.ts` | Search settings |
| `src/components/features/settings/SettingsPage.tsx` | Settings UI |

### New Files to Create:
| Directory/File | Purpose |
|----------------|---------|
| `src/search/` | Entire search infrastructure |
| `src/actions/search/` | Search tools |
| `src/hooks/useSearchMode.ts` | Search mode state |
| `src/components/features/chat/components/SearchModeToggle.tsx` | Toggle button |
| `src/components/features/chat/components/SearchDepthSelector.tsx` | Depth dropdown |
| `src/components/features/chat/components/SearchSection.tsx` | Results container |
| `src/components/features/chat/components/SearchResults.tsx` | Results grid/list |
| `src/components/features/chat/components/SearchResultCard.tsx` | Result card |
| `src/components/features/chat/components/SearchResultsImageSection.tsx` | Image results |
| `src/components/features/settings/components/SearchSettings.tsx` | Settings section |
| `src/styles/components/search-mode-toggle.css` | Toggle styles |
| `src/styles/features/search/` | Search-specific styles |

---

## Estimated Effort

| Phase | Estimated Time | Complexity |
|-------|---------------|------------|
| Phase 1 | 2-3 days | Medium |
| Phase 2 | 1-2 days | Medium |
| Phase 3 | 1-2 days | Low |
| Phase 4 | 2-3 days | Medium |
| Phase 5 | 1 day | Low |
| Phase 6 | 1 day | Low |
| Phase 7 | 1-2 days | Medium |
| Phase 8 | 1-2 days | Low |

**Total: 10-17 days of development**

---

## Technical Considerations

### 1. API Key Security
- Store search API keys in Chrome's encrypted storage
- Never expose in content scripts
- Use background service worker for API calls

### 2. Rate Limiting
- Implement client-side rate limiting to prevent API abuse
- Show user-friendly messages when limits are hit
- Consider caching to reduce API calls

### 3. Caching Strategy
- Use IndexedDB for caching search results with TTL
- Cache key: `${query}:${depth}:${provider}`
- Default TTL: 1 hour (similar to Morphic's Redis approach)

### 4. Bundle Size
- Consider lazy loading search provider code
- Dynamic imports for provider implementations
- Minimize initial bundle impact

### 5. Service Worker Limitations
- Search API calls must go through background service worker for CORS
- Implement message passing for search requests
- Handle service worker restarts gracefully

### 6. Context Window Management
- Search results consume tokens
- Implement result truncation and relevance scoring
- Limit content length per result (e.g., 500 chars)

---

## Reference: Morphic Architecture

Key patterns to adapt from Morphic:

1. **Search Provider Factory** (`lib/tools/search/providers/index.ts`)
   - `createSearchProvider()` factory function
   - Provider-specific implementations

2. **Search Tool** (`lib/tools/search.ts`)
   - Zod schema with model-specific variants
   - Search depth handling

3. **UI Components**
   - `SearchSection` - Collapsible results container
   - `SearchResults` - Grid/list display
   - `SearchModeToggle` - Toggle button

4. **Streaming Integration**
   - Tool invocation in stream response
   - Progressive result rendering

5. **Agent Configuration**
   - `experimental_activeTools` for conditional tool enabling
   - `maxSteps` for multi-turn tool usage

---

## Success Criteria

- [ ] User can toggle search mode on/off from composer
- [ ] User can select search depth (basic/advanced)
- [ ] AI uses search tool when search mode is enabled
- [ ] Search results display in collapsible sections
- [ ] Results show favicon, title, snippet, source
- [ ] Citations appear in AI responses
- [ ] Settings allow provider/API key configuration
- [ ] Errors are handled gracefully with user feedback
- [ ] Performance is acceptable (< 3s for basic search)
- [ ] Works in sidepanel dimensions (narrow width)
