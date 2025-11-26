# Supermemory Migration - Multi-Phase Implementation Plan

## Overview
Migrate from local Chrome storage-based memory system to Supermemory cloud-based memory with AI SDK integration.

### Key Decisions
- **User ID**: Generate UUID on first install, persist in Chrome storage
- **API Key Location**: Bottom of Settings page
- **Tool Gating**: Show info icon with tooltip when not configured, don't allow toggle
- **Migration**: No migration needed (fresh start)
- **Local Mode**: Supermemory disabled completely in local mode
- **Memory UI**: Remove sidebar and header menu option entirely

---

## Phase 1: Package Installation & Cleanup Preparation
**Goal**: Add Supermemory package, identify all files to delete/modify

### 1.1 Install Package
```powershell
pnpm add @supermemory/tools
```

### 1.2 Files to DELETE (complete removal)
| File/Folder | Reason |
|-------------|--------|
| `src/memory/store.ts` | Local memory storage layer |
| `src/memory/types.ts` | Local memory types |
| `src/memory/` folder | Entire folder |
| `src/actions/memory/saveMemory.tsx` | Local memory tool |
| `src/actions/memory/getMemory.tsx` | Local memory tool |
| `src/actions/memory/listMemories.tsx` | Local memory tool |
| `src/actions/memory/deleteMemory.tsx` | Local memory tool |
| `src/actions/memory/index.tsx` | Local memory registration |
| `src/actions/memory/` folder | Entire folder |
| `src/components/features/memory/MemoryPanel.tsx` | Memory UI panel |
| `src/components/features/memory/MemorySidebar.tsx` | Memory sidebar |
| `src/components/features/memory/index.ts` | Memory exports |
| `src/components/features/memory/` folder | Entire folder |
| `src/hooks/useBehavioralPreferences.ts` | Depends on local memory |
| `src/styles/features/memory/base.css` | Memory styles |
| `src/styles/features/memory/sidebar.css` | Memory sidebar styles |
| `src/styles/features/memory/index.css` | Memory style imports |
| `src/styles/features/memory/` folder | Entire folder |
| `src/types/memory/` folder | Memory types (if exists) |

---

## Phase 2: Remove Memory References from Codebase
**Goal**: Clean up all imports and usages of deleted modules

### 2.1 Files to MODIFY

| File | Changes |
|------|---------|
| `src/actions/registerAll.ts` | Remove `registerMemoryActions` import and call |
| `src/sidepanel.tsx` | Remove MemorySidebar import, state, rendering, menu click handler |
| `src/hooks/index.ts` | Remove `useBehavioralPreferences` export |
| `src/styles/index.css` | Remove `@import './features/memory/index.css'` |
| `src/constants/toolDescriptions.ts` | Remove memory tools from TOOL_DESCRIPTIONS and TOOL_CATEGORIES |
| `src/ai/tools/enabledTools.ts` | Remove saveMemory, getMemory, listMemories, deleteMemory from DEFAULT_ENABLED_TOOLS |
| `src/ai/prompts/utils.ts` | Remove entire "MEMORY SYSTEM" section and memory tool references |

### 2.2 UI Cleanup
| File | Changes |
|------|---------|
| `src/components/shell/CopilotChatWindow.tsx` (or similar) | Remove "Memory" option from header three-dot menu |

---

## Phase 3: User ID Generation & Storage
**Goal**: Create unique user ID system for Supermemory

### 3.1 New Files to CREATE

| File | Purpose |
|------|---------|
| `src/utils/supermemory/userId.ts` | Generate/retrieve persistent user UUID |
| `src/utils/supermemory/credentials.ts` | Store/retrieve Supermemory API key |
| `src/utils/supermemory/index.ts` | Exports |

### 3.2 User ID Logic
```typescript
// Generate UUID on first run, persist in chrome.storage.local
// Key: 'supermemory:userId'
// Format: UUID v4

import { v4 as uuidv4 } from 'uuid';

export async function getSupermemoryUserId(): Promise<string> {
  const storage = await chrome.storage.local.get('supermemory:userId');
  if (storage['supermemory:userId']) {
    return storage['supermemory:userId'];
  }
  
  const newId = uuidv4();
  await chrome.storage.local.set({ 'supermemory:userId': newId });
  return newId;
}
```

---

## Phase 4: Settings Types & Storage
**Goal**: Extend settings to support Supermemory configuration

### 4.1 Files to MODIFY

| File | Changes |
|------|---------|
| `src/types/settings.ts` | Add `supermemoryApiKey?: string`, `supermemoryEnabled?: boolean` |
| `src/utils/settings/settingsStorage.ts` | Add getter/setter for Supermemory settings |

### 4.2 Type Additions
```typescript
export interface UserSettings {
  // ... existing fields
  supermemoryApiKey?: string;
  supermemoryEnabled?: boolean;
}
```

---

## Phase 5: Settings UI - Supermemory Configuration
**Goal**: Add Supermemory setup section at bottom of Settings page

### 5.1 New Files to CREATE

| File | Purpose |
|------|---------|
| `src/components/features/settings/components/SupermemorySettings.tsx` | Supermemory API key input + instructions |

### 5.2 UI Design
```
┌─────────────────────────────────────────────────────────┐
│ [Supermemory Icon] Supermemory                          │
├─────────────────────────────────────────────────────────┤
│ Enable persistent memory across conversations           │
│                                                         │
│ API Key: [••••••••••••••••] [👁]                        │
│                                                         │
│ Get your API key from:                                  │
│ https://console.supermemory.ai/keys                     │
│                                                         │
│ Status: ✅ Connected / ⚠️ Not configured               │
└─────────────────────────────────────────────────────────┘
```

### 5.3 Files to MODIFY

| File | Changes |
|------|---------|
| `src/components/features/settings/SettingsPage.tsx` | Import and add `<SupermemorySettings />` at bottom |

---

## Phase 6: Tool Enable/Disable with Setup Gating
**Goal**: Prevent enabling Supermemory tools without API key

### 6.1 Files to MODIFY

| File | Changes |
|------|---------|
| `src/constants/toolDescriptions.ts` | Add new Supermemory tools (from @supermemory/tools) to descriptions |
| `src/ai/tools/enabledTools.ts` | Add Supermemory tool names, add to TOOLS_DISABLED_BY_DEFAULT |
| `src/components/features/settings/components/EnabledToolsSettings.tsx` | Add gating logic - show info icon with tooltip when trying to enable without API key |
| `src/components/features/chat/components/modals/ToolsModal.tsx` | Same gating logic for chat input tools modal |

### 6.2 Gating Behavior
```
When Supermemory NOT configured:
┌──────────────────────────────────────┐
│ addMemory          [ℹ️]              │
│ searchMemory       [ℹ️]              │
│ getMemories        [ℹ️]              │
└──────────────────────────────────────┘
        │
        ▼ (hover/click on ℹ️)
┌──────────────────────────────────────┐
│ [Supermemory Icon]                   │
│ Configure Supermemory API key in     │
│ Settings to enable memory tools      │
│                                      │
│ [Go to Settings]                     │
└──────────────────────────────────────┘
```

### 6.3 Supermemory Tools to Add
Based on `@supermemory/tools` package:
- `addMemory` - Save information to memory
- `searchMemory` - Search memories semantically  
- `getMemories` - Retrieve stored memories

---

## Phase 7: Model Factory Integration
**Goal**: Wrap models with `withSupermemory()` when enabled

### 7.1 Files to MODIFY

| File | Changes |
|------|---------|
| `src/ai/core/modelFactory.ts` | Import `withSupermemory`, wrap Google and Vertex models when Supermemory is enabled |
| `src/ai/setup/remoteMode.ts` | Add Supermemory tools when enabled, alongside other tools |

### 7.2 Integration Logic
```typescript
// In modelFactory.ts
import { withSupermemory } from '@supermemory/tools/ai-sdk';
import { getSupermemoryUserId } from '@/utils/supermemory';
import { getSupermemoryApiKey, isSupermemoryEnabled } from '@/utils/supermemory';

// After initializing Google/Vertex model:
async function initializeGoogleModel(modelName: string): Promise<ModelInitResult> {
  // ... existing initialization
  
  const smEnabled = await isSupermemoryEnabled();
  const smApiKey = await getSupermemoryApiKey();
  
  if (smEnabled && smApiKey) {
    const userId = await getSupermemoryUserId();
    // Wrap with Supermemory for automatic user profile injection
    model = withSupermemory(model, userId);
  }
  
  return { model, provider: 'google', modelName };
}

// Same for initializeVertexModel
```

### 7.3 Local Mode Handling
- `initializeLocalModel()` returns model WITHOUT Supermemory wrapper
- Supermemory only works in remote mode (Google/Vertex)

---

## Phase 8: Supermemory Tools Registration
**Goal**: Register Supermemory tools with the AI when enabled

### 8.1 Files to MODIFY

| File | Changes |
|------|---------|
| `src/ai/setup/remoteMode.ts` | Import `supermemoryTools`, conditionally add to tools object |

### 8.2 Tool Registration
```typescript
import { supermemoryTools } from '@supermemory/tools/ai-sdk';
import { getSupermemoryApiKey, isSupermemoryEnabled } from '@/utils/supermemory';

// In setupRemoteMode:
export async function setupRemoteMode(...): Promise<RemoteModeSetup> {
  // ... existing setup
  
  // Add Supermemory tools if enabled
  let smTools: Record<string, any> = {};
  const smEnabled = await isSupermemoryEnabled();
  const smApiKey = await getSupermemoryApiKey();
  
  if (smEnabled && smApiKey) {
    smTools = supermemoryTools(smApiKey);
    log.info('🧠 Supermemory tools loaded:', {
      count: Object.keys(smTools).length,
      names: Object.keys(smTools)
    });
  }
  
  // Combine all tools
  const tools = { ...extensionTools, ...mcpTools, ...agentTools, ...smTools };
  
  return { model, tools, systemPrompt, provider };
}
```

---

## Phase 9: Prompt Updates
**Goal**: Update AI prompts to reference Supermemory tools

### 9.1 Files to MODIFY

| File | Changes |
|------|---------|
| `src/ai/prompts/utils.ts` | Replace old memory instructions with Supermemory tool instructions |
| `src/ai/prompts/templates/remote.ts` | Update if memory is mentioned |

### 9.2 New Prompt Section
```typescript
// Replace entire MEMORY SYSTEM section with:
"MEMORY SYSTEM (Supermemory):",
"  - Use Supermemory tools to save and recall user information across sessions",
"  - User profiles are automatically injected into context for personalization",
"  - Tools available: addMemory, searchMemory, getMemories",
"",
"  SAVING MEMORIES:",
"  - ALWAYS ask user consent before saving: 'Would you like me to remember this?'",
"  - Use addMemory to save facts, preferences, or important information",
"  - Be selective - only save genuinely useful information",
"",
"  RETRIEVING MEMORIES:",
"  - Use searchMemory to find relevant information semantically",
"  - Use getMemories to list stored memories",
"  - User context is automatically available in your responses",
"",
"  EXAMPLES:",
"  - User: 'My name is Alice' → Ask: 'Would you like me to remember your name?'",
"  - User: 'Yes' → Use addMemory, confirm: 'Got it! I'll remember that.'",
"  - User: 'What do you know about me?' → Use searchMemory or getMemories",
```

---

## Phase 10: Empty State Tip
**Goal**: Add Supermemory tip to EmptyState

### 10.1 Files to MODIFY

| File | Changes |
|------|---------|
| `src/components/features/chat/components/states/EmptyState.tsx` | Add tip about Supermemory to TIPS array |

### 10.2 New Tip
```typescript
const TIPS = [
    // ... existing tips
    "Enable Supermemory in Settings to let me remember things about you across conversations",
];
```

---

## Phase 11: Testing & Validation
**Goal**: Ensure everything works

### 11.1 Test Cases
- [ ] Extension builds without errors (`pnpm build`)
- [ ] Type check passes (`pnpm type:check`)
- [ ] Settings page shows Supermemory section at bottom
- [ ] Cannot enable Supermemory tools without API key
- [ ] Info icon appears with tooltip for unconfigured tools
- [ ] API key saves and validates correctly
- [ ] Memory tools appear in tools list when Supermemory is configured
- [ ] AI can use memory tools in remote mode
- [ ] Local mode works without Supermemory (no errors)
- [ ] Memory option removed from header three-dot menu
- [ ] No leftover memory UI components or references
- [ ] EmptyState shows Supermemory tip

### 11.2 Build Verification
```powershell
pnpm type:check
pnpm build
```

---

## File Summary

### DELETE (17+ files, 4 folders)
```
src/memory/                              # Entire folder
src/actions/memory/                      # Entire folder
src/components/features/memory/          # Entire folder
src/styles/features/memory/              # Entire folder
src/hooks/useBehavioralPreferences.ts
src/types/memory/                        # If exists
```

### CREATE (4 new files)
```
src/utils/supermemory/userId.ts
src/utils/supermemory/credentials.ts
src/utils/supermemory/index.ts
src/components/features/settings/components/SupermemorySettings.tsx
```

### MODIFY (15+ files)
```
package.json                             # Add @supermemory/tools
src/actions/registerAll.ts               # Remove memory registration
src/sidepanel.tsx                        # Remove MemorySidebar
src/hooks/index.ts                       # Remove useBehavioralPreferences export
src/styles/index.css                     # Remove memory CSS import
src/constants/toolDescriptions.ts        # Update tool lists
src/ai/tools/enabledTools.ts             # Update enabled tools
src/ai/prompts/utils.ts                  # Replace memory prompts
src/ai/core/modelFactory.ts              # Add withSupermemory wrapper
src/ai/setup/remoteMode.ts               # Add supermemoryTools
src/types/settings.ts                    # Add Supermemory settings types
src/utils/settings/settingsStorage.ts    # Add Supermemory getters/setters
src/components/features/settings/SettingsPage.tsx              # Add SupermemorySettings
src/components/features/settings/components/EnabledToolsSettings.tsx  # Add gating
src/components/features/chat/components/modals/ToolsModal.tsx         # Add gating
src/components/features/chat/components/states/EmptyState.tsx         # Add tip
src/components/shell/* or similar        # Remove Memory menu option
```

---

## Execution Order

| Phase | Description | Dependencies |
|-------|-------------|--------------|
| 1 | Install package | None |
| 2 | Delete old memory files | Phase 1 |
| 3 | Remove imports/references | Phase 2 |
| 4 | Add user ID generation | Phase 1 |
| 5 | Extend settings types | Phase 1 |
| 6 | Create settings UI | Phases 4, 5 |
| 7 | Add tool gating | Phases 5, 6 |
| 8 | Model factory integration | Phases 4, 5 |
| 9 | Tools registration | Phases 4, 5, 8 |
| 10 | Prompt updates | Phase 3 |
| 11 | Add EmptyState tip | None |
| 12 | Test & validate | All phases |

---

## Assets Used
- `assets/brands/integrations/Supermemory.tsx` - Supermemory icon for settings and tooltips

---

## References
- Supermemory AI SDK Docs: https://supermemory.ai/docs/ai-sdk/overview
- API Key Console: https://console.supermemory.ai/keys
- NPM Package: https://www.npmjs.com/package/@supermemory/tools
