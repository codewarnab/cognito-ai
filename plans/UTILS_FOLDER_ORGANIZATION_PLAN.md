# Utils Folder Organization Plan

## Executive Summary

The `src/utils/` folder currently contains **29 files** in a flat structure, making it difficult to navigate and understand relationships between utilities. This plan organizes these files into logical subdirectories while maintaining backward compatibility through a phased approach.

---

## Current State Analysis

### File Inventory (29 files)

| File | Purpose | Suggested Category |
|------|---------|-------------------|
| `aiNotification.ts` | Chrome notifications for AI completion events | Notifications |
| `apiErrorHandler.ts` | API error analysis and user-friendly messages | Errors |
| `ask-ai-button-visibility.ts` | Floating "Ask AI" button visibility settings | Settings |
| `cn.ts` | CSS class name merging utility | UI Helpers |
| `debounce.ts` | Debounce and throttle functions | General |
| `fileIconMapper.tsx` | Maps file extensions to icons | Files |
| `fileProcessor.ts` | File validation, base64 conversion, text extraction | Files |
| `geminiTTS.ts` | Gemini 2.5 Flash TTS audio generation | AI |
| `greetings.ts` | Time-based greeting messages | UI Helpers |
| `localFileReader.ts` | Reads local PDF files from `file://` URLs | Files |
| `localPdfDismissals.ts` | Tracks dismissed PDF suggestions | Storage |
| `mentionProcessor.ts` | Extracts tab mentions, captures snapshots | Chat |
| `mentionUtils.ts` | Parses @tab and @page mention formats | Chat |
| `modelDownloadBroadcast.ts` | Broadcasts model download progress events | AI |
| `modelSettings.ts` | AI model configuration (local/remote mode) | AI |
| `pageContextExtractor.ts` | Extracts page content via content scripts | Tabs |
| `pageGlowIndicator.ts` | Pulsing glow effect for AI processing | UI Effects |
| `pdfDetector.ts` | Detects PDF files in tabs by URL | Files |
| `providerCredentials.ts` | AI provider credential management | Credentials |
| `providerTypes.ts` | Type definitions for AI providers | Credentials |
| `settingsStorage.ts` | CRUD for user settings in Chrome storage | Settings |
| `slashCommandUtils.ts` | Slash command detection and parsing | Chat |
| `soundNotification.ts` | Plays notification sounds | Notifications |
| `suggestionCache.ts` | In-memory cache for AI suggestions | AI |
| `summarizer.ts` | Chrome built-in Summarizer API interface | AI |
| `tabProcessor.ts` | Processes tab attachments for AI | Tabs |
| `tabSnapshot.ts` | Captures tab content and screenshots | Tabs |
| `toolMetadataStore.ts` | Maps tool names to MCP server IDs | MCP |
| `tooltipManager.ts` | Tooltip state management for UX | UI Helpers |

### Dependency Graph

```
mentionProcessor.ts ──► mentionUtils.ts
                   ──► tabSnapshot.ts

tabProcessor.ts ──► tabSnapshot.ts

tabSnapshot.ts ──► mentionUtils.ts

modelSettings.ts ──► providerTypes.ts

soundNotification.ts ──► settingsStorage.ts

suggestionCache.ts ──► settingsStorage.ts
```

---

## Target Folder Structure

```
src/utils/
├── index.ts                    # Re-exports for backward compatibility
│
├── ai/
│   ├── index.ts
│   ├── geminiTTS.ts           # Text-to-speech generation
│   ├── modelDownloadBroadcast.ts  # Download progress events
│   ├── modelSettings.ts       # Model configuration
│   ├── suggestionCache.ts     # AI suggestion caching
│   └── summarizer.ts          # Chrome Summarizer API
│
├── chat/
│   ├── index.ts
│   ├── mentionProcessor.ts    # Tab mention processing
│   ├── mentionUtils.ts        # Mention parsing utilities
│   └── slashCommandUtils.ts   # Slash command handling
│
├── credentials/
│   ├── index.ts
│   ├── providerCredentials.ts # Provider credential management
│   └── providerTypes.ts       # Type definitions
│
├── errors/
│   ├── index.ts
│   └── apiErrorHandler.ts     # API error handling
│
├── files/
│   ├── index.ts
│   ├── fileIconMapper.tsx     # File type icons
│   ├── fileProcessor.ts       # File processing utilities
│   ├── localFileReader.ts     # Local file reading
│   └── pdfDetector.ts         # PDF detection
│
├── notifications/
│   ├── index.ts
│   ├── aiNotification.ts      # AI completion notifications
│   └── soundNotification.ts   # Sound playback
│
├── settings/
│   ├── index.ts
│   ├── ask-ai-button-visibility.ts  # Ask AI button settings
│   ├── localPdfDismissals.ts  # PDF dismissal tracking
│   └── settingsStorage.ts     # General settings storage
│
├── tabs/
│   ├── index.ts
│   ├── pageContextExtractor.ts  # Page content extraction
│   ├── tabProcessor.ts        # Tab attachment processing
│   └── tabSnapshot.ts         # Tab snapshot capture
│
├── ui/
│   ├── index.ts
│   ├── cn.ts                  # Class name utility
│   ├── greetings.ts           # Greeting messages
│   ├── pageGlowIndicator.ts   # Visual effects
│   └── tooltipManager.ts      # Tooltip state management
│
├── mcp/
│   ├── index.ts
│   └── toolMetadataStore.ts   # MCP tool metadata
│
└── general/
    ├── index.ts
    └── debounce.ts            # Debounce/throttle utilities
```

---

## Implementation Phases

### Phase 1: Preparation & Audit (Day 1)
**Goal**: Ensure we have full visibility and test coverage before making changes

#### Tasks
- [ ] **1.1** Run `pnpm type:check` to establish baseline
- [ ] **1.2** Search for all import paths referencing `@/utils/` or `~/utils/`
- [ ] **1.3** Document all external consumers of each utility file
- [ ] **1.4** Create backup branch: `git checkout -b utils-refactor-backup`
- [ ] **1.5** Identify any circular dependencies

#### Commands
```powershell
# Find all imports from utils
grep -r "from '@/utils" src/ --include="*.ts" --include="*.tsx"
grep -r "from '~/utils" src/ --include="*.ts" --include="*.tsx"
grep -r "from '../utils" src/ --include="*.ts" --include="*.tsx"
grep -r "from './utils" src/ --include="*.ts" --include="*.tsx"
```

#### Deliverables
- Import usage report
- Dependency map validation
- Clean type check baseline

---

### Phase 2: Create Subfolder Structure (Day 1-2)
**Goal**: Create new folders and index files without breaking existing imports

#### Tasks
- [ ] **2.1** Create all subdirectories
- [ ] **2.2** Create index.ts files for each subdirectory
- [ ] **2.3** Create root index.ts with re-exports

#### Directory Creation Script
```powershell
$dirs = @("ai", "chat", "credentials", "errors", "files", "notifications", "settings", "tabs", "ui", "mcp", "general")
foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Path "src/utils/$dir" -Force
}
```

#### Root Index Template (`src/utils/index.ts`)
```typescript
// Re-exports for backward compatibility
// Phase 2: Maintain existing flat imports while transitioning

// AI utilities
export * from './aiNotification';  // Will move to ./notifications
export * from './geminiTTS';       // Will move to ./ai
export * from './modelDownloadBroadcast';
export * from './modelSettings';
export * from './suggestionCache';
export * from './summarizer';

// Chat utilities
export * from './mentionProcessor';
export * from './mentionUtils';
export * from './slashCommandUtils';

// ... continue for all files
```

---

### Phase 3: Move Files to Subfolders (Day 2-3)
**Goal**: Relocate files while maintaining backward compatibility via re-exports

#### Migration Order (respecting dependencies)
Move files in this order to avoid breaking internal dependencies:

1. **No dependencies (can move first)**
   - `cn.ts` → `ui/`
   - `debounce.ts` → `general/`
   - `greetings.ts` → `ui/`
   - `tooltipManager.ts` → `ui/`
   - `providerTypes.ts` → `credentials/`
   - `apiErrorHandler.ts` → `errors/`

2. **Simple dependencies**
   - `mentionUtils.ts` → `chat/`
   - `slashCommandUtils.ts` → `chat/`
   - `fileIconMapper.tsx` → `files/`
   - `fileProcessor.ts` → `files/`
   - `localFileReader.ts` → `files/`
   - `pdfDetector.ts` → `files/`
   - `aiNotification.ts` → `notifications/`
   - `pageGlowIndicator.ts` → `ui/`
   - `toolMetadataStore.ts` → `mcp/`
   - `pageContextExtractor.ts` → `tabs/`
   - `localPdfDismissals.ts` → `settings/`
   - `ask-ai-button-visibility.ts` → `settings/`

3. **Has internal dependencies**
   - `providerCredentials.ts` → `credentials/` (depends on providerTypes)
   - `modelSettings.ts` → `ai/` (depends on providerTypes)
   - `settingsStorage.ts` → `settings/`
   - `geminiTTS.ts` → `ai/`
   - `modelDownloadBroadcast.ts` → `ai/`
   - `suggestionCache.ts` → `ai/` (depends on settingsStorage)
   - `summarizer.ts` → `ai/`
   - `soundNotification.ts` → `notifications/` (depends on settingsStorage)
   - `tabSnapshot.ts` → `tabs/` (depends on mentionUtils)
   - `tabProcessor.ts` → `tabs/` (depends on tabSnapshot)
   - `mentionProcessor.ts` → `chat/` (depends on mentionUtils, tabSnapshot)

#### Per-File Migration Steps
For each file:
1. Copy file to new location
2. Update internal imports in the moved file
3. Create re-export in root `index.ts`
4. Update subfolder's `index.ts`
5. Run `pnpm type:check`
6. Commit

#### Example: Moving `cn.ts`
```powershell
# 1. Move file
Move-Item src/utils/cn.ts src/utils/ui/cn.ts

# 2. Add to ui/index.ts
# export * from './cn';

# 3. Add re-export to root utils/index.ts
# export * from './ui/cn';

# 4. Verify
pnpm type:check
```

---

### Phase 4: Update Internal Cross-References (Day 3-4)
**Goal**: Update imports within moved files to reference new locations

#### Files Requiring Import Updates

| File | Current Import | New Import |
|------|----------------|------------|
| `mentionProcessor.ts` | `./mentionUtils` | `../chat/mentionUtils` or `./mentionUtils` (same folder) |
| `mentionProcessor.ts` | `./tabSnapshot` | `../tabs/tabSnapshot` |
| `tabProcessor.ts` | `./tabSnapshot` | `../tabs/tabSnapshot` or `./tabSnapshot` |
| `tabSnapshot.ts` | `./mentionUtils` | `../chat/mentionUtils` |
| `modelSettings.ts` | `./providerTypes` | `../credentials/providerTypes` |
| `soundNotification.ts` | `./settingsStorage` | `../settings/settingsStorage` |
| `suggestionCache.ts` | `./settingsStorage` | `../settings/settingsStorage` |

#### Best Practice
Use path aliases where possible:
```typescript
// Before (relative)
import { parseMention } from './mentionUtils';

// After (aliased - preferred)
import { parseMention } from '@/utils/chat/mentionUtils';

// Or using subfolder index
import { parseMention } from '@/utils/chat';
```

---

### Phase 5: Update External Consumers (Day 4-5)
**Goal**: Migrate external imports to use new paths

#### Search & Replace Strategy

##### Option A: Direct Path Updates (Recommended for large changes)
```typescript
// Before
import { cn } from '@/utils/cn';
import { debounce } from '@/utils/debounce';

// After
import { cn } from '@/utils/ui';
import { debounce } from '@/utils/general';
```

##### Option B: Use Root Re-exports (Minimal change)
```typescript
// This still works via root index.ts
import { cn, debounce } from '@/utils';
```

#### Consumer Files to Update
Based on common patterns, these files likely need updates:
- `src/components/**/*.tsx` - UI components
- `src/actions/**/*.ts` - Tool implementations
- `src/ai/**/*.ts` - AI logic
- `src/background/**/*.ts` - Background scripts
- `src/contents/**/*.ts` - Content scripts

#### Automated Search Commands
```powershell
# Find all specific imports
Select-String -Path "src/**/*.ts","src/**/*.tsx" -Pattern "from '@/utils/cn'" -Recurse
Select-String -Path "src/**/*.ts","src/**/*.tsx" -Pattern "from '@/utils/debounce'" -Recurse
# ... repeat for each utility
```

---

### Phase 6: Clean Up Re-exports (Day 5-6)
**Goal**: Remove temporary backward compatibility re-exports

#### Tasks
- [ ] **6.1** Verify all external imports use new paths
- [ ] **6.2** Remove individual re-exports from root `index.ts`
- [ ] **6.3** Keep only category-level re-exports in root
- [ ] **6.4** Final type check and manual testing

#### Final Root Index Structure
```typescript
// src/utils/index.ts
// Category re-exports only

export * from './ai';
export * from './chat';
export * from './credentials';
export * from './errors';
export * from './files';
export * from './notifications';
export * from './settings';
export * from './tabs';
export * from './ui';
export * from './mcp';
export * from './general';
```

---

### Phase 7: Documentation & Cleanup (Day 6)
**Goal**: Document new structure and ensure maintainability

#### Tasks
- [ ] **7.1** Update `docs/TECHNICAL_DOCUMENTATION.md` with new utils structure
- [ ] **7.2** Add README.md to `src/utils/` explaining organization
- [ ] **7.3** Update `.github/copilot-instructions.md` if needed
- [ ] **7.4** Delete this plan file or move to `docs/completed/`
- [ ] **7.5** Create PR with comprehensive changelog

#### Utils README Template
```markdown
# Utils Directory Structure

## Overview
Utilities are organized by domain/functionality.

## Categories

### `/ai` - AI & Model Utilities
- `geminiTTS.ts` - Text-to-speech generation
- `modelSettings.ts` - Model configuration
- ...

### `/chat` - Chat Processing
- `mentionProcessor.ts` - Tab mention handling
- ...

## Import Patterns
```typescript
// Import from category
import { cn } from '@/utils/ui';

// Import multiple from root
import { cn, debounce } from '@/utils';
```
```

---

## Risk Mitigation

### Potential Issues & Solutions

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Broken imports | Medium | High | Phase approach with re-exports |
| Circular dependencies | Low | High | Careful migration order |
| Build failures | Medium | Medium | Type check after each move |
| Runtime errors | Low | High | Manual testing per phase |

### Rollback Plan
```powershell
# If issues arise, revert to backup branch
git checkout utils-refactor-backup
git branch -D master
git checkout -b master
```

---

## Success Criteria

- [ ] All 29 files organized into 11 subdirectories
- [ ] `pnpm type:check` passes
- [ ] `pnpm build` succeeds
- [ ] Extension loads and functions correctly
- [ ] No runtime console errors
- [ ] Documentation updated

---

## Timeline Summary

| Phase | Duration | Effort |
|-------|----------|--------|
| Phase 1: Preparation | 0.5 day | Low |
| Phase 2: Create Structure | 0.5 day | Low |
| Phase 3: Move Files | 1-2 days | Medium |
| Phase 4: Update Internal | 1 day | Medium |
| Phase 5: Update External | 1-2 days | High |
| Phase 6: Clean Up | 0.5 day | Low |
| Phase 7: Documentation | 0.5 day | Low |

**Total Estimated Time: 5-7 days**

---

## Appendix: Subfolder Index Files

### `src/utils/ai/index.ts`
```typescript
export * from './geminiTTS';
export * from './modelDownloadBroadcast';
export * from './modelSettings';
export * from './suggestionCache';
export * from './summarizer';
```

### `src/utils/chat/index.ts`
```typescript
export * from './mentionProcessor';
export * from './mentionUtils';
export * from './slashCommandUtils';
```

### `src/utils/credentials/index.ts`
```typescript
export * from './providerCredentials';
export * from './providerTypes';
```

### `src/utils/errors/index.ts`
```typescript
export * from './apiErrorHandler';
```

### `src/utils/files/index.ts`
```typescript
export * from './fileIconMapper';
export * from './fileProcessor';
export * from './localFileReader';
export * from './pdfDetector';
```

### `src/utils/notifications/index.ts`
```typescript
export * from './aiNotification';
export * from './soundNotification';
```

### `src/utils/settings/index.ts`
```typescript
export * from './ask-ai-button-visibility';
export * from './localPdfDismissals';
export * from './settingsStorage';
```

### `src/utils/tabs/index.ts`
```typescript
export * from './pageContextExtractor';
export * from './tabProcessor';
export * from './tabSnapshot';
```

### `src/utils/ui/index.ts`
```typescript
export * from './cn';
export * from './greetings';
export * from './pageGlowIndicator';
export * from './tooltipManager';
```

### `src/utils/mcp/index.ts`
```typescript
export * from './toolMetadataStore';
```

### `src/utils/general/index.ts`
```typescript
export * from './debounce';
```
