# Components Folder Reorganization Plan

## Current State Analysis

### Existing Structure
```
src/components/
├── core/                    # Contains CopilotChatWindow.tsx + index
├── data/                    # Static data files (featuresData, troubleshootingData)
├── features/                # Feature-specific components
│   ├── chat/
│   │   ├── components/      # 25 flat files - NEEDS ORGANIZATION
│   │   ├── context/
│   │   ├── dropdowns/
│   │   ├── hooks/
│   │   └── utils.ts, types.ts
│   ├── help/
│   ├── mcp/                 # MCP server UI components
│   ├── memory/
│   ├── onboarding/
│   ├── reminders/
│   ├── settings/
│   ├── threads/
│   └── voice/               # Well-organized with hooks, utils, visualizations
├── shared/                  # Reusable components
│   ├── dialogs/
│   ├── effects/
│   ├── icons/               # 14 icon components
│   ├── inputs/
│   ├── layouts/
│   └── notifications/
├── types/
└── ui/                      # Shadcn/primitive components
    ├── feedback/
    ├── primitives/          # accordion, badge, collapsible, etc.
    ├── tools/               # Tool rendering components
    └── trash-zone.tsx
```

### Key Issues Identified

1. **`features/chat/components/`** - 25 files dumped flat, no logical grouping
2. **Icon components scattered** - Some in `shared/icons/`, some inline
3. **Inconsistent naming** - Mix of PascalCase files with different suffixes
4. **`core/`** - Only has one component, purpose unclear
5. **`ui/trash-zone.tsx`** - File at root of ui/ instead of in subfolder
6. **`data/`** - Contains static data, not components - wrong location

---

## Multi-Phase Organization Plan

### Phase 1: Organize `features/chat/components/` (High Impact)

**Goal**: Group the 25 flat files into logical subfolders

#### Proposed Structure:
```
features/chat/components/
├── attachments/             # File/tab attachment handling
│   ├── AttachmentDropdown.tsx
│   ├── FileAttachment.tsx
│   ├── TabAttachment.tsx
│   ├── ToolFileAttachment.tsx
│   └── index.ts
├── buttons/                 # Action buttons
│   ├── ContinueButton.tsx
│   ├── CopyButton.tsx
│   ├── DownloadButton.tsx
│   ├── VoiceButton.tsx
│   └── index.ts
├── composer/                # Message input area
│   ├── Composer.tsx
│   ├── ChatInput.tsx
│   └── index.ts
├── display/                 # Message display components
│   ├── ChatHeader.tsx
│   ├── ChatMessages.tsx
│   ├── InlineCode.tsx
│   └── index.ts
├── feedback/                # Status/progress indicators
│   ├── AnimatedCircularProgressBar.tsx
│   ├── ErrorNotification.tsx
│   ├── LoadingIndicator.tsx
│   ├── ResearchProgress.tsx
│   └── index.ts
├── modals/                  # Modal dialogs
│   ├── AddTabsModal.tsx
│   ├── ToolsModal.tsx
│   └── index.ts
├── states/                  # Empty/loading states
│   ├── EmptyState.tsx
│   ├── LocalBanner.tsx
│   └── index.ts
├── suggestions/             # AI suggestions UI
│   ├── LocalPdfSuggestion.tsx
│   ├── SuggestedActions.tsx
│   ├── YouTubeVideoSuggestion.tsx
│   └── index.ts
├── badges/                  # Badge components
│   ├── WorkflowBadge.tsx
│   └── index.ts
└── index.ts                 # Re-exports all subfolders
```

#### Tasks:
- [ ] Create subfolder structure
- [ ] Move files to appropriate subfolders
- [ ] Create index.ts barrel files for each subfolder
- [ ] Update parent index.ts to re-export
- [ ] Update all import paths in consuming files
- [ ] Run type check to verify no broken imports

---

### Phase 2: Consolidate Icons

**Goal**: Centralize all icon components

#### Current State:
- `shared/icons/` - 14 icon files
- Various inline icon definitions scattered in components

#### Proposed Changes:
1. Audit all components for inline SVG icons
2. Extract reusable icons to `shared/icons/`
3. Group icons by category if needed:
```
shared/icons/
├── actions/           # SendIcon, CopyIcon, StopIcon, UploadIcon
├── status/            # AudioLinesIcon, LaptopMinimalCheckIcon
├── navigation/        # FoldersIcon, PaperclipIcon
├── misc/              # UserIcon, RobotIcon, XIcon, CloudCogIcon
└── index.ts
```

#### Tasks:
- [ ] Search codebase for inline SVG components
- [ ] Extract and dedupe icon components
- [ ] Update icon index.ts with categories
- [ ] Replace inline icons with imports
- [ ] Verify visual consistency

---

### Phase 3: Relocate `data/` Directory

**Goal**: Move static data to appropriate location

#### Rationale:
`featuresData.ts` and `troubleshootingData.ts` are **data files**, not components.

#### Proposed Changes:
```
# Option A: Move to src/constants/
src/constants/
├── featuresData.ts
├── troubleshootingData.ts
└── ...existing files

# Option B: Move to src/data/ (new top-level folder)
src/data/
├── features.ts
├── troubleshooting.ts
└── index.ts
```

#### Recommendation: **Option A** - keeps constants together

#### Tasks:
- [ ] Move files to `src/constants/`
- [ ] Update all imports (likely in help/onboarding features)
- [ ] Remove empty `components/data/` folder
- [ ] Run type check

---

### Phase 4: Clean Up `core/` Directory

**Goal**: Clarify or eliminate the core folder

#### Current State:
- Only contains `CopilotChatWindow.tsx` and `index.ts`

#### Options:
1. **Merge into `features/`** if it's feature-specific
2. **Rename to `windows/`** if there will be more window components
3. **Keep as `core/`** but document its purpose (app shell components)

#### Recommendation: Rename to `shell/` or `windows/` for clarity

#### Tasks:
- [ ] Analyze what `CopilotChatWindow.tsx` does
- [ ] Decide on naming (shell/windows/core)
- [ ] Update imports if renamed
- [ ] Add README.md explaining folder purpose

---

### Phase 5: Organize `ui/` Folder

**Goal**: Clean up root-level files and improve structure

#### Current Issues:
- `trash-zone.tsx` at root level (should be in a subfolder)
- `feedback/` folder exists but some feedback components elsewhere

#### Proposed Changes:
```
ui/
├── feedback/
│   ├── StatusBadge.tsx
│   ├── TextMorph.tsx
│   └── index.ts
├── primitives/           # Keep as-is (shadcn components)
│   ├── accordion/
│   ├── badge/
│   ├── collapsible/
│   ├── command/
│   ├── dialog/
│   ├── popover/
│   ├── toggle/
│   └── index.ts
├── tools/                # Keep as-is (tool rendering)
│   ├── cards/
│   ├── ChainOfThought/
│   ├── formatters/
│   ├── icons/
│   └── index.ts
├── dnd/                  # Drag and drop (NEW)
│   ├── trash-zone.tsx    # Move here
│   └── index.ts
└── index.ts
```

#### Tasks:
- [ ] Create `ui/dnd/` folder
- [ ] Move `trash-zone.tsx` to `ui/dnd/`
- [ ] Create index files
- [ ] Update imports

---

### Phase 6: Add Documentation & Index Files

**Goal**: Improve discoverability and maintainability

#### Tasks:
- [ ] Add `README.md` to each major folder explaining its purpose
- [ ] Ensure all folders have proper `index.ts` barrel exports
- [ ] Add JSDoc comments to main component files
- [ ] Create `COMPONENT_GUIDELINES.md` with conventions

#### Example README for `features/chat/components/`:
```markdown
# Chat Components

This folder contains all UI components specific to the chat feature.

## Subfolders

- `attachments/` - File and tab attachment UI
- `buttons/` - Action buttons (copy, continue, voice)
- `composer/` - Message input area
- `display/` - Message rendering
- `feedback/` - Progress and status indicators
- `modals/` - Modal dialogs
- `states/` - Empty/loading states
- `suggestions/` - AI-powered suggestions
- `badges/` - Status badges

## Conventions

- Components are named in PascalCase
- Each subfolder has an index.ts for exports
- Internal components (not exported) prefixed with underscore
```

---

### Phase 7: Validation & Cleanup

**Goal**: Ensure nothing is broken

#### Tasks:
- [ ] Run `pnpm type:check` after each phase
- [ ] Test extension in browser after each phase
- [ ] Search for orphaned imports
- [ ] Remove empty directories
- [ ] Update `.gitignore` if needed
- [ ] Commit each phase separately for easy rollback

---

## Implementation Order

| Phase | Priority | Effort | Impact | Dependencies |
|-------|----------|--------|--------|--------------|
| 1     | HIGH     | Medium | HIGH   | None         |
| 2     | MEDIUM   | Low    | Medium | None         |
| 3     | LOW      | Low    | Low    | None         |
| 4     | LOW      | Low    | Low    | None         |
| 5     | MEDIUM   | Low    | Medium | None         |
| 6     | MEDIUM   | Medium | HIGH   | Phases 1-5   |
| 7     | HIGH     | Low    | HIGH   | All phases   |

**Recommended execution**: 1 → 5 → 2 → 3 → 4 → 6 → 7

---

## Import Update Strategy

When moving files, use this approach to update imports:

1. **Find all usages**: `grep -r "from.*[filename]" src/`
2. **Update imports in batch** using multi_replace_string_in_file
3. **Use path aliases**: Always use `@/components/...` not relative paths
4. **Run type check** after each batch

### Example Import Changes:
```typescript
// Before
import { ChatInput } from '@/components/features/chat/components/ChatInput';

// After
import { ChatInput } from '@/components/features/chat/components/composer';
// or
import { ChatInput } from '@/components/features/chat/components';
```

---

## Risk Mitigation

1. **Git branches**: Create a feature branch for reorganization
2. **Small commits**: Commit after each subfolder reorganization
3. **Type safety**: TypeScript will catch broken imports
4. **Testing**: Manual test after each phase
5. **Rollback plan**: Each phase is independent, can revert individually

---

## Success Criteria

- [ ] All 25 chat components organized into logical subfolders
- [ ] No component files at folder roots (except index.ts)
- [ ] All folders have barrel exports (index.ts)
- [ ] No broken imports (`pnpm type:check` passes)
- [ ] Extension loads and functions correctly
- [ ] Documentation added to major folders

---

## Future Considerations

1. **Component library extraction**: Some shared components could become a separate package
2. **Storybook**: Add Storybook for component documentation
3. **Testing**: Add component tests alongside reorganization
4. **Code splitting**: Verify lazy loading still works after moves
