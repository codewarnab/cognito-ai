# Documentation Audit - Outdated Files List

> **Generated**: December 18, 2025
> **Purpose**: Track documentation files that need updates to match the current codebase.

---

## 🔴 Critical Updates Needed

### 1. `apps/extension/CLAUDE.md` 
**Issue**: Missing Zustand state management section, outdated logger pattern

| Problem | Details |
|---------|---------|
| ❌ Missing stores section | No mention of Zustand stores (`useSettingsStore`, `useChatStore`, etc.) which are now central to state management |
| ❌ Outdated logger usage | Line 138 shows `createLogger('MyComponent')` without the required category second argument |
| ❌ Missing store types | No guidance on importing store types with selectors |
| ❌ Incomplete architecture | Does not show `stores/` directory in the structure |

**Fix Required**: Add complete Zustand stores section matching `AGENTS.md` and `GEMINI.md`

---

### 2. `apps/extension/docs/TECHNICAL_DOCUMENTATION.md`
**Issue**: References non-existent files and outdated file paths

| Problem | Details |
|---------|---------|
| ❌ Wrong file references | References `src/sidepanel.tsx:145`, `src/sidepanel.tsx:231` - this file no longer exists (was removed per STORE_IMPLEMENTATION_PLAN.md line 527) |
| ❌ Missing `stores/` | Architecture diagram and component relationships don't mention Zustand stores |
| ❌ Outdated memory path | References `src/memory/store.ts` - this directory doesn't exist. Memory is now at `src/db/` |
| ❌ Old component paths | References to `src/background.ts` should be `src/entrypoints/background/` |
| ❌ Missing adaptive mode | No mention of "adaptive" mode which is now a key AI mode |

---

### 3. `apps/extension/AGENTS.md`
**Issue**: Minor inconsistencies and missing information

| Problem | Details |
|---------|---------|
| ⚠️ Missing logger categories | Line 138 shows logger example but doesn't list all available categories like in `GEMINI.md` |
| ⚠️ Missing `TAILWIND_MIGRATION_GUIDE.md` | Line 94 references this file but it doesn't exist |
| ⚠️ Missing `db/` directory | Architecture doesn't show the new `db/` directory for database operations |
| ⚠️ Outdated memory path | Still references `memory/` in architecture which is now `db/` |

---

### 4. `apps/extension/docs/CODING_STANDARDS.md`
**Issue**: References non-existent files and paths

| Problem | Details |
|---------|---------|
| ❌ Line 89 references `src/memory/store.ts` | This file doesn't exist - memory logic is now in `src/db/` |
| ⚠️ Missing adaptive mode | No documentation about the new "adaptive" AI mode |
| ⚠️ No db/ documentation | Missing guidance on the `src/db/` directory structure |

---

### 5. `apps/extension/FEATURES.md`
**Issue**: Outdated feature descriptions

| Problem | Details |
|---------|---------|
| ⚠️ Voice Mode description | Line 15 mentions "Google's Gemini Live API" but actual implementation uses ElevenLabs |
| ⚠️ Missing adaptive mode | No mention of adaptive mode which is a major feature |
| ⚠️ Outdated MCP list | Some MCP servers listed may be outdated or new ones missing |e 

| ⚠️ Missing web search | No documentation of web search integration (`webSearch`, `deepWebSearch` tools) |

---

## 🟡 Moderate Updates Needed

### 6. `apps/extension/src/stores/README.md`
**Issue**: Minor updates needed but mostly accurate

| Problem | Details |
|---------|---------|
| ⚠️ Migration notes | Lines 216-221 mention hooks that were deprecated - verify these hooks are actually removed |
| ⚠️ Check for new stores | Verify no new stores have been added since this was written |

---

### 7. `apps/extension/docs/STORE_IMPLEMENTATION_PLAN.md`
**Issue**: Large implementation plan that needs status verification

| Problem | Details |
|---------|---------|
| ⚠️ Checklist status | Many items marked as complete - need to verify all implementations are actually in place |
| ⚠️ Phase 1-4 completion | Verify all phases are complete as claimed |


---

### 8. `apps/extension/docs/TOOL_POPOVER_ARCHITECTURE.md`
**Issue**: Large document that may have drifted from implementation

| Problem | Details |
|---------|---------|
| ⚠️ File structure section | Line 746+ shows file structure - verify it matches actual structure |
| ⚠️ Component hierarchy | Verify all components still exist as documented |
| ⚠️ `useToolsStore` integration | May need updates to reflect Zustand store integration |

---

## 🟢 Minor/Cosmetic Updates

### 9. Root `GEMINI.md` (monorepo root)
**Status**: Generally accurate but should reference child GEMINI.md files for details

### 10. Root `AGENTS.md` (monorepo root)
**Status**: Generally accurate navigation file

### 11. `packages/backend-cloudflare/GEMINI.md`
**Status**: Appears current - backend services are simpler

### 12. `packages/backend-vercel/GEMINI.md`
**Status**: Appears current - backend services are simpler

---

## 📋 Recommended Documentation Fixes (Priority Order)

1. **HIGH**: Update `CLAUDE.md` to include Zustand stores section (copy from `GEMINI.md`)
2. **HIGH**: Update `TECHNICAL_DOCUMENTATION.md` to fix file paths:
   - Replace `src/sidepanel.tsx` references with `src/entrypoints/sidepanel/`
   - Replace `src/memory/` references with `src/db/`
   - Add Zustand stores to architecture
3. **HIGH**: Update `CODING_STANDARDS.md` to fix `src/memory/store.ts` → `src/db/`
4. **MEDIUM**: Add missing logger categories to `AGENTS.md`
5. **MEDIUM**: Update `FEATURES.md` with accurate voice mode technology (ElevenLabs)
6. **MEDIUM**: Remove or create `TAILWIND_MIGRATION_GUIDE.md` reference in `AGENTS.md`
7. **LOW**: Verify implementation plan checklist statuses

---

## 🔍 Key Codebase Changes to Document

These are actual codebase structures that documentation should reflect:

### Directory Structure Reality:
```
src/
├── db/                    # ← Database operations (was memory/)
│   ├── database.ts
│   ├── messages.ts
│   ├── threads.ts
│   ├── settings.ts
│   └── ...
├── stores/                # ← Zustand state management (NEW)
│   ├── settings/
│   ├── chat/
│   ├── ui/
│   ├── tools/
│   ├── voice/
│   ├── mcp/
│   └── attachments/
├── entrypoints/
│   ├── sidepanel/         # ← Main UI (not src/sidepanel.tsx)
│   └── background/
├── ai/                    # AI logic
├── components/            # React components
└── ...
```

### Available Zustand Stores:
- `useSettingsStore` - API keys, preferences
- `useUINavigationStore` - Panel navigation
- `useModelStore` - AI mode selection
- `useChatStore` - Messages, threads
- `useAttachmentsStore` - File attachments
- `useToolsStore` - Tool configuration
- `useVoiceModeStore` - Voice recording state
- `useMcpStore` - MCP server connections

### AI Modes:
- `local` - Gemini Nano (local)
- `remote` - Gemini API (cloud)
- `agent` - Full browser automation
- `adaptive` - Dynamic mode selection (NEW - often undocumented)

---

## 📝 Notes

- The `memory/` directory referenced in multiple docs no longer exists - it's been replaced by `db/`
- The legacy `src/sidepanel.tsx` file was removed after Phase 1 of store implementation
- Logger now requires a category as second argument: `createLogger('Name', 'CATEGORY')`
- Zustand stores are the primary state management solution now
