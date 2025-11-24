<!-- 332313c6-d3f8-4ad3-90d3-fd83bc68b5e0 1cc01499-678b-45e1-961d-de622b9f84fa -->
# AI Directory Alias Migration Plan

## Overview

This plan outlines the migration of all AI-related imports to use the `@ai` path alias. The project currently uses relative paths like `../ai`, `../../ai`, `./ai`, and `../../../ai` which will be replaced with `@ai` for better maintainability and consistency.

## Current State Analysis

- AI code is located in `src/ai/` directory
- Found 100+ files importing from ai directory
- Current import patterns:
- `from './ai/...'` (from root `src/` directory)
- `from '../ai/...'` (from one level deep)
- `from '../../ai/...'` (from two levels deep)
- `from '../../../ai/...'` (from three levels deep)
- `from '../../../../ai/...'` (from four levels deep)
- Internal ai imports within `src/ai/` use relative paths like `../core/...` (optional to migrate)

## Phase 1: Configure Path Alias

### 1.1 Update tsconfig.json

- Add `@ai` alias to `compilerOptions.paths` in `tsconfig.json`
- Path mapping: `"@ai/*": ["./src/ai/*"]` and `"@ai": ["./src/ai"]`
- This allows both `@ai` (for index) and `@ai/tools/...` (for specific paths)

### Files to modify:

- `tsconfig.json` (lines 18-42)

## Phase 2: Update AI Directory Imports

### 2.1 Update Root-Level Imports (from `src/`)

Files importing from `src/ai` using `./ai/...`:

- `src/sidepanel.tsx` (lines 9, 47)

**Change pattern:**

- `from './ai/...'` → `from '@ai/...'`

### 2.2 Update One-Level Deep Imports (`../ai`)

Files importing from `src/ai` using `../ai/...`:

- `src/hooks/useSuggestions.ts` (line 11)
- `src/hooks/useYouTubeVideoAttachment.ts` (line 3)
- `src/utils/modelSettings.ts` (line 6)
- `src/background/alarms.ts` (line 12)
- `src/actions/selection.tsx` (lines 3-6)
- `src/actions/screenshot.tsx` (lines 3-6)
- `src/utils/suggestionCache.ts`
- `src/hooks/useThreadManagement.ts`
- `src/types/database/schema.ts`
- `src/types/components/chat.ts`

**Change pattern:**

- `from '../ai/...'` → `from '@ai/...'`

### 2.3 Update Two-Level Deep Imports (`../../ai`)

Files importing from `src/ai` using `../../ai/...`:

**Actions directory:**

- `src/actions/tabs/getAllTabs.tsx` (lines 9-10, 12-13)
- `src/actions/tabs/navigateTo.tsx` (lines 11-12, 15-16)
- `src/actions/tabs/switchTabs.tsx` (lines 9-10, 13-14)
- `src/actions/tabs/organizeTabsByContext.tsx` (lines 11-12, 14-15)
- `src/actions/tabs/ungroupTabs.tsx` (lines 12-13, 15-16)
- `src/actions/tabs/applyTabGroups.tsx` (lines 11-12, 14-15)
- `src/actions/tabs/getActiveTab.tsx` (lines 10-11, 13-14)
- `src/actions/interactions/click.tsx` (lines 4-5)
- `src/actions/interactions/openSearchResult.tsx` (lines 9-12)
- `src/actions/interactions/clickByText.tsx` (lines 11-13)
- `src/actions/interactions/focus.tsx` (lines 4-7)
- `src/actions/interactions/scroll.tsx` (lines 4-7)
- `src/actions/interactions/search.tsx` (lines 8-9, 11-12)
- `src/actions/interactions/getSearchResults.tsx` (lines 8-11)
- `src/actions/interactions/text-extraction.tsx`
- `src/actions/interactions/typeInField.tsx` (line 8)
- `src/actions/interactions/usePressKeyTool.tsx`
- `src/actions/bookmarks/getBookmarkTree.tsx` (lines 8-9, 11-12)
- `src/actions/bookmarks/searchBookmarks.tsx` (lines 8-9, 11-12)
- `src/actions/bookmarks/listBookmarks.tsx` (lines 8-9, 11-12)
- `src/actions/bookmarks/bookmarksTool.tsx` (lines 3-4, 6-7)
- `src/actions/bookmarks/updateBookmark.tsx` (lines 8-9, 11-12)
- `src/actions/bookmarks/organizeBookmarks.tsx` (lines 8-9, 11-12)
- `src/actions/bookmarks/deleteBookmark.tsx` (lines 8-9, 11-12)
- `src/actions/bookmarks/createBookmark.tsx` (lines 8-9, 11-12)
- `src/actions/dom/executeScript.tsx` (lines 4-5)
- `src/actions/dom/analyzeDom.tsx` (lines 10-13)
- `src/actions/history/searchHistory.tsx` (lines 3-4, 7)
- `src/actions/history/getUrlVisits.tsx` (lines 3-4, 7)
- `src/actions/memory/saveMemory.tsx` (lines 8-9, 11, 14)
- `src/actions/memory/suggestSaveMemory.tsx`
- `src/actions/memory/deleteMemory.tsx`
- `src/actions/memory/listMemories.tsx`
- `src/actions/memory/getMemory.tsx`
- `src/actions/reminder/cancelReminder.tsx`
- `src/actions/reminder/listReminders.tsx`
- `src/actions/reminder/createReminder.tsx`
- `src/actions/youtubeToNotion/useYoutubeToNotionAgent.tsx` (lines 11-12, 15-17)

**Other directories:**

- `src/components/core/CopilotChatWindow.tsx` (line 11)
- `src/components/features/mcp/McpManager.tsx` (line 9)

**Change pattern:**

- `from '../../ai/...'` → `from '@ai/...'`

### 2.4 Update Three-Level Deep Imports (`../../../ai`)

Files importing from `src/ai` using `../../../ai/...`:

- Check for any files in deeper nested subdirectories

**Change pattern:**

- `from '../../../ai/...'` → `from '@ai/...'`

### 2.5 Update Four-Level Deep Imports (`../../../../ai`)

Files importing from `src/ai` using `../../../../ai/...`:

- `src/components/ui/tools/cards/CompactToolCard.tsx` (line 15)
- `src/components/features/chat/context/ContextIndicator.tsx` (line 3)
- `src/components/features/settings/components/EnabledToolsSettings.tsx` (line 4)
- `src/components/features/voice/hooks/useGeminiLiveClient.ts` (lines 6-7, 11, 14)
- `src/components/features/chat/components/ChatMessages.tsx` (line 8)
- `src/components/features/chat/components/ChatInput.tsx` (line 8)
- `src/components/features/voice/components/VoiceModeUI.tsx` (line 17)
- `src/components/features/voice/components/VoiceModeStatus.tsx` (line 6)

**Change pattern:**

- `from '../../../../ai/...'` → `from '@ai/...'`

### 2.6 Optional: Update Internal AI Imports

Files within `src/ai/` that use relative paths for internal imports:

- `src/ai/transport/SimpleFrontendTransport.ts` (line 8) - uses `../core/aiLogic`

**Note:** Internal ai imports can remain relative for now, or be migrated to `@ai/...` for consistency. This is optional and can be done in a separate phase.

## Phase 3: Verification and Testing

### 3.1 Type Checking

- Run `npm run type:check` to ensure all imports resolve correctly
- Fix any TypeScript errors related to path resolution

### 3.2 Build Verification

- Run `npm run build` to ensure the build system recognizes the new aliases
- Verify Plasmo/Vite resolves the aliases correctly

### 3.3 Import Consistency Check

- Search for any remaining relative imports to ai directory
- Ensure all imports use the `@ai` alias pattern
- Verify no external package imports (`from 'ai'`) were incorrectly changed
- Verify no imports from `src/types/ai` were incorrectly changed (these should remain as `../types/ai` or use `@types/ai` if that alias exists)

## Files Summary

### Configuration Files (1):

- `tsconfig.json`

### Files Requiring Import Updates (100+):

**Root level (1):**

1. `src/sidepanel.tsx`

**One level deep (10+):**

2. `src/hooks/useSuggestions.ts`
3. `src/hooks/useYouTubeVideoAttachment.ts`
4. `src/utils/modelSettings.ts`
5. `src/background/alarms.ts`
6. `src/actions/selection.tsx`
7. `src/actions/screenshot.tsx`
8. `src/utils/suggestionCache.ts`
9. `src/hooks/useThreadManagement.ts`
10. `src/types/database/schema.ts`
11. `src/types/components/chat.ts`

**Two levels deep (50+):**
12-61. All files in `src/actions/*/` directories (see Phase 2.3 for complete list)

62. `src/components/core/CopilotChatWindow.tsx`
63. `src/components/features/mcp/McpManager.tsx`

**Four levels deep (8):**

64. `src/components/ui/tools/cards/CompactToolCard.tsx`
65. `src/components/features/chat/context/ContextIndicator.tsx`
66. `src/components/features/settings/components/EnabledToolsSettings.tsx`
67. `src/components/features/voice/hooks/useGeminiLiveClient.ts`
68. `src/components/features/chat/components/ChatMessages.tsx`
69. `src/components/features/chat/components/ChatInput.tsx`
70. `src/components/features/voice/components/VoiceModeUI.tsx`
71. `src/components/features/voice/components/VoiceModeStatus.tsx`

## Notes

- Plasmo framework uses Vite under the hood, which should respect tsconfig.json paths
- If build issues occur, may need to check Plasmo-specific configuration
- Maintain import order consistency (Prettier sort-imports plugin will handle this)
- **CRITICAL**: Do NOT migrate external package imports like `from 'ai'` (the AI SDK package from Vercel)
- **CRITICAL**: Do NOT migrate imports from `src/types/ai` - this refers to `src/types/ai`, not `src/ai`
- **CRITICAL**: Do NOT migrate `export * from './ai'` in `src/types/index.ts` - this refers to `src/types/ai`, not `src/ai`
- Internal ai imports (within `src/ai/`) can optionally be migrated for consistency but are lower priority
- Most common import patterns:
- `from '../../ai/tools'` → `from '@ai/tools'`
- `from '../../ai/tools/components'` → `from '@ai/tools/components'`
- `from '../../../../ai/geminiLive'` → `from '@ai/geminiLive'`
- `from '../../../../ai/types/usage'` → `from '@ai/types/usage'`

### To-dos

- [ ] Add @ai alias to tsconfig.json paths configuration
- [ ] Update root-level imports (./ai) in src/sidepanel.tsx
- [ ] Update one-level deep imports (../ai) in hooks, utils, background, actions, and types files
- [ ] Update two-level deep imports (../../ai) in all action files and component files
- [ ] Update four-level deep imports (../../../../ai) in deeply nested component files
- [ ] Run type checking to verify all imports resolve correctly
- [ ] Run build to ensure Plasmo/Vite recognizes the new aliases
- [ ] Search for any remaining relative ai imports and verify no incorrect migrations (external packages, types/ai)