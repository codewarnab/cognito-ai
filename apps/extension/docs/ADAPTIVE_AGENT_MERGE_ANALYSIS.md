# Analysis: Merging Adaptive & Agent Modes

> **Status**: Analysis Document (No Implementation)  
> **Created**: 2026-01-13  
> **Purpose**: UX analysis for unifying Agent and Adaptive modes with dynamic tool discovery

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture](#current-architecture)
3. [Proposed Unified Model](#proposed-unified-model)
4. [UX Challenges & Solutions](#ux-challenges--solutions)
5. [UI Mockups](#ui-mockups)
6. [Data Model Changes](#data-model-changes)
7. [Implementation Complexity](#implementation-complexity)
8. [Recommendations](#recommendations)
9. [Trade-offs Summary](#trade-offs-summary)

---

## Executive Summary

**Vision**: Unify Agent and Adaptive modes by allowing users to selectively mark tools, categories, or MCP servers for "dynamic discovery" rather than having a completely separate mode.

**Key Concept**: Instead of switching between modes, users configure each tool/category as:
- **Enabled** (in context) → Direct execution
- **Discoverable** (on-demand) → Via `discoverTools` + `executeTools`
- **Disabled** → Not available

This approach provides:
- ✅ Granular control over context efficiency
- ✅ Familiar Agent mode workflow
- ✅ Adaptive mode's context savings
- ⚠️ Requires careful UI design to avoid clutter

---

## Current Architecture

### Mode Structure

| Mode | Tools in Context | Discovery | Execution |
|------|-----------------|-----------|-----------|
| **Chat** | ~7 fixed tools | ❌ | Direct |
| **Agent** | ~30 fixed tools | ❌ | Direct |
| **Adaptive** | 5 tools + index | ✅ via `discoverTools` | via `executeTools` |
| **CLI** | Agent tools | ❌ | Via CLI agent |

### Current UI Components

| Component | Purpose |
|-----------|---------|
| `ModeSelector.tsx` | 4 buttons (Chat, Agent, Adaptive, CLI) |
| `ToolCategory.tsx` | Categories with on/off toggles |
| `McpCategory.tsx` | MCP servers with tool toggles |
| `WebMcpSection.tsx` | Page-specific WebMCP tools |

### Current Tool State

```typescript
// Binary state: on or off
enabledMap: Record<string, boolean>
```

---

## Proposed Unified Model

### New Mental Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    UNIFIED AGENT MODE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Tool State (per tool/category/server):                       │
│   ┌──────────────────────────────────────────────────────────┐ │
│   │ 1. ENABLED (in context)    → Direct execution            │ │
│   │ 2. DISABLED (off)          → Not available               │ │
│   │ 3. DISCOVERABLE (on-demand)→ discoverTools + executeTools │ │
│   └──────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Tri-State System

| State | Icon | Behavior |
|-------|------|----------|
| **Enabled** | 🟢 | Tool schema loaded in context, direct execution |
| **Discoverable** | 🔮 | Not in context, available via `discoverTools` → `executeTools` |
| **Disabled** | ⚫ | Not available at all |

### When `discoverTools`/`executeTools` Are Added

Only when **at least one tool is marked as discoverable**:
- User marks a tool → `discoverTools` + `executeTools` are auto-added
- User removes all discoverable → meta-tools are auto-removed
- Seamless, no mode switching required

---

## UX Challenges & Solutions

### Challenge 1: Tri-State Toggle Clutter

**Problem**: A three-state toggle per tool creates visual complexity.

**Solution Options**:

| Approach | Description | Recommendation |
|----------|-------------|----------------|
| **A. Segmented Toggle** | Three-segment pill per tool | ❌ Too much space |
| **B. Secondary Action** | Checkbox + discovery icon button | 🟡 Okay for power users |
| **C. Category-Level Only** | Tri-state at category/server level | ✅ **Recommended** |
| **D. Progressive Disclosure** | Simple by default, advanced opt-in | ✅ **Best approach** |

**Recommended**: Category-level tri-state with optional per-tool overrides.

---

### Challenge 2: Visual Distinction

**Problem**: Users need instant recognition of tool states.

**Solution: Clear Visual Language**

| State | Visual Treatment |
|-------|-----------------|
| **Enabled** | 🟢 Green dot, solid background, full opacity |
| **Discoverable** | 🔮 Purple sparkle icon, dashed border, slight transparency |
| **Disabled** | ⚫ Gray, strikethrough text, low opacity |

**CSS Pattern**:

```css
/* Enabled - Full presence */
.tool-enabled {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
}

/* Discoverable - Subtle, available */
.tool-discoverable {
    background: transparent;
    border: 1px dashed rgba(168, 85, 247, 0.4);
    opacity: 0.85;
}

/* Disabled - Muted */
.tool-disabled {
    opacity: 0.4;
    text-decoration: line-through;
}
```

---

### Challenge 3: Explaining Dynamic Discovery

**Problem**: Users may not understand "discoverable" concept.

**Solutions**:

1. **Contextual Tooltip** (on 🔮 icon):
   > "Found on-demand. Saves context but adds a discovery step."

2. **Footer Banner** (in popover):
   > "🔮 Discoverable tools are found when needed, keeping context lean."

3. **First-Time Onboarding**:
   - When user first marks a tool discoverable, show explanatory toast
   - Never show again (localStorage flag)

---

### Challenge 4: MCP Server-Level Discovery

**Problem**: Users want entire MCP servers discoverable (e.g., "Discover Notion when mentioned").

**Solution: Server-Level Toggle**

```
┌─ MCP Servers ─────────────────────────────────────────────────────┐
│                                                                    │
│  [Notion Server]  ⚙️                                               │
│  ├── Mode: ○ All On  ● All Discoverable  ○ All Off               │
│  └── ⟨expand for per-tool overrides⟩                             │
│                                                                    │
│  [GitHub Server]  ⚙️                                               │
│  ├── Mode: ● All On  ○ All Discoverable  ○ All Off               │
│  └── ⟨expand for per-tool overrides⟩                             │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Benefits**:
- One decision per server (not per tool)
- Collapsed by default = less visual noise
- Expand for granular control when needed

---

### Challenge 5: Context Efficiency Feedback

**Problem**: Users don't understand *why* they should use discoverable.

**Solution: Context Budget Indicator**

```
┌─────────────────────────────────────────────────────────────────┐
│ Context Usage: ████████░░░░░░░░ 52%                             │
│                                                                 │
│ 🟢 Enabled (22 tools): ~3,800 tokens                           │
│ 🔮 Discoverable (15 tools): ~400 tokens (index only)           │
│ ⚫ Disabled (8 tools): 0 tokens                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Why this helps**:
- Makes the tradeoff tangible
- Encourages moving rarely-used tools to discoverable
- Power users can optimize for context-heavy tasks

---

## UI Mockups

### Option A: Minimal Change (Category-Level Tri-State)

```
┌───────────────────── Tool Configuration ─────────────────────┐
│                                                               │
│  [Chat] [Agent]  ← Adaptive absorbed into Agent              │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  Navigation Tools  ─────────────── [🟢] [🔮] [⚫]            │
│  ├── navigateTo          ✓ (inherits: enabled)               │
│  ├── switchTabs          ✓                                   │
│  └── getAllTabs          ✓                                   │
│                                                               │
│  MCP: Notion  ───────────────────── [🟢] [🔮] [⚫]            │
│  ├── createPage          🔮 (inherits: discoverable)         │
│  └── queryDatabase       🔮                                   │
│                                                               │
│  Memory Tools  ─────────────────── [🟢] [🔮] [⚫]            │
│  └── addMemory           ✓                                   │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│ 🟢 22 enabled  |  🔮 8 discoverable  |  Context: 52%         │
└───────────────────────────────────────────────────────────────┘
```

---

### Option B: Progressive Disclosure

Keep simple UI with "Advanced" toggle:

```
┌───────────────────── Tool Configuration ─────────────────────┐
│                                                               │
│  [Chat] [Agent] [Custom]     [□] Advanced Discovery Options  │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  When UNCHECKED (default):                                    │
│  └── Standard on/off toggles (current behavior)              │
│                                                               │
│  When CHECKED:                                                │
│  └── Tri-state toggles at category level                     │
│  └── Per-tool override options                               │
│  └── Context usage indicator                                 │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

**Benefits**:
- Casual users see familiar interface
- Power users opt into complexity
- Smooth migration path

---

### Option C: Smart Presets + Customize

```
┌───────────────────── Tool Configuration ─────────────────────┐
│                                                               │
│  Quick Presets:                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ [Minimal]  [Standard]  [Full Access]  [Customize...]    │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  Minimal:    Core tools enabled, everything else off         │
│  Standard:   Core enabled, MCP discoverable                  │
│  Full:       All tools enabled (high context usage)          │
│  Customize:  Opens tri-state configuration panel             │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## Data Model Changes

### Current State

```typescript
interface ToolsState {
    enabledMap: Record<string, boolean>;  // tool → on/off
    currentMode: 'chat' | 'agent' | 'adaptive' | 'custom' | 'cli';
}
```

### Proposed State

```typescript
type ToolState = 'enabled' | 'discoverable' | 'disabled';

interface ToolsState {
    // Tri-state per tool
    toolStateMap: Record<string, ToolState>;
    
    // Simplified modes (no 'adaptive')
    currentMode: 'chat' | 'agent' | 'custom' | 'cli';
    
    // Category/Server level defaults
    categoryDefaults: Record<string, ToolState>;
    mcpServerDefaults: Record<string, ToolState>;
    
    // Computed: are any tools discoverable?
    hasDiscoverableTools: boolean;  // → auto-add meta-tools
}
```

### Migration Strategy

```typescript
function migrateFromV1(oldState: OldToolsState): NewToolsState {
    const toolStateMap: Record<string, ToolState> = {};
    
    for (const [tool, enabled] of Object.entries(oldState.enabledMap)) {
        toolStateMap[tool] = enabled ? 'enabled' : 'disabled';
    }
    
    // If user was in adaptive mode, mark MCP tools as discoverable
    if (oldState.currentMode === 'adaptive') {
        for (const mcpTool of oldState.mcpTools) {
            toolStateMap[mcpTool.name] = 'discoverable';
        }
    }
    
    return {
        toolStateMap,
        currentMode: oldState.currentMode === 'adaptive' 
            ? 'agent' 
            : oldState.currentMode,
        // ...
    };
}
```

---

## Implementation Complexity

| Component | Changes Required | Complexity | Priority |
|-----------|-----------------|------------|----------|
| `toolsStore.ts` | Add tri-state logic | 🟡 Medium | P0 |
| `types.ts` | New `ToolState` type | 🟢 Low | P0 |
| `constants.ts` | Remove `ADAPTIVE_MODE_TOOLS` | 🟢 Low | P0 |
| `ModeSelector.tsx` | Remove Adaptive button | 🟢 Low | P1 |
| `ToolCategory.tsx` | Tri-state toggle UI | 🟡 Medium | P1 |
| `McpCategory.tsx` | Server-level tri-state | 🟡 Medium | P1 |
| `ToolsPopover.tsx` | Update adaptive UI | 🟡 Medium | P1 |
| `discoverTools.ts` | Filter by discoverable | 🟢 Low | P2 |
| `executeTools.ts` | Validate discoverable tools | 🟢 Low | P2 |
| System prompts | Dynamic tool index | 🟡 Medium | P2 |
| Storage migration | v1 → v2 schema | 🟢 Low | P0 |

---

## Recommendations

### Phase 1: Foundation (Week 1)

1. **Update data model** to tri-state
2. **Add migration logic** for existing users
3. **Implement category-level** tri-state toggles
4. **Remove Adaptive mode button**

### Phase 2: UI Polish (Week 2)

1. **Progressive disclosure** checkbox for advanced options
2. **Visual distinction** (colors, icons, borders)
3. **Context usage indicator**
4. **Tooltips and education**

### Phase 3: Optimization (Week 3)

1. **Smart defaults**:
   - MCP servers → default discoverable
   - Core browser tools → default enabled
2. **Preset configurations** (Minimal / Standard / Full)
3. **Per-tool override** for power users

---

## Trade-offs Summary

| Aspect | Separate Modes (Current) | Merged Modes (Proposed) |
|--------|--------------------------|-------------------------|
| **Simplicity** | Clear boundaries | More nuanced |
| **Flexibility** | All-or-nothing | Granular control |
| **Learning Curve** | Mode switching easy | Tri-state needs explanation |
| **Context Efficiency** | Adaptive is efficient | Same efficiency, more control |
| **UI Clutter** | 4 mode buttons | 3 buttons + tri-state |
| **Mental Model** | "Which mode am I in?" | "Which tools do I want?" |

---

## Conclusion

Merging adaptive and agent modes is a **sound architectural decision** that provides:

1. **More user control** over context efficiency
2. **Elimination of mode-switching** confusion
3. **Familiar agent workflow** with adaptive benefits

The main challenge is **managing UI complexity**. Recommended approach:

1. **Category-level controls** with inheritance (simple default)
2. **Progressive disclosure** for power users
3. **Strong visual language** for clear state distinction
4. **Context feedback** to educate on tradeoffs

This gives the best of both worlds: the context efficiency of adaptive mode with the familiarity of agent mode.

---

## Next Steps

- [ ] Review this analysis with team
- [ ] Create detailed UI design mockups (Figma/design tool)
- [ ] Prototype tri-state toggle component
- [ ] User testing on progressive disclosure approach
- [ ] Finalize data model and migration strategy
