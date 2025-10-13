<!-- 0b3b70e4-0960-4816-82b6-77a4b31cb630 c9e442f2-ccec-42cf-b345-29999a96d41a -->
# Remove History Search and Chat Features

## Overview

This plan removes all history search indexing, RAG (Retrieval-Augmented Generation), and history-related features from the extension. The extension will retain only the simple AI chat functionality in the sidepanel (no history integration).

## Components to Remove

### 1. Side Panel History Tab

**Files to modify:**

- `src/sidepanel.tsx` - Remove history tab, keep only chat tab
- Remove `HistoryPage` import (line 5)
- Remove `TabType` type with 'history' option (line 15)
- Remove history tab button from tab navigation (lines 313-318)
- Remove conditional rendering of history tab content (lines 399-403)
- Remove `openHistory` function (lines 299-301)
- Set default/only tab to 'chat'

### 2. History Page and Components

**Files/directories to delete:**

- `src/pages/history/` - Entire directory including:
- `index.tsx` (main history RAG chat interface)
- `useHistoryRAG.ts` (RAG hook with Chrome AI)
- `useHistorySearch.ts` (hybrid search hook)
- `useSettings.ts` (settings management)
- `useKeyboardNav.ts`, `useVirtualWindow.ts` (UI utilities)
- `components.tsx` (history-specific UI components)
- `types.ts`, `exports.ts`
- `history.css`, `privacy-controls.css`
- `*.md` documentation files

- `src/tabs/history.tsx` - Tab entry point for history page

### 3. Database - History Tables

**Files to modify:**

- `src/db/index.ts` - Remove history-related database tables and APIs:
- Remove `pages` table and related types (`PageRecord`, lines 18-27)
- Remove `chunks` table and related types (`ChunkRecord`, lines 29-39)
- Remove `images` table and related types (`ImageRecord`, lines 41-47)
- Remove `miniSearchIndex` table and related types (`MiniSearchIndexRecord`, lines 61-67)
- Remove `queue` table and related types (`QueueItem`, lines 49-59)
- Keep only: `settings`, `chatMessages` tables
- Remove all page/chunk/image/queue/miniSearch API functions (lines 229-492, 600-664, 695-786)
- Remove eviction and quota management (lines 695-785)
- Remove `wipeAllData` function model cache clearing logic (lines 862-874)
- Update database schema versions to remove history stores

### 4. Search Infrastructure

**Files/directories to delete:**

- `src/search/` - Entire directory including:
- `minisearch.ts` (sparse search with MiniSearch library)
- `dense.ts` (embedding-based dense search)
- `hybrid.ts` (combined search strategy)
- `types.ts`, `integration-example.ts`
- `__tests__/` directory with test files
- `*.md` documentation files

### 5. Background Service Worker

**Files to modify:**

- `src/background/message-handler.ts` - Remove history-related message handlers:
- Remove `PageSeen` handler (lines 30-57)
- Remove `ClearIndex` handler (lines 65-68)
- Remove `GetIndexStats` handler (lines 199-207)
- Remove `GetQueueStats` handler (lines 209-217)
- Remove `GetProcessingStatus` handler (lines 219-227)
- Remove `HistoryRAGSearch` handler (lines 229-302)
- Remove `CLEAR_INDEX` handler (lines 185-197)
- Keep only: settings, pause, model check handlers

**Files to delete:**

- `src/background/queue.ts` - Queue management for indexing
- `src/background/scheduler.ts` - Processing scheduler
- `src/background/alarms.ts` - Alarm-based scheduling
- `src/background/processing-state.ts` - Processing state tracking
- `src/background/offscreen-lifecycle.ts` - Offscreen document management
- `src/background/offscreen.ts` - Offscreen document communication
- `src/background/database.ts` - Database operations

**Keep:**

- `src/background/model-ready.ts` - Still needed for model status
- `src/background/settings.ts` - Still needed for basic settings
- `src/background/privacy.ts` - Keep for data wipe functionality
- `src/background/types.ts` - Update to remove history message types

**Files to modify:**

- `src/background/types.ts` - Remove history-related message types:
- Remove from `BgMsgFromContent`: `PageSeen`, `ClearIndex`, `GetIndexStats`, `GetQueueStats`, `GetProcessingStatus`, `CLEAR_INDEX`, `HistoryRAGSearch`
- Remove `BgQueueRecord` type
- Remove `BgMsgToOffscreen` and `OffscreenMsgToBg` types

- `src/background.ts` - Simplify to remove scheduler, queue, and offscreen logic

### 6. Content Scripts

**Files to delete:**

- `src/contents/extract.ts` - Content extraction and page seen messaging
- `src/contents/__tests__/` - Tests for extraction

**Keep:**

- `src/contents/plasmo.ts` - May have other purposes (needs review)

### 7. Offscreen Documents

**Files to delete:**

- `src/offscreen/` - Entire directory:
- `offscreen.ts` - Offscreen document for embeddings
- `bridge.ts` - Communication bridge
- `index.html` - Offscreen HTML
- `offscreen.html` (root) - Offscreen entry point

### 8. Workers

**Files to delete:**

- `src/workers/embed-worker.ts` - Embedding generation worker

### 9. Services

**Files to delete:**

- `src/services/localModelLoader.ts` - Local embedding model loading
- `src/services/modelBootstrap.ts` - Model initialization

### 10. Models

**Directories to delete:**

- `models/` - Local embedding model files
- `1.0.0/` - Model version directory (if only used for embeddings)

### 11. Popup

**Files to modify:**

- `src/popup.tsx` - Remove "Open History Search" button and related functionality:
- Remove `openHistory` function (lines 151-161)
- Remove history CTA section (lines 227-255)
- Remove `openError` state
- Remove status display for model readiness (it's for indexing)

### 12. Styles

**Files to delete:**

- `src/styles/history.css` - History-specific styles
- `src/pages/history/history.css` - History page styles
- `src/pages/history/privacy-controls.css` - Privacy controls styles

**Files to modify:**

- `src/sidepanel.css` - Remove history.css import (line 11)

### 13. Constants

**Files to modify:**

- `src/constants.ts` - Review and remove history-related constants:
- Remove `DB_CAPS` (database capacity settings)
- Remove `QUEUE_STATUS` 
- Keep only settings-related constants if needed

### 14. Package Dependencies

**Files to modify:**

- `package.json` - Consider removing dependencies only used for history:
- `minisearch` - Only used for history search
- Keep `dexie` - Still used for chat messages

### 15. Manifest Permissions

**Files to modify:**

- `package.json` manifest section - Review permissions:
- Remove `offscreen` permission (line 39)
- Remove `scripting` permission (line 41) - only for content scripts
- Remove `alarms` permission (line 42) - only for scheduling
- Keep: `storage`, `unlimitedStorage`, `tabs`, `sidePanel`
- Review `host_permissions` - may not need `<all_urls>` anymore
- Remove offscreen.html from `web_accessible_resources` (lines 58-66)
- Remove models from `web_accessible_resources` (lines 68-74)
- Update side panel description in commands

## Summary of What Remains

After this removal, the extension will have:

- **Sidepanel**: Simple AI chat interface using Chrome's Gemini Nano (no history)
- **Popup**: Basic AI prompt interface (no history button)
- **Database**: Only `chatMessages` and `settings` tables
- **Background**: Minimal service worker for settings and model status
- **Chat functionality**: Standalone chat with Chrome AI, no RAG, no search

## Files That Stay Mostly Intact

- `src/components/ChatMessage.tsx` - Used by sidepanel chat
- `src/db/index.ts` - Reduced to chat messages + settings only
- `src/sidepanel.tsx` - Simplified to single chat tab
- `src/popup.tsx` - Simplified to remove history features
- `src/background.ts` - Minimal background logic
- `src/style.css` - Basic styles
- CSS files in `src/styles/` except history.css

## Migration Notes

1. No data migration needed - users will lose history data
2. Consider showing a message on first run explaining the change
3. Update README.md and documentation
4. Bump version number to indicate major change

### To-dos

- [ ] Remove history tab from sidepanel.tsx, keep only chat functionality
- [ ] Delete src/pages/history/ directory and src/tabs/history.tsx
- [ ] Remove history tables (pages, chunks, images, miniSearchIndex, queue) from src/db/index.ts, keep only chatMessages and settings
- [ ] Delete src/search/ directory entirely
- [ ] Remove history-related message handlers from src/background/message-handler.ts
- [ ] Delete queue.ts, scheduler.ts, alarms.ts, processing-state.ts, offscreen-lifecycle.ts, offscreen.ts, database.ts from src/background/
- [ ] Remove history message types from src/background/types.ts
- [ ] Simplify src/background.ts to remove scheduler and queue logic
- [ ] Delete src/contents/extract.ts and __tests__/ directory
- [ ] Delete src/offscreen/ directory and offscreen.html
- [ ] Delete src/workers/embed-worker.ts
- [ ] Delete src/services/ directory (localModelLoader.ts, modelBootstrap.ts)
- [ ] Delete models/ and 1.0.0/ directories containing embedding model files
- [ ] Remove history search button and related functionality from src/popup.tsx
- [ ] Delete history-related CSS files and update imports
- [ ] Remove history-related constants from src/constants.ts
- [ ] Remove minisearch from package.json dependencies
- [ ] Remove unnecessary permissions (offscreen, scripting, alarms) from package.json manifest