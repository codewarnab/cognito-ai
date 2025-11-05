# AI Folder Reorganization Plan

## Overview
The `src/ai` folder currently has 20+ files at the root level with multiple subdirectories, making it difficult to navigate and maintain. This plan outlines a multi-phase approach to organize the folder into a cleaner, more maintainable structure.

## Current Structure Analysis

### Root Level Files (Too Many!)
- `aiLogic.ts` - Main AI logic orchestration
- `errorHandlers.ts` - Error handling utilities
- `localPlanner.ts` - Local planning logic
- `localSuggestionGenerator.ts` - Local suggestion generation
- `mcpClient.ts` - MCP client management
- `mcpProxy.ts` - MCP proxy for background communication
- `modelDownloader.ts` - Model download utilities
- `modelSetup.ts` - Model setup and initialization
- `prompt.ts` - Prompt utilities
- `SimpleFrontendTransport.ts` - Transport layer
- `streamHelpers.ts` - Stream utilities
- `suggestionGenerator.ts` - Suggestion generation
- `toolManager.ts` - Tool management
- `toolRegistry.ts` - Tool registry
- `toolRegistryUtils.ts` - Tool registry utilities
- `types.ts` - Type definitions
- `useAIChat.ts` - React hook for AI chat
- `CompactToolRenderer.tsx` - Tool rendering component
- `ToolPartRenderer.tsx` - Tool part rendering component
- `ToolUIContext.tsx` - Tool UI context provider

### Existing Folders
- `agents/` - Agent implementations (browser, youtube)
- `geminiLive/` - Gemini Live integration
- `prompt/` - Prompt templates (local, remote)
- `stream/` - Stream execution logic
- `types/` - Type definitions (only usage.ts)

---

## Proposed New Structure

```
src/ai/
├── core/                          # Core AI logic and orchestration
│   ├── aiLogic.ts                 # Main AI logic (keep name for compatibility)
│   ├── modelSetup.ts              # Model initialization
│   └── index.ts                   # Barrel export
│
├── models/                        # Model management
│   ├── downloader.ts              # Model download utilities
│   └── index.ts                   # Barrel export
│
├── mcp/                           # Model Context Protocol
│   ├── client.ts                  # MCP client management
│   ├── proxy.ts                   # Background communication proxy
│   └── index.ts                   # Barrel export
│
├── tools/                         # Tool system
│   ├── manager.ts                 # Tool management and filtering
│   ├── registry.ts                # Tool registry
│   ├── registryUtils.ts           # Registry utilities
│   ├── components/                # Tool UI components
│   │   ├── CompactToolRenderer.tsx
│   │   ├── ToolPartRenderer.tsx
│   │   ├── ToolUIContext.tsx
│   │   └── index.ts
│   └── index.ts                   # Barrel export
│
├── suggestions/                   # Suggestion generation
│   ├── local.ts                   # Local suggestion generator
│   ├── remote.ts                  # Remote suggestion generator
│   ├── suggestionGenerator.ts    # Main generator (if different from local)
│   └── index.ts                   # Barrel export
│
├── planning/                      # Planning and orchestration
│   ├── localPlanner.ts            # Local planning logic
│   └── index.ts                   # Barrel export
│
├── stream/                        # Stream processing (existing)
│   ├── index.ts
│   ├── streamCallbacks.ts
│   ├── streamExecutor.ts
│   ├── streamHelpers.ts           # Move from root
│   └── index.ts                   # Update barrel export
│
├── transport/                     # Transport layer
│   ├── SimpleFrontendTransport.ts
│   └── index.ts                   # Barrel export
│
├── agents/                        # Agent implementations (existing)
│   ├── browser/
│   │   ├── browserActionAgent.ts
│   │   └── prompts.ts
│   ├── youtube/
│   │   ├── youtubeAgent.ts
│   │   ├── youtubeAgentTool.ts
│   │   └── index.ts
│   └── index.ts                   # Barrel export
│
├── geminiLive/                    # Gemini Live (existing, well-organized)
│   ├── [keep existing structure]
│
├── prompts/                       # Prompt management (rename from prompt/)
│   ├── templates/
│   │   ├── local.ts
│   │   ├── remote.ts
│   │   └── index.ts
│   ├── utils.ts                   # Move prompt.ts here
│   └── index.ts                   # Barrel export
│
├── errors/                        # Error handling
│   ├── handlers.ts                # Error handlers
│   └── index.ts                   # Barrel export
│
├── hooks/                         # React hooks
│   ├── useAIChat.ts
│   └── index.ts                   # Barrel export
│
├── types/                         # Type definitions (existing)
│   ├── usage.ts
│   ├── types.ts                   # Move from root
│   └── index.ts                   # Update barrel export
│
└── index.ts                       # Main barrel export
```

---

## Multi-Phase Implementation Plan

### Phase 1: Planning & Preparation (Day 1) ✓
**Goal**: Document current state and dependencies

- [x] Create this reorganization plan
- [ ] Audit all import statements to understand dependencies
- [ ] Create a dependency graph showing file relationships
- [ ] Identify circular dependencies that need resolution
- [ ] Back up current state (git commit)

**Deliverables**:
- This plan document
- Dependency analysis document
- Clean git commit as baseline

---

### Phase 2: Create New Folder Structure (Day 1-2) ✓
**Goal**: Create folders and barrel exports without moving files

**Tasks**:
1. Create all new directories
   ```powershell
   # Core directories
   New-Item -ItemType Directory -Path "src/ai/core"
   New-Item -ItemType Directory -Path "src/ai/models"
   New-Item -ItemType Directory -Path "src/ai/mcp"
   New-Item -ItemType Directory -Path "src/ai/tools"
   New-Item -ItemType Directory -Path "src/ai/tools/components"
   New-Item -ItemType Directory -Path "src/ai/suggestions"
   New-Item -ItemType Directory -Path "src/ai/planning"
   New-Item -ItemType Directory -Path "src/ai/transport"
   New-Item -ItemType Directory -Path "src/ai/prompts"
   New-Item -ItemType Directory -Path "src/ai/prompts/templates"
   New-Item -ItemType Directory -Path "src/ai/errors"
   New-Item -ItemType Directory -Path "src/ai/hooks"
   New-Item -ItemType Directory -Path "src/ai/agents/browser"
   New-Item -ItemType Directory -Path "src/ai/agents/youtube"
   ```

2. Create placeholder `index.ts` files in each new directory
3. Keep existing files in place (no moves yet)
4. Test that project still builds

**Validation**:
- [x] All new folders created
- [x] Project builds successfully
- [x] No runtime errors

---

### Phase 3: Move Core Files (Day 2-3) ✓
**Goal**: Move and update core AI logic files

**Files to Move**:
```
src/ai/aiLogic.ts          → src/ai/core/aiLogic.ts
src/ai/modelSetup.ts       → src/ai/core/modelSetup.ts
src/ai/modelDownloader.ts  → src/ai/models/downloader.ts
```

**Process for Each File**:
1. Move file to new location
2. Update imports in the moved file
3. Create barrel export in folder's `index.ts`
4. Find all files importing this file (use grep_search)
5. Update all import statements
6. Test build and functionality
7. Commit changes

**Example Import Updates**:
```typescript
// Before
import { aiLogic } from '../ai/aiLogic';

// After
import { aiLogic } from '../ai/core/aiLogic';
// OR (if using barrel export)
import { aiLogic } from '../ai/core';
```

**Validation**:
- [x] Files moved successfully
- [x] All imports updated
- [x] Project builds
- [x] Core functionality works
- [x] Tests pass (if any)

---

### Phase 4: Move MCP Files (Day 3) ✓
**Goal**: Organize Model Context Protocol files

**Files to Move**:
```
src/ai/mcpClient.ts  → src/ai/mcp/client.ts
src/ai/mcpProxy.ts   → src/ai/mcp/proxy.ts
```

**Process**:
1. Move MCP files to `src/ai/mcp/`
2. Update internal imports
3. Create barrel export
4. Update all external imports
5. Test MCP functionality
6. Commit changes

**Validation**:
- [x] MCP files moved
- [x] MCP functionality works
- [x] Server connections stable
- [x] Tool integration works

---

### Phase 5: Move Tool System Files (Day 4) ✓
**Goal**: Organize tool management and UI components

**Files to Move**:
```
src/ai/toolManager.ts         → src/ai/tools/manager.ts
src/ai/toolRegistry.ts        → src/ai/tools/registry.ts
src/ai/toolRegistryUtils.ts   → src/ai/tools/registryUtils.ts
src/ai/CompactToolRenderer.tsx → src/ai/tools/components/CompactToolRenderer.tsx
src/ai/ToolPartRenderer.tsx    → src/ai/tools/components/ToolPartRenderer.tsx
src/ai/ToolUIContext.tsx       → src/ai/tools/components/ToolUIContext.tsx
```

**Process**:
1. Move tool files to `src/ai/tools/`
2. Move UI components to `src/ai/tools/components/`
3. Update imports (especially React components)
4. Create barrel exports
5. Update all external imports
6. Test tool rendering and execution
7. Commit changes

**Validation**:
- [x] Tool files moved
- [x] Tool registration works
- [x] Tool UI renders correctly
- [x] Tool execution works
- [x] No console errors

---

### Phase 6: Move Stream & Transport Files (Day 4-5) ✓
**Goal**: Consolidate stream processing and transport

**Files to Move**:
```
src/ai/streamHelpers.ts           → src/ai/stream/streamHelpers.ts
src/ai/SimpleFrontendTransport.ts → src/ai/transport/SimpleFrontendTransport.ts
```

**Process**:
1. Move stream helpers into existing `stream/` folder
2. Move transport file to new `transport/` folder
3. Update imports
4. Update barrel exports
5. Test streaming functionality
6. Commit changes

**Validation**:
- [x] Files moved
- [x] Streaming works correctly
- [x] Transport layer functional
- [x] No performance regression

---

### Phase 7: Move Suggestion & Planning Files (Day 5) ✓
**Goal**: Organize suggestion and planning logic

**Files to Move**:
```
src/ai/localSuggestionGenerator.ts → src/ai/suggestions/local.ts
src/ai/suggestionGenerator.ts      → src/ai/suggestions/generator.ts
src/ai/localPlanner.ts             → src/ai/planning/localPlanner.ts
```

**Decision**: Named `suggestionGenerator.ts` as `generator.ts` because it's a main generator that coordinates both local and remote suggestion generation, calling local when no API key is available and remote when API key is present.

**Process**:
1. Move suggestion files
2. Move planning files
3. Update imports
4. Create barrel exports
5. Test suggestion generation
6. Test planning functionality
7. Commit changes

**Validation**:
- [x] Files moved
- [x] Suggestions generate correctly
- [x] Planning works as expected
- [x] UI shows suggestions properly

---

### Phase 8: Reorganize Agents (Day 6) ✓
**Goal**: Better organize agent implementations

**Files to Move**:
```
src/ai/agents/browserActionAgent.ts → src/ai/agents/browser/browserActionAgent.ts
src/ai/agents/prompts.ts            → src/ai/agents/browser/prompts.ts
src/ai/agents/youtubeAgent.ts       → src/ai/agents/youtube/youtubeAgent.ts
src/ai/agents/youtubeAgentTool.ts   → src/ai/agents/youtube/youtubeAgentTool.ts
```

**Process**:
1. Create subdirectories for each agent type
2. Move agent files to respective folders
3. Create barrel exports for each agent
4. Update imports
5. Test agent functionality
6. Commit changes

**Validation**:
- [x] Agent files organized by type
- [x] Browser agent works
- [x] YouTube agent works
- [x] All agent tools accessible

---

### Phase 9: Move Prompts & Error Files (Day 6) ✓
**Goal**: Organize prompts and error handling

**Files to Move**:
```
src/ai/prompt.ts          → src/ai/prompts/utils.ts
src/ai/prompt/local.ts    → src/ai/prompts/templates/local.ts
src/ai/prompt/remote.ts   → src/ai/prompts/templates/remote.ts
src/ai/errorHandlers.ts   → src/ai/errors/handlers.ts
```

**Process**:
1. Rename `prompt/` to `prompts/`
2. Move existing prompt files to `templates/` subfolder
3. Move `prompt.ts` to `prompts/utils.ts`
4. Move error handlers
5. Update imports
6. Create barrel exports
7. Test error handling
8. Test prompt generation
9. Commit changes

**Validation**:
- [x] Prompts organized
- [x] Error handling works
- [x] Prompt templates accessible
- [x] No broken imports

---

### Phase 10: Move Remaining Files (Day 7) ✓
**Goal**: Move hooks and types

**Files to Move**:
```
src/ai/useAIChat.ts → src/ai/hooks/useAIChat.ts
src/ai/types.ts     → src/ai/types/types.ts
```

**Process**:
1. Move React hook to `hooks/`
2. Move general types to `types/`
3. Update imports
4. Create barrel exports
5. Test hook functionality
6. Commit changes

**Validation**:
- [x] Hook works in components
- [x] Types accessible
- [x] No TypeScript errors

---

### Phase 11: Create Main Barrel Export (Day 7) ✓
**Goal**: Create central `src/ai/index.ts` export

**IMPORTANT DISCOVERY**: Creating `src/ai/index.ts` causes a **naming conflict** with the `ai` npm package! 
When code imports `import { something } from 'ai'`, the module resolver picks up our local `src/ai/index.ts` 
instead of the npm package from `node_modules/ai`, causing build errors.

**Resolution**: 
- ❌ **Cannot create** `src/ai/index.ts` due to npm package naming conflict
- ✅ **Keep using** subfolder barrel exports (e.g., `from './ai/core'`, `from './ai/tools'`)
- ✅ All subdirectories have their own `index.ts` barrel exports
- ✅ Created `src/ai/agents/index.ts` to complete the subfolder exports

**Subfolder Barrel Exports** (all working correctly):
```
src/ai/
├── agents/index.ts          ✓ NEW: Exports browser and youtube agents
├── core/index.ts            ✓ Exports aiLogic, modelSetup
├── errors/index.ts          ✓ Exports error handlers
├── geminiLive/index.ts      ✓ Exports GeminiLiveClient, AudioManager, etc.
├── hooks/index.ts           ✓ Exports useAIChat
├── mcp/index.ts             ✓ Exports MCP client and proxy
├── models/index.ts          ✓ Exports model downloader
├── planning/index.ts        ✓ Exports local planner
├── prompts/index.ts         ✓ Exports prompt utils and templates
├── stream/index.ts          ✓ Exports stream utilities
├── suggestions/index.ts     ✓ Exports suggestion generators
├── tools/index.ts           ✓ Exports tool system
├── transport/index.ts       ✓ Exports SimpleFrontendTransport
└── types/index.ts           ✓ Exports type definitions
```

**Usage Pattern**:
```typescript
// ✅ Use subfolder imports
import { aiLogic, modelSetup } from './ai/core';
import { setupLocalTools } from './ai/tools';
import { browserActionAgentDeclaration } from './ai/agents';

// ❌ Cannot use (conflicts with 'ai' npm package)
// import { aiLogic } from './ai';
```

**Validation**:
- [x] Subfolder barrel exports working
- [x] All modules accessible via subfolder imports
- [x] No circular dependencies
- [x] No naming conflicts with npm packages
- [x] Build succeeds
- [x] Documentation updated

---

### Phase 12: Testing & Validation (Day 8)
**Goal**: Comprehensive testing of reorganized code

**Testing Checklist**:
- [ ] **Build**: Project builds without errors
- [ ] **TypeScript**: No type errors
- [ ] **Core AI**: Chat functionality works
- [ ] **Local Mode**: Local AI works
- [ ] **Remote Mode**: Remote AI works with API key
- [ ] **Tools**: All tools execute correctly
- [ ] **MCP**: MCP servers connect and work
- [ ] **Agents**: Browser and YouTube agents work
- [ ] **Suggestions**: Suggestions generate correctly
- [ ] **Streaming**: Response streaming works
- [ ] **Error Handling**: Errors display properly
- [ ] **UI Components**: Tool renderers display correctly
- [ ] **Gemini Live**: Live mode works (if applicable)
- [ ] **Workflows**: Workflow mode works (if applicable)

**Performance Testing**:
- [ ] No performance regression
- [ ] Bundle size acceptable
- [ ] Memory usage normal
- [ ] Load times similar or better

---

### Phase 13: Documentation & Cleanup (Day 9)
**Goal**: Update documentation and remove old references

**Tasks**:
1. Update README.md with new structure
2. Update CONTRIBUTING.md with new file organization
3. Create `src/ai/README.md` explaining folder structure
4. Update any architecture documentation
5. Remove any empty folders
6. Clean up unused imports
7. Update comments referencing old paths
8. Create migration guide (if needed for other devs)

**Documentation to Create**:
- [ ] `src/ai/README.md` - Folder structure explanation
- [ ] Migration guide for external contributors
- [ ] Updated architecture diagrams (if any)

---

### Phase 14: Code Review & Refinement (Day 10)
**Goal**: Review and refine the reorganization

**Review Checklist**:
- [ ] All imports use consistent patterns
- [ ] Barrel exports are complete
- [ ] No duplicate exports
- [ ] Folder names follow conventions
- [ ] File names are clear and consistent
- [ ] No leftover files in wrong locations
- [ ] Comments are updated
- [ ] Dead code removed

**Refinement Tasks**:
- [ ] Identify any remaining inconsistencies
- [ ] Consider further consolidation opportunities
- [ ] Document any technical debt introduced
- [ ] Plan future improvements

---

## Migration Safety Guidelines

### Before Moving Each File:
1. ✅ Check file size and complexity
2. ✅ Identify all imports (use `grep_search`)
3. ✅ Document dependencies
4. ✅ Create git commit of working state

### After Moving Each File:
1. ✅ Update file imports
2. ✅ Update barrel exports
3. ✅ Update external imports
4. ✅ Run build
5. ✅ Test functionality
6. ✅ Commit changes with descriptive message

### If Something Breaks:
1. 🚨 Revert to last working commit
2. 🔍 Identify the issue
3. 📝 Document the problem
4. 🔧 Fix and try again

---

## Import Pattern Standards

### Use Barrel Exports Where Possible:
```typescript
// ✅ Good - using barrel export
import { aiLogic, modelSetup } from '../ai/core';

// ❌ Avoid - direct file imports (unless needed for tree-shaking)
import { aiLogic } from '../ai/core/aiLogic';
import { modelSetup } from '../ai/core/modelSetup';
```

### Consistent Path Aliases:
```typescript
// If using path aliases in tsconfig.json
import { aiLogic } from '@/ai/core';
```

---

## Success Metrics

### Code Quality:
- ✅ All files in logical folders
- ✅ No more than 5 files per root subfolder
- ✅ Clear separation of concerns
- ✅ Easy to find files by purpose

### Developer Experience:
- ✅ New developers can navigate easily
- ✅ Import paths are intuitive
- ✅ Related files are co-located
- ✅ Documentation is clear

### Technical Metrics:
- ✅ Build time unchanged or faster
- ✅ Bundle size unchanged or smaller
- ✅ No runtime errors introduced
- ✅ Test coverage maintained

---

## Risk Mitigation

### High-Risk Files:
- `aiLogic.ts` - Core logic, many dependencies
- `toolRegistry.ts` - Used throughout codebase
- `mcpClient.ts` - Complex MCP integration

**Strategy**: Move these files last, with extra testing

### Circular Dependencies:
- Monitor for circular imports
- Use `madge` or similar tool to detect
- Refactor if found

### TypeScript Issues:
- Keep `tsconfig.json` paths updated
- Watch for type resolution issues
- Test IDE autocomplete works

---

## Tools & Scripts

### Useful Commands:

#### Find all imports of a file:
```powershell
# Find imports of aiLogic.ts
grep -r "from.*aiLogic" src/
```

#### Check for circular dependencies:
```powershell
npm install -g madge
madge --circular src/ai/
```

#### Find all files in a directory:
```powershell
Get-ChildItem -Path src/ai -Recurse -File
```

#### Move and update imports (example):
```powershell
# Manual process - use replace_string_in_file tool
# Or create a migration script
```

---

## Timeline Summary

| Phase | Days | Description | Risk |
|-------|------|-------------|------|
| 1 | 1 | Planning & Preparation | Low |
| 2 | 1-2 | Create Folder Structure | Low |
| 3 | 2-3 | Move Core Files | Medium |
| 4 | 3 | Move MCP Files | Medium |
| 5 | 4 | Move Tool System | High |
| 6 | 4-5 | Move Stream & Transport | Medium |
| 7 | 5 | Move Suggestions & Planning | Medium |
| 8 | 6 | Reorganize Agents | Low |
| 9 | 6 | Move Prompts & Errors | Low |
| 10 | 7 | Move Remaining Files | Low |
| 11 | 7 | Create Barrel Exports | Medium |
| 12 | 8 | Testing & Validation | High |
| 13 | 9 | Documentation | Low |
| 14 | 10 | Review & Refinement | Medium |

**Total Estimated Time**: 10 working days

---

## Future Improvements

After reorganization is complete, consider:

1. **Lazy Loading**: Split large modules for better performance
2. **Path Aliases**: Add TypeScript path aliases for cleaner imports
3. **Package Boundaries**: Consider monorepo structure if needed
4. **API Surface**: Define clear public API vs internal modules
5. **Testing**: Add unit tests for each module
6. **Documentation**: Add inline documentation and examples

---

## Notes

- This is a living document - update as you progress
- Mark completed phases with checkmarks
- Document any deviations from the plan
- Keep this file in `plans/` directory for reference
- Consider creating a shorter migration script based on this plan

---

## Questions to Resolve

Before starting Phase 2:
- [ ] Should we use TypeScript path aliases? (e.g., `@ai/core`)
- [ ] Any specific naming conventions to follow?
- [ ] Are there any files that should NOT be moved?
- [ ] Should we move geminiLive files too, or keep as-is?
- [ ] Is there a preferred import style (barrel vs direct)?

---

**Status**: Phase 11 Complete ✓  
**Next Phase**: Phase 12 - Testing & Validation  
**Last Updated**: November 5, 2025

**Phase 11 Note**: Discovered that creating `src/ai/index.ts` causes naming conflict with the `ai` npm package. 
Solution: Use subfolder barrel exports only (e.g., `from './ai/core'`, `from './ai/tools'`).
