<!-- b68f02ca-b3fd-49df-b93a-3006e7ca43db f3652195-e24b-4606-91d2-ef5ba349cb48 -->
# Compact Tool UI Redesign Plan

## Overview

Transform the current large tool card UI into a compact, icon-based design with:

- Icon + tool name horizontal layout
- Animated loading-check icon during execution
- Check mark state when completed
- Transparent icon on hover
- Chevron-right that appears on hover and switches to chevron-down when accordion opens
- Collapsible accordion to show input/output details (truncated if large)

## Current Architecture Context

### Current Tool Rendering Flow

1. **ToolPartRenderer** (`src/ai/ToolPartRenderer.tsx`): Main renderer that handles AI SDK v5 tool parts

   - Checks if tool has custom UI via `useToolUI()` hook
   - Falls back to `DefaultToolRenderer` if no custom UI exists
   - Tool states: `input-streaming`, `input-available`, `output-available`, `output-error`

2. **ToolCard Component** (`src/components/ui/ToolCard.tsx`): Current large card design

   - Used by all action tools (interactions, tabs, memory, etc.)
   - Shows: icon, title, subtitle, state indicator (spinner/checkmark/error), optional children
   - States: `loading`, `success`, `error`

3. **Tool Registration** (`src/actions/*/`): Each tool registers both execution logic and UI renderer

   - Uses `registerTool()` for execution logic
   - Uses `registerToolUI()` for custom UI rendering
   - All tools currently use ToolCard component

### Available Animated Icons (assets/chat/)

- `click.tsx` - CursorClickIcon (for click/interaction tools)
- `navigate-to.tsx` - CompassIcon (for navigation tools)
- `save-memory.tsx` - HardDriveDownloadIcon (for memory tools)
- `search.tsx` - SearchIcon (for search tools)
- `keyboard-type.tsx` - KeyboardIcon (for typing tools)
- `scroll.tsx` - ScrollIcon
- `new-tab.tsx` - NewTabIcon
- `switch.tsx` - SwitchIcon
- `folder.tsx` - FolderIcon
- `history.tsx` - HistoryIcon
- `youtube.tsx` - YoutubeIcon
- `link.tsx` - LinkIcon
- `chrome.tsx` - ChromeIcon
- `wait-for.tsx` - WaitForIcon
- `blocked.tsx` - BlockedIcon
- `circle-check.tsx` - CircleCheckIcon
- `expand.tsx` - ExpandIcon
- `loading-check.tsx` - LoadingCheckIcon (**for loading state**)
- `chevron-right.tsx` - ChevronRightIcon (**for collapsed accordion**)
- `chevrown-down.tsx` - ChevronDownIcon (**for expanded accordion**)
- `delete-memory.tsx`, `retrieve-memory.tsx`, `suggest-memery.tsx`

### Tool Categories & Actions

**Interactions** (`src/actions/interactions/`):

- clickElement, clickByText, focusElement, typeInField, pressKey, scroll, search, getSearchResults, openSearchResult, extractText

**Tabs** (`src/actions/tabs/`):

- navigateTo, switchTabs, getActiveTab, applyTabGroups, organizeTabsByContext, ungroupTabs

**Memory** (`src/actions/memory/`):

- saveMemory, getMemory, deleteMemory, listMemories, suggestSaveMemory

**History** (`src/actions/history/`):

- getRecentHistory, getUrlVisits, searchHistory

**Reminder** (`src/actions/reminder/`):

- createReminder, cancelReminder, listReminders

**YouTube** (`src/actions/youtube/`):

- Various YouTube-specific tools

## Implementation Steps

### Step 1: Create Icon Mapping Utility

**File**: `src/components/ui/ToolIconMapper.tsx`

Create a centralized mapping file that maps tool names to their corresponding animated icons:

```tsx
import { CursorClickIcon } from '../../../assets/chat/click';
import { CompassIcon } from '../../../assets/chat/navigate-to';
import { HardDriveDownloadIcon } from '../../../assets/chat/save-memory';
import { SearchIcon } from '../../../assets/chat/search';
// ... import all other icons

export const TOOL_ICON_MAP: Record<string, React.ComponentType<any>> = {
  // Interaction tools
  clickElement: CursorClickIcon,
  clickByText: CursorClickIcon,
  focusElement: CursorClickIcon,
  typeInField: KeyboardTypeIcon,
  pressKey: KeyboardTypeIcon,
  scroll: ScrollIcon,
  search: SearchIcon,
  chromeSearch: SearchIcon,
  getSearchResults: SearchIcon,
  openSearchResult: LinkIcon,
  
  // Tab tools
  navigateTo: CompassIcon,
  switchTabs: SwitchIcon,
  getActiveTab: ChromeIcon,
  applyTabGroups: FolderIcon,
  organizeTabsByContext: FolderIcon,
  ungroupTabs: FolderIcon,
  
  // Memory tools
  saveMemory: HardDriveDownloadIcon,
  getMemory: RetrieveMemoryIcon,
  deleteMemory: DeleteMemoryIcon,
  listMemories: FolderIcon,
  suggestSaveMemory: SuggestMemoryIcon,
  
  // History tools
  getRecentHistory: HistoryIcon,
  getUrlVisits: HistoryIcon,
  searchHistory: HistoryIcon,
  
  // Other tools
  youtube: YoutubeIcon,
  createReminder: CircleCheckIcon,
  // ... add all mappings
};

export function getToolIcon(toolName: string) {
  return TOOL_ICON_MAP[toolName] || ChromeIcon; // Default fallback
}
```

### Step 2: Create Compact Tool Card Component

**File**: `src/components/ui/CompactToolCard.tsx`

Create new compact component with accordion functionality:

```tsx
import React, { useState, useRef } from 'react';
import { LoadingCheckIcon } from '../../../assets/chat/loading-check';
import { ChevronRightIcon } from '../../../assets/chat/chevron-right';
import { ChevronDownIcon } from '../../../assets/chat/chevrown-down';
import { getToolIcon } from './ToolIconMapper';

interface CompactToolCardProps {
  toolName: string;
  state: 'loading' | 'success' | 'error';
  input?: any;
  output?: any;
  errorText?: string;
}

export function CompactToolCard({ 
  toolName, 
  state, 
  input, 
  output, 
  errorText 
}: CompactToolCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const loadingCheckRef = useRef<LoadingCheckIconHandle>(null);
  const chevronRef = useRef<ChevronRightIconHandle | ChevronDownIconHandle>(null);
  const ToolIcon = getToolIcon(toolName);
  
  // Trigger loading animation when state is loading
  useEffect(() => {
    if (state === 'loading') {
      loadingCheckRef.current?.startAnimation();
    } else if (state === 'success') {
      loadingCheckRef.current?.stopAnimation();
    }
  }, [state]);
  
  const formatContent = (data: any, maxLength = 200) => {
    if (!data) return '';
    const str = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    return str.length > maxLength ? str.slice(0, maxLength) + '...' : str;
  };
  
  return (
    <div 
      className="compact-tool-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        className="compact-tool-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Left: Icon + Tool Name */}
        <div className="compact-tool-main">
          <div className={`compact-tool-icon ${isHovered ? 'hovered' : ''}`}>
            <ToolIcon size={20} />
          </div>
          <span className="compact-tool-name">{toolName}</span>
        </div>
        
        {/* Right: Status Icon + Chevron */}
        <div className="compact-tool-status">
          {state === 'loading' && (
            <LoadingCheckIcon ref={loadingCheckRef} size={20} />
          )}
          {state === 'success' && (
            <LoadingCheckIcon ref={loadingCheckRef} size={20} />
          )}
          {state === 'error' && (
            <div className="compact-tool-error-icon">✕</div>
          )}
          
          {isHovered && (
            isExpanded ? (
              <ChevronDownIcon ref={chevronRef} size={16} />
            ) : (
              <ChevronRightIcon ref={chevronRef} size={16} />
            )
          )}
        </div>
      </div>
      
      {/* Accordion Content */}
      {isExpanded && (
        <div className="compact-tool-content">
          {input && (
            <div className="compact-tool-section">
              <div className="compact-tool-label">Input:</div>
              <pre className="compact-tool-code">
                {formatContent(input)}
              </pre>
            </div>
          )}
          
          {output && state === 'success' && (
            <div className="compact-tool-section">
              <div className="compact-tool-label">Output:</div>
              <pre className="compact-tool-code">
                {formatContent(output)}
              </pre>
            </div>
          )}
          
          {errorText && state === 'error' && (
            <div className="compact-tool-section error">
              <div className="compact-tool-label">Error:</div>
              <div className="compact-tool-error-text">
                {formatContent(errorText)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### Step 3: Create Compact Tool Card Styles

**File**: `src/styles/compact-tools.css`

Add styling for the compact tool card:

```css
.compact-tool-card {
  border-radius: 8px;
  padding: 8px 12px;
  margin: 4px 0;
  border: 1px solid var(--color-border);
  background: var(--color-background);
  transition: all 0.2s ease;
}

.compact-tool-card:hover {
  background: rgba(18, 100, 255, 0.03);
}

.compact-tool-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
}

.compact-tool-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.compact-tool-icon {
  display: flex;
  align-items: center;
  transition: opacity 0.2s ease;
}

.compact-tool-icon.hovered {
  opacity: 0.6;
}

.compact-tool-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  font-family: monospace;
}

.compact-tool-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.compact-tool-error-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-error);
  color: white;
  font-size: 12px;
  font-weight: bold;
}

.compact-tool-content {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
  animation: slideDown 0.2s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.compact-tool-section {
  margin-bottom: 8px;
}

.compact-tool-section:last-child {
  margin-bottom: 0;
}

.compact-tool-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text);
  opacity: 0.7;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.compact-tool-code {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  overflow-x: auto;
  max-height: 150px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.compact-tool-error-text {
  color: var(--color-error);
  background: rgba(244, 67, 54, 0.1);
  border: 1px solid var(--color-error);
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 12px;
}
```

### Step 4: Create New Default Tool Renderer

**File**: `src/ai/CompactToolRenderer.tsx`

Create a new default renderer using CompactToolCard:

```tsx
import React from 'react';
import { CompactToolCard } from '../components/ui/CompactToolCard';
import type { ToolUIState } from './ToolUIContext';

export function CompactToolRenderer({ state }: { state: ToolUIState }) {
  const { toolName, state: toolState, input, output, errorText } = state;
  
  const uiState = 
    toolState === 'input-streaming' || toolState === 'input-available' 
      ? 'loading'
      : toolState === 'output-available'
      ? 'success'
      : 'error';
  
  return (
    <CompactToolCard
      toolName={toolName}
      state={uiState}
      input={input}
      output={output}
      errorText={errorText}
    />
  );
}
```

### Step 5: Update ToolPartRenderer to Use Compact Renderer

**File**: `src/ai/ToolPartRenderer.tsx` (lines 94-95)

Replace the DefaultToolRenderer with CompactToolRenderer:

```tsx
// OLD:
return <DefaultToolRenderer state={toolState} />;

// NEW:
return <CompactToolRenderer state={toolState} />;
```

Import at top:

```tsx
import { CompactToolRenderer } from './CompactToolRenderer';
```

### Step 6: Import Compact Styles in Main Stylesheet

**File**: `src/sidepanel.css` or appropriate entry point

Add import for new compact tool styles:

```css
@import './styles/compact-tools.css';
```

### Step 7: Update Existing Action Tools (Gradual Migration)

For each action file in `src/actions/*/`, update the `registerToolUI` call to use CompactToolCard.

**Example for `src/actions/interactions/click.tsx` (lines 67-96)**:

Replace the custom ToolCard rendering with null (to use default CompactToolRenderer):

```tsx
// REMOVE custom registerToolUI call (lines 67-96)
// The CompactToolRenderer will be used automatically as fallback
```

OR keep custom rendering but use CompactToolCard:

```tsx
registerToolUI('clickElement', (state: ToolUIState) => {
  const { state: toolState, input, output } = state;
  
  const uiState = 
    toolState === 'input-streaming' || toolState === 'input-available'
      ? 'loading'
      : toolState === 'output-available'
      ? 'success'
      : 'error';
  
  return (
    <CompactToolCard
      toolName="clickElement"
      state={uiState}
      input={input}
      output={output}
      errorText={state.errorText}
    />
  );
});
```

**Files to update** (all action files):

- `src/actions/interactions/*.tsx` (12 files)
- `src/actions/tabs/*.tsx` (6 files)
- `src/actions/memory/*.tsx` (5 files)
- `src/actions/history/*.tsx` (3 files)
- `src/actions/reminder/*.tsx` (3 files)
- `src/actions/youtube/index.tsx`

### Step 8: Test and Verify

1. Test all tool states (loading, success, error)
2. Verify animated icons work correctly
3. Verify accordion expand/collapse functionality
4. Verify hover states (transparent icon, chevron appearance)
5. Verify content truncation for large inputs/outputs
6. Test with multiple tools executing simultaneously

## Key Files Modified

1. **New Files**:

   - `src/components/ui/ToolIconMapper.tsx` - Icon mapping utility
   - `src/components/ui/CompactToolCard.tsx` - New compact component
   - `src/styles/compact-tools.css` - Styling for compact cards
   - `src/ai/CompactToolRenderer.tsx` - Default compact renderer

2. **Modified Files**:

   - `src/ai/ToolPartRenderer.tsx` - Use CompactToolRenderer as default
   - `src/sidepanel.css` - Import compact-tools.css
   - All action files in `src/actions/*/` - Update or remove custom registerToolUI

## Implementation Notes

- **Icon animations**: All icons from `assets/chat/` support `startAnimation()` and `stopAnimation()` via refs
- **LoadingCheckIcon**: Automatically animates when ref methods are called; shows checkmark when stopped in checked state
- **Accordion**: Use CSS animation for smooth expand/collapse
- **Content truncation**: Max 200 characters for preview, full content when expanded
- **Hover behavior**: Icon opacity 0.6 on hover, chevron appears only on hover
- **Tool state mapping**: 
  - `input-streaming` / `input-available` → loading (LoadingCheckIcon animating)
  - `output-available` → success (LoadingCheckIcon in checked state)
  - `output-error` → error (Red X icon)

### To-dos

- [ ] Create ToolIconMapper.tsx with comprehensive tool-to-icon mapping
- [ ] Create CompactToolCard component with accordion and animation support
- [ ] Create compact-tools.css with all necessary styling
- [ ] Create CompactToolRenderer as new default renderer
- [ ] Update ToolPartRenderer to use CompactToolRenderer as default
- [ ] Import compact-tools.css in main stylesheet
- [ ] Update all action files to remove custom ToolCard rendering (let CompactToolRenderer handle it)
- [ ] Test all tool states, animations, accordion, and verify everything works correctly