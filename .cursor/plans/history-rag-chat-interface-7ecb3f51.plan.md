<!-- 7ecb3f51-43f6-443b-805a-a9ab43ac5ef7 f49dffab-8fe0-42af-b1c1-a5a2b32102a5 -->
# History Tab RAG Chat Interface Revamp

## Overview

Transform the History tab into a chat-based interface powered by Chrome AI (Gemini Nano) with RAG (Retrieval-Augmented Generation). Users ask natural questions like "where did I read about CDC?" and receive conversational answers based on their indexed browsing history.

## Architecture

**Flow:**

1. User enters question → Hybrid search retrieves relevant chunks
2. Top results formatted as context → Passed to Gemini Nano
3. AI generates answer → Display with source citations
4. Settings accessible via drawer icon → Processing status in expandable section

**Key Files:**

- `src/pages/history/index.tsx` - Main history page (revamp)
- `src/pages/history/components.tsx` - UI components (add new ones)
- `src/pages/history/useHistoryRAG.ts` - New hook for RAG logic
- `src/pages/history/history.css` - Styling updates
- `src/sidepanel.tsx` - Already integrated, minimal changes

## Implementation Plan

### Phase 1: Create History RAG Hook

**File: `src/pages/history/useHistoryRAG.ts`**

Create hook that:

- Takes user query string
- Runs hybrid search via chrome.runtime.sendMessage
- Formats top K results (chunks/pages with snippets) as context
- Constructs system prompt for Gemini Nano
- Streams AI response
- Returns: messages array, isLoading, error, sendMessage function

Key integration points:

- Use existing `hybridSearch` backend via message passing
- Initialize Chrome AI session (similar to sidepanel.tsx lines 40-117)
- Format context as: "Based on your browsing history:\n[URL] Title - Snippet\n..."

### Phase 2: Revamp History Page Component

**File: `src/pages/history/index.tsx`**

Replace current search interface with:

- Chat message list (user questions + AI answers)
- Input field at bottom for asking questions
- Header with title and settings icon button
- State: messages, showSettingsDrawer, showStatusDropdown

Remove:

- SearchInput, FiltersBar from main view
- ResultsSummary, ResultGroup display
- Move privacy controls to drawer

Keep:

- useSettings hook for accessing settings
- Banner components for status messages
- Empty state for when model not ready

### Phase 3: Create Settings Drawer Component

**File: `src/pages/history/components.tsx` (add new component)**

`SettingsDrawer` component:

- Slides in from right when settings icon clicked
- Contains all existing controls:
  - PrivacyControls (pause, allowlist, denylist, delete data)
  - DateFilter for query filtering
  - DomainFilter for query filtering
- Close button (X) at top right
- Backdrop overlay that closes drawer when clicked

Props: `open`, `onClose`, plus all existing control props

### Phase 4: Create Processing Status Component

**File: `src/pages/history/components.tsx` (add new component)**

`ProcessingStatusDropdown` component:

- Expandable/collapsible section (accordion style)
- Shows when clicked or always visible in drawer
- Displays:
  - Index stats (pages indexed, size)
  - Queue stats (pending, failed)
  - Currently processing pages (with URLs)
  - Estimated time/progress
- Uses existing ProcessingStatus component logic (lines 893-1035)

### Phase 5: Create Chat Message Components

**File: `src/pages/history/components.tsx` (add new components)**

`HistoryChatMessage` component:

- User message: question asked
- Assistant message: AI answer with source citations
- Source citations: clickable links to open pages
- Show relevance scores (optional)
- Copy button for AI answers

`HistoryMessageList` component:

- Renders list of messages
- Auto-scrolls to bottom
- Empty state: "Ask me anything about your browsing history"
- Loading state: typing indicator

### Phase 6: Update Styles

**File: `src/pages/history/history.css`**

Add styles for:

- `.history-chat-container` - Main chat layout
- `.history-chat-messages` - Message list scrollable area
- `.history-chat-input` - Input field at bottom
- `.history-settings-drawer` - Slide-in panel from right
- `.history-settings-overlay` - Backdrop overlay
- `.history-status-dropdown` - Expandable status section
- `.history-source-citation` - Link styling for sources
- `.history-chat-message` - Message bubble styling

Reuse existing chat styles from `sidepanel.css` where possible.

### Phase 7: Backend Message Integration

**Files: Check `src/background/message-handler.ts`**

Ensure message handlers exist for:

- `HistorySearch` - Hybrid search with query
- `GetIndexStats` - Already exists (line 286)
- `GetQueueStats` - Already exists (line 306)
- `GetProcessingStatus` - Already exists (line 312)

Add new handler if needed:

- `HistoryRAGSearch` - Runs hybrid search and returns formatted results

### Phase 8: Context Formatting & Prompting

In `useHistoryRAG.ts`, create system prompt:

```
You are a helpful AI assistant with access to the user's browsing history.
Answer questions based on the provided context from their browsing history.
Always cite your sources using the URLs provided.
If the context doesn't contain relevant information, say so.
```

User prompt format:

```
Based on this browsing history:

[1] {title} - {url}
{snippet}

[2] {title} - {url}
{snippet}

...

Question: {user_question}
```

### Phase 9: Testing & Polish

- Test RAG flow end-to-end
- Verify source citations work
- Test drawer open/close animations
- Test with empty index, paused state
- Ensure mobile responsiveness
- Test with long answers and many sources

## Key Design Decisions

1. **Reuse Chrome AI session management** from sidepanel.tsx
2. **Keep existing backend search logic** - only change how results are consumed
3. **Settings drawer** - familiar pattern, keeps chat area clean
4. **Status as dropdown** - accessible but not intrusive
5. **Source citations** - critical for trust and verification

## Files to Modify

- `src/pages/history/index.tsx` (major revamp)
- `src/pages/history/components.tsx` (add new components)
- `src/pages/history/useHistoryRAG.ts` (new file)
- `src/pages/history/history.css` (add new styles)
- `src/background/message-handler.ts` (minor - verify handlers exist)

## Files to Reference

- `src/sidepanel.tsx` (Chrome AI session setup)
- `src/components/ChatMessage.tsx` (chat UI patterns)
- `src/search/hybrid.ts` (understand search results format)

### To-dos

- [ ] Create useHistoryRAG.ts hook with hybrid search integration and Chrome AI session management
- [ ] Revamp index.tsx to use chat interface instead of search results display
- [ ] Create SettingsDrawer component that slides in from right with all privacy controls
- [ ] Create ProcessingStatusDropdown expandable component for queue/processing info
- [ ] Create HistoryChatMessage and HistoryMessageList components with source citations
- [ ] Add CSS styles for chat interface, drawer, status dropdown, and source citations
- [ ] Verify/add message handler for RAG search in message-handler.ts
- [ ] Test end-to-end RAG flow, source citations, drawer animations, and edge cases