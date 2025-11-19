# Logger Path Alias Migration Plan

## Executive Summary
This plan adds a TypeScript path alias `~logger` for the logger module and updates all 150+ import statements across the project to use the new alias, eliminating relative path imports.

---

## Current State Analysis

### Current Logger Location
- **File**: `src/logger.ts`
- **Exports**: 
  - `createLogger` function (main export)
  - `logger` instance (default app logger)

### Current Import Patterns
**150+ files** import from logger using relative paths:
- `'../logger'` (78 instances) - One level up
- `'../../logger'` (55 instances) - Two levels up
- `'../../../logger'` (17 instances) - Three levels up
- `'../../../../logger'` (2 instances) - Four levels up
- `'./logger'` (3 instances) - Same directory

### Import Distribution by Depth
```
./logger          →  3 files   (root level: sidepanel.tsx, background.ts)
../logger         → 78 files   (1 level deep: utils/, hooks/, etc.)
../../logger      → 55 files   (2 levels deep: ai/*, mcp/*, actions/*)
../../../logger   → 17 files   (3 levels deep: ai/geminiLive/client/*)
../../../../logger→  2 files   (4 levels deep: components deep nesting)
```

---

## Proposed Solution

### New tsconfig.json Path Alias
```json
{
  "baseUrl": ".",
  "paths": {
    "@/*": ["./src/*"],
    "@assets/*": ["./assets/*"],
    "@logger": ["./src/logger"]
  }
}
```

### Target Import Pattern
**Before:**
```typescript
import { createLogger } from '../../../logger';
import { createLogger } from "../../logger";
```

**After:**
```typescript
import { createLogger } from '@logger';
```

---

## Benefits

1. **Consistency**: Single import pattern across entire codebase
2. **Maintainability**: No need to update imports when moving files
3. **Readability**: Clear that logger is a project utility
4. **Refactor-Safe**: File moves don't break logger imports
5. **IDE Support**: Better autocomplete with path aliases

---

## Migration Phases

### Phase 1: TypeScript Configuration Update 🔧
**Goal**: Add logger path alias to tsconfig

#### Tasks:
1. Update `tsconfig.json` to add `@logger` path mapping
2. Verify TypeScript compilation with `pnpm type:check`

#### Files Modified:
- `tsconfig.json`

**Validation**: 
- TypeScript compilation succeeds
- No new type errors

---

### Phase 2: Update Import Statements 🔄
**Goal**: Replace all relative logger imports with `@logger` alias

#### Files by Category (150+ total):

##### Root Level (3 files) - `./logger` → `@logger`
1. `src/sidepanel.tsx`
2. `src/background.ts`
3. (1 more - needs verification)

##### Utils Directory (18 files) - `../logger` → `@logger`
1. `src/utils/toolMetadataStore.ts`
2. `src/utils/tabSnapshot.ts`
3. `src/utils/summarizer.ts`
4. `src/utils/suggestionCache.ts`
5. `src/utils/soundNotification.ts`
6. `src/utils/providerCredentials.ts`
7. `src/utils/pdfDetector.ts`
8. `src/utils/pageGlowIndicator.ts`
9. `src/utils/pageContextExtractor.ts`
10. `src/utils/mentionProcessor.ts`
11. `src/utils/localPdfDismissals.ts`
12. `src/utils/localFileReader.ts`
13. `src/utils/geminiApiKey.ts`
14. `src/utils/apiErrorHandler.ts`
15. `src/utils/aiNotification.ts`
16. `src/utils/fileIconMapper.tsx`
17. (2 more)

##### Hooks Directory (12 files) - `../logger` → `@logger`
1. `src/hooks/useMessageHandlers.ts`
2. `src/hooks/useVoiceRecording.ts`
3. `src/hooks/useTabContext.ts`
4. `src/hooks/useThreadManagement.ts`
5. `src/hooks/useSuggestions.ts`
6. `src/hooks/useOnboarding.ts`
7. `src/hooks/useBehavioralPreferences.ts`
8. `src/hooks/useApiKey.ts`
9. `src/hooks/useAIChatMessages.ts`
10. `src/hooks/useActiveTabDetection.ts`
11. (2 more)

##### Hooks Subdirectories (3 files) - `../../logger` → `@logger`
1. `src/hooks/sidepanel/useSidepanelUiState.ts`
2. `src/hooks/sidepanel/useNotificationSound.ts`
3. `src/hooks/sidepanel/useBackgroundMessageListener.ts`

##### Background Directory (3 files) - `../logger` → `@logger`
1. `src/background/sidepanelUtils.ts`
2. `src/background/keepAlive.ts`
3. (1 more)

##### Memory Directory (1 file) - `../logger` → `@logger`
1. `src/memory/store.ts`

##### MCP Directory (2 files) - `../logger` → `@logger`
1. `src/mcp/oauth.ts`
2. `src/mcp/authHelpers.ts`

##### MCP Client Subdirectory (8 files) - `../../logger` → `@logger`
1. `src/mcp/client/messageHandler.ts`
2. `src/mcp/client/streamProcessor.ts`
3. `src/mcp/client/transportDetector.ts`
4. `src/mcp/client/requestManager.ts`
5. `src/mcp/client/McpSSEClient.ts`
6. `src/mcp/client/connectionManager.ts`
7. `src/mcp/client/errorHandler.ts`
8. (1 more)

##### Offscreen Directory (1 file) - `../logger` → `@logger`
1. `src/offscreen/ensure.ts`

##### Audio Directory (3 files) - `../logger` → `@logger`
1. `src/audio/VoiceInput.tsx`
2. `src/audio/useSpeechRecognition.ts`
3. `src/audio/micPermission.ts`

##### Workflows Directory (2 files) - `../logger` → `@logger`
1. `src/workflows/sessionManager.ts`
2. `src/workflows/registerAll.ts`

##### Workflows Subdirectory (1 file) - `../../logger` → `@logger`
1. `src/workflows/definitions/youtubeToNotionWorkflow.ts`

##### Actions Directory (2 files) - `../logger` → `@logger`
1. `src/actions/selection.tsx`
2. `src/actions/chromeApiHelpers.ts`

##### Actions Subdirectories (31 files) - `../../logger` → `@logger`
**Tabs:**
1. `src/actions/tabs/getActiveTab.tsx`
2. `src/actions/tabs/organizeTabsByContext.tsx`
3. `src/actions/tabs/TabManager.ts`
4. `src/actions/tabs/ungroupTabs.tsx`
5. `src/actions/tabs/switchTabs.tsx`
6. `src/actions/tabs/navigateTo.tsx`
7. `src/actions/tabs/getAllTabs.tsx`
8. `src/actions/tabs/applyTabGroups.tsx`

**Reminder:**
9. `src/actions/reminder/listReminders.tsx`
10. `src/actions/reminder/createReminder.tsx`
11. `src/actions/reminder/cancelReminder.tsx`

**Reports:**
12. `src/actions/reports/getReportTemplate.tsx`
13. `src/actions/reports/generatePDF.tsx`
14. `src/actions/reports/generateMarkdown.tsx`

**Interactions:**
15. `src/actions/interactions/scroll.tsx`
16. `src/actions/interactions/typeInField.tsx`
17. `src/actions/interactions/usePressKeyTool.tsx`
18. `src/actions/interactions/search.tsx`
19. `src/actions/interactions/text-extraction.tsx`
20. `src/actions/interactions/openSearchResult.tsx`
21. `src/actions/interactions/getSearchResults.tsx`
22. `src/actions/interactions/focus.tsx`
23. `src/actions/interactions/clickByText.tsx`
24. `src/actions/interactions/click.tsx`

**Memory:**
25. `src/actions/memory/suggestSaveMemory.tsx`
26. `src/actions/memory/saveMemory.tsx`
27. `src/actions/memory/listMemories.tsx`
28. `src/actions/memory/index.tsx`
29. `src/actions/memory/getMemory.tsx`
30. `src/actions/memory/deleteMemory.tsx`

**History:**
31. `src/actions/history/searchHistory.tsx`

**YouTube to Notion:**
32. `src/actions/youtubeToNotion/useYoutubeToNotionAgent.tsx`

**Screenshot:**
33. `src/actions/screenshot.tsx`

##### AI Directory - Core (9 files) - `../../logger` → `@logger`
1. `src/ai/utils/fetchHelpers.ts`
2. `src/ai/utils/calculateUsageFromMessages.ts`
3. `src/ai/transport/SimpleFrontendTransport.ts`
4. `src/ai/tools/abortUtils.ts`
5. `src/ai/tools/registry.ts`
6. `src/ai/tools/registryUtils.ts`
7. `src/ai/tools/manager.ts`
8. `src/ai/planning/localPlanner.ts`
9. `src/ai/suggestions/local.ts`
10. `src/ai/stream/streamCallbacks.ts`
11. `src/ai/stream/streamExecutor.ts`
12. `src/ai/suggestions/generator.ts`
13. `src/ai/stream/streamHelpers.ts`
14. `src/ai/setup/retrySetup.ts`
15. `src/ai/setup/remoteMode.ts`
16. `src/ai/setup/localMode.ts`
17. `src/ai/setup/apiKeyCheck.ts`
18. `src/ai/mcp/proxy.ts`
19. `src/ai/mcp/client.ts`
20. `src/ai/models/downloader.ts`
21. `src/ai/hooks/useAIChat.ts`
22. `src/ai/fileApi/client.ts`
23. `src/ai/geminiLive/audioManager.ts`
24. `src/ai/fileApi/cache.ts`
25. `src/ai/geminiLive/toolIntegrationTest.ts`
26. `src/ai/geminiLive/toolConverter.ts`
27. `src/ai/geminiLive/errorHandler.ts`
28. `src/ai/geminiLive/GeminiLiveManager.ts`
29. `src/ai/errors/vertexErrorParser.ts`
30. `src/ai/core/modelSetup.ts`
31. `src/ai/core/modelFactory.ts`
32. `src/ai/core/genAIFactory.ts`
33. `src/ai/core/aiLogic.ts`
34. `src/ai/errors/handlers.ts`

##### AI Subdirectories - Deep (20 files) - `../../../logger` → `@logger`
**AI Tools Components:**
1. `src/ai/tools/components/ToolPartRenderer.tsx`
2. `src/ai/tools/components/ToolUIContext.tsx`

**AI Prompts:**
3. `src/ai/prompts/website/websiteDetector.ts`

**AI Gemini Live Client:**
4. `src/ai/geminiLive/client/toolHandler.ts`
5. `src/ai/geminiLive/client/sessionManager.ts`
6. `src/ai/geminiLive/client/messageHandler.ts`
7. `src/ai/geminiLive/client/GeminiLiveClient.ts`
8. `src/ai/geminiLive/client/audioHandler.ts`

**AI Agents - YouTube to Notion:**
9. `src/ai/agents/youtubeToNotion/youtubeToNotionAgentTool.ts`
10. `src/ai/agents/youtubeToNotion/youtubeToNotionAgent.ts`
11. `src/ai/agents/youtubeToNotion/videoTypeDetectorAgent.ts`
12. `src/ai/agents/youtubeToNotion/transcriptCache.ts`
13. `src/ai/agents/youtubeToNotion/transcript.ts`
14. `src/ai/agents/youtubeToNotion/simpleRetrieval.ts`
15. `src/ai/agents/youtubeToNotion/questionPlannerAgent.ts`
16. `src/ai/agents/youtubeToNotion/progressStore.ts`
17. `src/ai/agents/youtubeToNotion/answerWriterAgent.ts`

##### Components Directory (20 files) - Various depths
**Components - 3 levels deep** (`../../../logger` → `@logger`):
1. `src/components/shared/dialogs/ProviderSetupDialog.tsx`
2. `src/components/shared/dialogs/GeminiApiKeyDialog.tsx`
3. `src/components/features/threads/ThreadListSidePanel.tsx`
4. `src/components/features/threads/ThreadList.tsx`
5. `src/components/features/reminders/ReminderPanel.tsx`
6. `src/components/features/memory/MemorySidebar.tsx`
7. `src/components/features/memory/MemoryPanel.tsx`
8. `src/components/features/help/ProviderSetup.tsx`

**Components - 4 levels deep** (`../../../../logger` → `@logger`):
9. `src/components/ui/tools/icons/ToolIconMapper.tsx`
10. `src/components/ui/tools/cards/CompactToolCard.tsx`
11. `src/components/features/voice/visualizations/VoicePoweredOrb.tsx`
12. `src/components/features/voice/hooks/useGeminiLiveClient.ts`
13. `src/components/features/voice/components/VoiceModeUI.tsx`
14. `src/components/features/chat/hooks/useBlobURLRegistry.ts`
15. `src/components/features/chat/context/ContextIndicator.tsx`
16. `src/components/features/chat/components/SuggestedActions.tsx`

---

### Phase 3: Validation & Testing ✅
**Goal**: Ensure all imports work correctly

#### Tasks:
1. Run TypeScript type check: `pnpm type:check`
2. Run development build: `pnpm dev`
3. Test key features using logger
4. Verify no console errors related to imports

#### Test Scenarios:
- [ ] Side panel opens and logs appear in console
- [ ] Background service worker logs correctly
- [ ] MCP connections log events
- [ ] Tool executions show logs
- [ ] Voice mode logs audio events
- [ ] Memory operations log correctly

**Validation Checklist:**
- [ ] TypeScript compilation passes
- [ ] Development server starts
- [ ] No import resolution errors
- [ ] Logger outputs appear in console
- [ ] All log categories work correctly

---

### Phase 4: Cleanup & Commit 🧹
**Goal**: Finalize migration

#### Tasks:
1. Search for any remaining relative logger imports
2. Verify build output is identical
3. Create comprehensive git commit
4. Update documentation if needed

**Git Commit Message:**
```
refactor: Add @logger path alias and update all imports

- Added "@logger": ["./src/logger"] path alias to tsconfig.json
- Updated 150+ import statements from relative paths to @logger
- Consistent import pattern across entire codebase
- Improved maintainability and refactor safety

Files changed: ~153 files
Pattern: '../logger' | '../../logger' | etc. → '@logger'
```

---

## Execution Commands

### Phase 1: Update TypeScript Config
```powershell
# Edit tsconfig.json (will be done programmatically)
# Then verify
pnpm type:check
```

### Phase 2: Update All Imports
This will be done programmatically using batch replacement operations.

**Pattern to replace:**
- `from './logger'` → `from '@logger'`
- `from '../logger'` → `from '@logger'`
- `from '../../logger'` → `from '@logger'`
- `from '../../../logger'` → `from '@logger'`
- `from '../../../../logger'` → `from '@logger'`
- `from "../logger"` → `from '@logger'`
- `from "../../logger"` → `from '@logger'`
- `from "../../../logger"` → `from '@logger'`
- `from "../../../../logger"` → `from '@logger'`

### Phase 3: Validate
```powershell
# Type check
pnpm type:check

# Development build
pnpm dev

# Production build (after dev verification)
pnpm build
```

### Phase 4: Commit
```powershell
git add .
git commit -m "refactor: Add @logger path alias and update all imports"
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| TypeScript compilation errors | LOW | HIGH | Test after tsconfig change |
| Missed import statements | LOW | MEDIUM | Search for remaining patterns |
| Runtime import failures | LOW | HIGH | Test in dev mode first |
| Build process issues | LOW | MEDIUM | Verify build after changes |

### Rollback Plan
If issues arise:
1. Revert tsconfig.json changes
2. Revert all import changes via git
3. Run `pnpm type:check` to verify
4. Investigate specific failures

---

## Timeline Estimate

| Phase | Estimated Time | Risk Level |
|-------|---------------|------------|
| Phase 1: Config Update | 2 minutes | LOW |
| Phase 2: Import Updates | 10 minutes | LOW |
| Phase 3: Validation | 10 minutes | MEDIUM |
| Phase 4: Cleanup | 3 minutes | LOW |
| **TOTAL** | **25 minutes** | **LOW** |

---

## Post-Migration Guidelines

### For Future Development:
1. **Always use**: `import { createLogger } from '@logger'`
2. **Never use**: Relative paths to logger
3. **Pattern**: Create logger in module: `const log = createLogger('ModuleName')`
4. **Categories**: Use log categories from constants when applicable

### Example Usage:
```typescript
// ✅ Correct - New pattern
import { createLogger } from '@logger';

const log = createLogger('MyComponent');

log.info('Component initialized');
log.error('Failed to load', error);
```

```typescript
// ❌ Incorrect - Don't use relative paths
import { createLogger } from '../../../logger';
```

---

## Benefits Summary

### Developer Experience:
- ✅ Consistent imports across all files
- ✅ No need to count `../` levels
- ✅ Better IDE autocomplete
- ✅ Easier code navigation

### Maintainability:
- ✅ Safe file reorganization
- ✅ Clear dependency structure
- ✅ Reduced cognitive load
- ✅ Easier refactoring

### Code Quality:
- ✅ Professional codebase structure
- ✅ Follows modern best practices
- ✅ Better onboarding for new developers
- ✅ Consistent with assets migration

---

## Sign-off

- [ ] Plan reviewed and approved
- [ ] Assets migration completed first (recommended)
- [ ] Git repository in clean state
- [ ] Ready to execute Phase 1

---

**Document Version**: 1.0  
**Created**: November 19, 2025  
**Author**: GitHub Copilot  
**Status**: Ready for Execution  
**Complexity**: LOW (Simple find-replace operation)
