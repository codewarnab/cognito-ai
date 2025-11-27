# Hooks Folder Reorganization Plan

## Executive Summary
The `src/hooks/` directory currently has 17 hook files at the root level with only one subdirectory (`sidepanel/`). This plan proposes a multi-phase reorganization to group hooks by domain/functionality for better discoverability, maintainability, and scalability.

---

## Current State Analysis

### Root Level Files (17 files)
| File | Domain | Purpose |
|------|--------|---------|
| `index.ts` | Core | Barrel exports |
| `useActiveTabDetection.ts` | Tab/Browser | Detects local PDF files in active tab |
| `useAIChatMessages.ts` | Chat | AI message persistence and title generation |
| `useApiKey.ts` | Settings/Auth | Manages Gemini API key from storage |
| `useChatInputValidation.ts` | Chat | Input validation before sending |
| `useFileAttachments.ts` | Attachments | File upload, paste, drag-drop handling |
| `useLocalPdfAttachment.ts` | Attachments | Local PDF attachment handling |
| `useMessageHandlers.ts` | Chat | Message sending with attachments/context |
| `useOnboarding.ts` | Onboarding | Onboarding state and persistence |
| `useSuggestions.ts` | AI/Suggestions | Contextual AI-generated suggestions |
| `useTabContext.ts` | Tab/Browser | Chrome tab context tracking |
| `useThreadManagement.ts` | Chat/Threads | Thread lifecycle and persistence |
| `useVoiceRecording.ts` | Voice | Voice recording state and animations |
| `useWindowVisibility.ts` | UI/Lifecycle | Window visibility context consumer |
| `useWorkflowMode.ts` | Workflows | Slash command workflow selection |
| `useYouTubeVideoAttachment.ts` | Attachments/YouTube | YouTube transcript attachment |
| `useYouTubeVideoDetection.ts` | Tab/YouTube | YouTube video page detection |

### Existing Subdirectory: `sidepanel/` (6 files)
| File | Purpose |
|------|---------|
| `index.ts` | Barrel exports |
| `useBackgroundMessageListener.ts` | Omnibox/notification message handling |
| `useImagePreviewListener.ts` | Image preview state changes |
| `useNotificationSound.ts` | Notification sound initialization |
| `useOnboardingTestHandles.ts` | Test function exposure |
| `useSidepanelUiState.ts` | UI state toggles and mode management |

---

## Proposed Directory Structure

```
src/hooks/
├── index.ts                           # Main barrel export
├── README.md                          # Documentation for hooks usage
│
├── attachments/                       # File and media attachment handling
│   ├── index.ts
│   ├── useFileAttachments.ts         # (moved from root)
│   ├── useLocalPdfAttachment.ts      # (moved from root)
│   └── useYouTubeVideoAttachment.ts  # (moved from root)
│
├── browser/                           # Chrome browser/tab interactions
│   ├── index.ts
│   ├── useActiveTabDetection.ts      # (moved from root)
│   ├── useTabContext.ts              # (moved from root)
│   └── useYouTubeVideoDetection.ts   # (moved from root)
│
├── chat/                              # Chat functionality
│   ├── index.ts
│   ├── useAIChatMessages.ts          # (moved from root)
│   ├── useChatInputValidation.ts     # (moved from root)
│   ├── useMessageHandlers.ts         # (moved from root)
│   └── useThreadManagement.ts        # (moved from root)
│
├── settings/                          # Settings and configuration
│   ├── index.ts
│   ├── useApiKey.ts                  # (moved from root)
│   └── useOnboarding.ts              # (moved from root)
│
├── sidepanel/                         # Sidepanel-specific hooks (existing)
│   ├── index.ts                      # (already exists)
│   ├── useBackgroundMessageListener.ts
│   ├── useImagePreviewListener.ts
│   ├── useNotificationSound.ts
│   ├── useOnboardingTestHandles.ts
│   └── useSidepanelUiState.ts
│
├── suggestions/                       # AI suggestions
│   ├── index.ts
│   └── useSuggestions.ts             # (moved from root)
│
├── ui/                                # Generic UI state hooks
│   ├── index.ts
│   ├── useWindowVisibility.ts        # (moved from root)
│   └── useVoiceRecording.ts          # (moved from root)
│
└── workflows/                         # Workflow-related hooks
    ├── index.ts
    └── useWorkflowMode.ts            # (moved from root)
```

---

## Phase Implementation Plan

### Phase 1: Preparation (Low Risk)
**Goal**: Set up infrastructure without breaking existing code

**Tasks**:
1. Create new subdirectories:
   - `attachments/`
   - `browser/`
   - `chat/`
   - `settings/`
   - `suggestions/`
   - `ui/`
   - `workflows/`

2. Create `index.ts` barrel files in each new directory (empty initially)

3. Add `README.md` with hook usage documentation

**Estimated Impact**: None - no existing code is modified

---

### Phase 2: Browser Hooks Migration
**Goal**: Move tab/browser-related hooks

**Hooks to Move**:
- `useActiveTabDetection.ts` → `browser/`
- `useTabContext.ts` → `browser/`
- `useYouTubeVideoDetection.ts` → `browser/`

**Steps**:
1. Move files to `browser/` directory
2. Update `browser/index.ts` with exports
3. Update root `index.ts` to re-export from `browser/`
4. Search and update all imports across codebase

**Import Changes**:
```typescript
// Before
import { useActiveTabDetection } from '@/hooks/useActiveTabDetection';

// After (via barrel)
import { useActiveTabDetection } from '@/hooks';
// Or direct
import { useActiveTabDetection } from '@/hooks/browser';
```

---

### Phase 3: Attachments Hooks Migration
**Goal**: Move file/media attachment hooks

**Hooks to Move**:
- `useFileAttachments.ts` → `attachments/`
- `useLocalPdfAttachment.ts` → `attachments/`
- `useYouTubeVideoAttachment.ts` → `attachments/`

**Steps**:
1. Move files to `attachments/` directory
2. Update `attachments/index.ts` with exports
3. Update root `index.ts` to re-export from `attachments/`
4. Update internal imports (e.g., `useLocalPdfAttachment` imports from `useActiveTabDetection`)

**Dependency Note**: 
- `useLocalPdfAttachment.ts` imports `LocalPdfInfo` type from `useActiveTabDetection`
- After Phase 2, update import path to `../browser/useActiveTabDetection`

---

### Phase 4: Chat Hooks Migration
**Goal**: Move chat/messaging hooks

**Hooks to Move**:
- `useAIChatMessages.ts` → `chat/`
- `useChatInputValidation.ts` → `chat/`
- `useMessageHandlers.ts` → `chat/`
- `useThreadManagement.ts` → `chat/`

**Steps**:
1. Move files to `chat/` directory
2. Update `chat/index.ts` with exports
3. Update root `index.ts` to re-export from `chat/`
4. Search and update all imports across codebase

---

### Phase 5: Settings Hooks Migration
**Goal**: Move settings/configuration hooks

**Hooks to Move**:
- `useApiKey.ts` → `settings/`
- `useOnboarding.ts` → `settings/`

**Steps**:
1. Move files to `settings/` directory
2. Update `settings/index.ts` with exports
3. Update root `index.ts` to re-export from `settings/`
4. Search and update all imports across codebase

---

### Phase 6: Remaining Hooks Migration
**Goal**: Move suggestions, UI, and workflow hooks

**Hooks to Move**:
- `useSuggestions.ts` → `suggestions/`
- `useWindowVisibility.ts` → `ui/`
- `useVoiceRecording.ts` → `ui/`
- `useWorkflowMode.ts` → `workflows/`

**Steps**:
1. Move files to respective directories
2. Update each subdirectory's `index.ts` with exports
3. Update root `index.ts` to re-export from all subdirectories
4. Search and update all imports across codebase

---

### Phase 7: Final Cleanup & Documentation
**Goal**: Complete migration and ensure code quality

**Tasks**:
1. Remove any stale files from root hooks directory
2. Update root `index.ts` to be a clean barrel export from all subdirectories
3. Update `README.md` with complete hook documentation
4. Run full type check: `pnpm type:check`
5. Test extension functionality manually
6. Update any documentation referencing old paths

---

## Updated Root index.ts Structure

```typescript
/**
 * Hooks Barrel Export
 * 
 * All hooks organized by domain. Import from this file for cleaner imports.
 * 
 * @example
 * import { useApiKey, useOnboarding, useTabContext } from '@/hooks';
 */

// Browser/Tab hooks
export * from './browser';

// Attachment hooks
export * from './attachments';

// Chat hooks
export * from './chat';

// Settings hooks
export * from './settings';

// Sidepanel hooks
export * from './sidepanel';

// Suggestions hooks
export * from './suggestions';

// UI hooks
export * from './ui';

// Workflows hooks
export * from './workflows';
```

---

## Risk Assessment

| Phase | Risk Level | Mitigation |
|-------|------------|------------|
| Phase 1 | 🟢 Low | No code changes, only new directories |
| Phase 2 | 🟡 Medium | Limited imports, well-tested functionality |
| Phase 3 | 🟡 Medium | Cross-folder imports need careful updating |
| Phase 4 | 🟡 Medium | Core chat functionality, thorough testing needed |
| Phase 5 | 🟢 Low | Few imports, isolated functionality |
| Phase 6 | 🟢 Low | Few imports, isolated functionality |
| Phase 7 | 🟢 Low | Documentation and cleanup only |

---

## Rollback Strategy

Each phase can be rolled back independently:
1. Move files back to original locations
2. Restore original `index.ts`
3. Revert import changes

**Git Strategy**: Create a feature branch per phase for easy rollback:
```bash
git checkout -b refactor/hooks-phase-1
git checkout -b refactor/hooks-phase-2
# etc.
```

---

## Testing Checklist

After each phase:
- [ ] `pnpm type:check` passes
- [ ] Extension loads without errors
- [ ] Chat functionality works
- [ ] File attachments work
- [ ] Voice recording works
- [ ] Settings panel works
- [ ] Onboarding flow works
- [ ] YouTube video detection works
- [ ] Tab context detection works

---

## Benefits of Reorganization

1. **Discoverability**: Developers can quickly find hooks by domain
2. **Scalability**: New hooks have clear placement guidance
3. **Maintainability**: Related hooks are grouped together
4. **Code Review**: Changes are isolated to relevant domains
5. **Onboarding**: New developers understand codebase faster
6. **Consistency**: Aligns with existing patterns (actions, components)

---

## Timeline Estimate

| Phase | Estimated Time |
|-------|---------------|
| Phase 1 | 15 minutes |
| Phase 2 | 30 minutes |
| Phase 3 | 30 minutes |
| Phase 4 | 45 minutes |
| Phase 5 | 20 minutes |
| Phase 6 | 30 minutes |
| Phase 7 | 30 minutes |
| **Total** | **~3.5 hours** |

---

## Notes

- All phases maintain backward compatibility via barrel exports
- Type exports (e.g., `LocalPdfInfo`, `ActiveTabDetection`) must be preserved
- Cross-folder dependencies should use relative imports within hooks
- External imports should use the barrel export from `@/hooks`
