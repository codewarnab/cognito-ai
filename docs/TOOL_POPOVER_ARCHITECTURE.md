# Tool Popover Architecture

This document provides comprehensive documentation for the Tool Popover system, which manages tool enablement, storage, filtering, and display across three distinct tool sources.

## Table of Contents

1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Tool Sources](#tool-sources)
4. [Data Flow](#data-flow)
5. [State Management](#state-management)
6. [Storage Layer](#storage-layer)
7. [Component Hierarchy](#component-hierarchy)
8. [Mode System](#mode-system)
9. [Filtering System](#filtering-system)
10. [Sequence Diagrams](#sequence-diagrams)

---

## Overview

The Tool Popover is a complex UI component that allows users to manage which AI tools are available during conversations. It aggregates tools from three sources:

1. **Extension Tools** - Built-in browser automation tools
2. **MCP Tools** - Model Context Protocol server tools
3. **WebMCP Tools** - Website-exposed tools from the active tab


---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TOOL POPOVER SYSTEM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        ToolsPopover.tsx                              │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │    │
│  │  │  SearchBar  │  │ModeSelector │  │   Footer    │  │  Content   │  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      useToolsPopover Hook                            │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │    │
│  │  │ enabledMap   │  │ mcpDisabled  │  │ webmcpDisabledTools      │   │    │
│  │  │ (extension)  │  │ Tools        │  │ (from useWebMCPTools)    │   │    │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│           ┌────────────────────────┼────────────────────────┐               │
│           ▼                        ▼                        ▼               │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │ Extension Tools │    │   MCP Tools     │    │  WebMCP Tools   │         │
│  │   Storage       │    │   Storage       │    │   Storage       │         │
│  │                 │    │                 │    │                 │         │
│  │ userSettings.   │    │ mcp.{serverId}. │    │ webmcp.tools.   │         │
│  │ enabledTools    │    │ tools.disabled  │    │ disabled        │         │
│  │ Override        │    │                 │    │                 │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│           │                        │                        │               │
│           └────────────────────────┼────────────────────────┘               │
│                                    ▼                                         │
│                    ┌───────────────────────────┐                            │
│                    │   chrome.storage.local    │                            │
│                    └───────────────────────────┘                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```


---

## Tool Sources

### 1. Extension Tools (Built-in)

Native browser automation tools bundled with the extension.

| Category | Tools |
|----------|-------|
| Tabs & Navigation | `navigateTo`, `switchTabs`, `getActiveTab`, `getAllTabs`, `applyTabGroups`, `ungroupTabs`, `organizeTabsByContext` |
| Page Interaction | `typeInField`, `clickByText`, `pressKey`, `focusElement`, `scrollTo`, `findSearchBar`, `executeScript` |
| Page Content | `takeScreenshot`, `readPageContent`, `extractText`, `analyzeDom` |
| Search | `chromeSearch`, `getSearchResults`, `openSearchResult` |
| History | `searchHistory`, `getUrlVisits` |
| Bookmarks | `createBookmark`, `searchBookmarks`, `listBookmarks`, `deleteBookmark`, `updateBookmark`, `getBookmarkTree`, `organizeBookmarks` |
| Reminders | `createReminder`, `listReminders`, `cancelReminder` |
| Utilities | `getYouTubeTranscript` |
| Memory | `addMemory`, `searchMemories` (requires Supermemory) |

**Special Tool Categories:**
- `WORKFLOW_ONLY_TOOLS`: Hidden from UI, auto-enabled during workflows (`generatePDF`, `getReportTemplate`)
- `WEB_SEARCH_ONLY_TOOLS`: Hidden from UI, auto-enabled in web search mode (`webSearch`, `retrieve`, `deepWebSearch`)
- `SUPERMEMORY_TOOLS`: Gated tools requiring Supermemory API configuration (`addMemory`, `searchMemories`)

### 2. MCP Tools (Server-based)

Tools from connected Model Context Protocol servers (e.g., Notion MCP).

```typescript
interface McpToolWithServer extends McpTool {
    serverId: string;    // Unique server identifier
    serverName: string;  // Display name
    name: string;        // Tool name
    description?: string;
    inputSchema: { type: 'object'; properties?: Record<string, unknown>; required?: string[] };
}
```

### 3. WebMCP Tools (Website-based)

Tools discovered from websites implementing WebMCP protocol on the active tab.

```typescript
interface WebMCPTool extends Tool {
    originalName: string;  // Original name from page's MCP server
    name: string;          // Prefixed: webmcp_{domain}_{name}
    domain: string;        // Source domain
    tabId: number;         // Tab where tool exists
    url: string;           // Full page URL
    favicon?: string;      // Website favicon
}
```


---

## Data Flow

### Tool Loading Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         TOOL LOADING FLOW                                 │
└──────────────────────────────────────────────────────────────────────────┘

    Popover Opens
         │
         ▼
    ┌────────────────────────────────────────────────────────────────┐
    │                    useToolsPopover Hook                         │
    │                                                                 │
    │  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────┐   │
    │  │ loadTools() │   │loadMcpTools │   │ refreshWebMCPTools  │   │
    │  │             │   │    ()       │   │ + discoverWebMCP    │   │
    │  └──────┬──────┘   └──────┬──────┘   └──────────┬──────────┘   │
    └─────────┼─────────────────┼──────────────────────┼─────────────┘
              │                 │                      │
              ▼                 ▼                      ▼
    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐
    │ getEnabledTools │ │ chrome.runtime  │ │ chrome.runtime.sendMsg  │
    │ Override()      │ │ .sendMessage    │ │ 'webmcp/tools/list'     │
    │                 │ │ 'mcp/tools/list'│ │ 'webmcp/tools/discover' │
    └────────┬────────┘ └────────┬────────┘ └────────────┬────────────┘
             │                   │                       │
             ▼                   ▼                       ▼
    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐
    │ chrome.storage  │ │ Background      │ │ Content Script          │
    │ .local.get      │ │ MCP Manager     │ │ WebMCP Discovery        │
    │ 'userSettings'  │ │                 │ │                         │
    └─────────────────┘ └─────────────────┘ └─────────────────────────┘
```


---

## State Management

### Primary State Variables

```typescript
// useToolsPopover.ts state
interface ToolsPopoverState {
    // Extension Tools
    enabledMap: Record<string, boolean>;     // Tool name → enabled status
    
    // MCP Tools
    mcpTools: McpToolWithServer[];           // All MCP tools from servers
    mcpDisabledTools: Record<string, string[]>; // serverId → disabled tool names
    mcpLoading: boolean;
    
    // WebMCP Tools (from useWebMCPTools hook)
    webmcpTools: WebMCPTool[];
    webmcpDisabledTools: string[];           // Disabled tool names
    webmcpLoading: boolean;
    
    // UI State
    toolSearchQuery: string;                 // Search filter
    expandedCategories: Record<string, boolean>; // Category expansion state
    currentMode: ToolMode;                   // 'chat' | 'agent' | 'custom'
    hasUserModified: boolean;                // Custom modifications flag
    
    // Feature Flags
    supermemoryConfigured: boolean;          // Supermemory API ready
}
```

### Computed Values

```typescript
// Counts
enabledExtensionCount = Object.values(enabledMap).filter(v => v).length;
enabledMcpCount = mcpTools.filter(t => !mcpDisabledTools[t.serverId]?.includes(t.name)).length;
enabledWebMCPCount = webmcpTools.filter(t => !webmcpDisabledTools.includes(t.name)).length;
totalEnabledCount = enabledExtensionCount + enabledMcpCount + enabledWebMCPCount;
totalToolCount = allTools.length + mcpTools.length + webmcpTools.length;

// Warning threshold
isTooManyTools = totalEnabledCount > TOOL_WARNING_THRESHOLD; // 40 tools
```


---

## Storage Layer

### Storage Keys and Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CHROME.STORAGE.LOCAL SCHEMA                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Extension Tools                                                        │
│  ───────────────                                                        │
│  Key: "userSettings"                                                    │
│  Value: {                                                               │
│      version: 1,                                                        │
│      enabledToolsOverride?: string[],  // List of enabled tool names    │
│      toolsMode?: 'chat' | 'agent' | 'custom',                          │
│      ...otherSettings                                                   │
│  }                                                                      │
│                                                                         │
│  MCP Tools (per server)                                                 │
│  ──────────────────────                                                 │
│  Key: "mcp.{serverId}.tools.disabled"                                   │
│  Value: string[]  // List of disabled tool names for this server        │
│                                                                         │
│  WebMCP Tools                                                           │
│  ────────────                                                           │
│  Key: "webmcp.tools.disabled"                                           │
│  Value: string[]  // List of disabled WebMCP tool names                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Storage Access Patterns

| Tool Source | Storage Pattern | Read Function | Write Function |
|-------------|-----------------|---------------|----------------|
| Extension | Whitelist (enabled tools) | `getEnabledToolsOverride()` | `setEnabledToolsOverride(tools)` |
| MCP | Blacklist (disabled tools) | `getDisabledTools(serverId)` | `setDisabledTools(serverId, tools)` |
| WebMCP | Blacklist (disabled tools) | `chrome.storage.local.get(WEBMCP_DISABLED_TOOLS_KEY)` | `chrome.storage.local.set()` |

**Key Difference:** Extension tools use a whitelist (only enabled tools stored), while MCP/WebMCP use blacklists (only disabled tools stored).


---

## Component Hierarchy

```
ToolsPopover.tsx
│
├── SearchBar.tsx
│   └── Search input with icon
│
├── ModeSelector.tsx
│   ├── Chat mode button
│   ├── Agent mode button
│   └── Custom badge (conditional)
│
├── Content Area
│   │
│   ├── WebMcpSection.tsx (if WebMCP tools exist)
│   │   └── Collapsible category with tools
│   │
│   ├── ToolCategory.tsx (for each extension category)
│   │   ├── Category header with toggle
│   │   ├── Tool list with individual toggles
│   │   └── SupermemoryGatedIcon.tsx (for gated tools)
│   │
│   └── McpCategory.tsx (for each MCP server)
│       ├── Server header with toggle
│       └── Tool list with individual toggles
│
└── Footer.tsx
    ├── Enabled count display
    ├── Warning indicator (if too many tools)
    └── Info tooltip
```

### Component Props Flow

```typescript
// ToolsPopover → ToolCategory
interface ToolCategoryProps {
    category: string;
    tools: string[];
    enabledMap: Record<string, boolean>;
    isExpanded: boolean;
    supermemoryConfigured: boolean;
    showSupermemoryTooltip: string | null;
    onToggleCategory: (category: string) => void;
    onToggleTool: (tool: string, checked: boolean) => void;
    onToggleCategoryAll: (e: React.MouseEvent, category: string, tools: string[]) => void;
    onSetSupermemoryTooltip: (tool: string | null) => void;
}

// ToolsPopover → McpCategory
interface McpCategoryProps {
    serverId: string;
    serverName: string;
    tools: McpToolWithServer[];
    disabledTools: string[];
    isExpanded: boolean;
    onToggleCategory: (category: string) => void;
    onToggleTool: (serverId: string, toolName: string, checked: boolean) => void;
    onToggleCategoryAll: (e: React.MouseEvent, serverId: string, tools: McpToolWithServer[]) => void;
}

// ToolsPopover → WebMcpSection
interface WebMcpSectionProps {
    tools: WebMcpTool[];
    disabledTools: string[];
    isLoading: boolean;
    enabledCount: number;
    isExpanded: boolean;
    onToggleCategory: (category: string) => void;
    onToggleTool: (toolName: string, checked: boolean) => void;
    onToggleCategoryAll: (e: React.MouseEvent) => void;
}
```


---

## Mode System

The Tool Popover supports three modes that control which tools are enabled by default.

### Mode Definitions

```typescript
type ToolsMode = 'chat' | 'agent' | 'custom';
```

| Mode | Description | Tool Count |
|------|-------------|------------|
| **Chat** | Minimal tools for reading and Q&A | ~7 tools |
| **Agent** | Full browser automation capabilities | ~40 tools |
| **Custom** | User has manually modified tool selection | Variable |

### Chat Mode Tools

```typescript
const CHAT_MODE_TOOLS = [
    'readPageContent',
    'takeScreenshot',
    'getActiveTab',
    'getAllTabs',
    'switchTabs',
    'searchHistory',
    'getYouTubeTranscript',
];
```

### Agent Mode Tools

```typescript
const AGENT_MODE_TOOLS = [
    // Navigation & Tab Management
    'navigateTo', 'switchTabs', 'getActiveTab', 'getAllTabs',
    'applyTabGroups', 'ungroupTabs', 'organizeTabsByContext',
    // Content Reading & Extraction
    'takeScreenshot', 'readPageContent', 'extractText',
    'findSearchBar', 'analyzeDom',
    // Interaction Tools
    'typeInField', 'clickByText', 'pressKey', 'focusElement',
    'scrollTo', 'executeScript',
    // Search Functionality
    'chromeSearch', 'getSearchResults', 'openSearchResult',
    // History
    'searchHistory', 'getUrlVisits',
    // Reminders
    'createReminder', 'listReminders', 'cancelReminder',
    // Agent Tools
    'getYouTubeTranscript',
];
```

### Mode Detection Algorithm

```typescript
function getToolsMatchingMode(toolMap: Record<string, boolean>): ToolMode | null {
    const enabledList = Object.entries(toolMap)
        .filter(([, v]) => v)
        .map(([k]) => k);
    
    // Check if matches Chat mode exactly
    const chatSet = new Set(CHAT_MODE_TOOLS);
    const isChatMode = enabledList.length === CHAT_MODE_TOOLS.length &&
        enabledList.every(t => chatSet.has(t));
    if (isChatMode) return 'chat';

    // Check if matches Agent mode exactly
    const agentSet = new Set(AGENT_MODE_TOOLS);
    const isAgentMode = enabledList.length === AGENT_MODE_TOOLS.length &&
        enabledList.every(t => agentSet.has(t));
    if (isAgentMode) return 'agent';

    // Neither matches → custom
    return null;
}
```


---

## Filtering System

### Search Filtering

Tools are filtered based on the search query across all three sources:

```typescript
// Extension tools filtering
const filteredTools = useMemo(() => {
    if (!toolSearchQuery) return allTools;
    return allTools.filter(t => 
        t.toLowerCase().includes(toolSearchQuery.toLowerCase())
    );
}, [allTools, toolSearchQuery]);

// MCP tools filtering
const filteredMcpTools = useMemo(() => {
    if (!toolSearchQuery) return mcpTools;
    return mcpTools.filter(t => 
        t.name.toLowerCase().includes(toolSearchQuery.toLowerCase())
    );
}, [mcpTools, toolSearchQuery]);

// WebMCP tools filtering (searches name, originalName, and description)
const filteredWebMCPTools = useMemo(() => {
    if (!toolSearchQuery) return webmcpTools;
    const query = toolSearchQuery.toLowerCase();
    return webmcpTools.filter(t =>
        t.originalName.toLowerCase().includes(query) ||
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
    );
}, [webmcpTools, toolSearchQuery]);
```

### Category Grouping

Extension tools are grouped by category using `TOOL_CATEGORIES`:

```typescript
const groupedTools = useMemo(() => {
    const groups: Record<string, string[]> = {};
    filteredTools.forEach(tool => {
        let category = 'Other';
        for (const [cat, tools] of Object.entries(TOOL_CATEGORIES)) {
            if (tools.includes(tool)) {
                category = cat;
                break;
            }
        }
        if (!groups[category]) groups[category] = [];
        groups[category].push(tool);
    });
    return groups;
}, [filteredTools]);
```

### MCP Server Grouping

MCP tools are grouped by server:

```typescript
const mcpServerGroups = useMemo(() => {
    const groups: Record<string, { name: string; tools: McpToolWithServer[] }> = {};
    filteredMcpTools.forEach(tool => {
        if (!groups[tool.serverId]) {
            groups[tool.serverId] = { name: tool.serverName, tools: [] };
        }
        groups[tool.serverId].tools.push(tool);
    });
    return groups;
}, [filteredMcpTools]);
```

### Auto-Expand on Search

When searching, all categories auto-expand to show results:

```typescript
useEffect(() => {
    if (toolSearchQuery) {
        const newExpanded: Record<string, boolean> = {};
        Object.keys(groupedTools).forEach(category => {
            newExpanded[category] = true;
        });
        setExpandedCategories(newExpanded);
    }
}, [toolSearchQuery, groupedTools]);
```


---

## Sequence Diagrams

### 1. Tool Toggle Sequence (Extension Tool)

```
┌──────┐          ┌─────────────────┐          ┌─────────────────┐          ┌─────────────┐
│ User │          │ ToolCategory    │          │ useToolsPopover │          │ Storage     │
└──┬───┘          └────────┬────────┘          └────────┬────────┘          └──────┬──────┘
   │                       │                            │                          │
   │ Click toggle          │                            │                          │
   │──────────────────────>│                            │                          │
   │                       │                            │                          │
   │                       │ onToggleTool(tool, checked)│                          │
   │                       │───────────────────────────>│                          │
   │                       │                            │                          │
   │                       │                            │ Check Supermemory gate   │
   │                       │                            │─────────┐                │
   │                       │                            │<────────┘                │
   │                       │                            │                          │
   │                       │                            │ Update enabledMap        │
   │                       │                            │─────────┐                │
   │                       │                            │<────────┘                │
   │                       │                            │                          │
   │                       │                            │ Detect mode change       │
   │                       │                            │─────────┐                │
   │                       │                            │<────────┘                │
   │                       │                            │                          │
   │                       │                            │ setEnabledToolsOverride()│
   │                       │                            │─────────────────────────>│
   │                       │                            │                          │
   │                       │                            │ setToolsMode()           │
   │                       │                            │─────────────────────────>│
   │                       │                            │                          │
   │                       │                            │<─────────────────────────│
   │                       │<───────────────────────────│                          │
   │<──────────────────────│                            │                          │
   │                       │                            │                          │
```

### 2. MCP Tool Toggle Sequence

```
┌──────┐          ┌─────────────┐          ┌─────────────────┐          ┌────────────┐
│ User │          │ McpCategory │          │ useToolsPopover │          │ Background │
└──┬───┘          └──────┬──────┘          └────────┬────────┘          └─────┬──────┘
   │                     │                          │                         │
   │ Click toggle        │                          │                         │
   │────────────────────>│                          │                         │
   │                     │                          │                         │
   │                     │ onToggleTool(serverId,   │                         │
   │                     │   toolName, checked)     │                         │
   │                     │─────────────────────────>│                         │
   │                     │                          │                         │
   │                     │                          │ Update mcpDisabledTools │
   │                     │                          │─────────┐               │
   │                     │                          │<────────┘               │
   │                     │                          │                         │
   │                     │                          │ chrome.runtime.sendMsg  │
   │                     │                          │ 'mcp/{serverId}/tools/  │
   │                     │                          │  config/set'            │
   │                     │                          │────────────────────────>│
   │                     │                          │                         │
   │                     │                          │                         │ Store in
   │                     │                          │                         │ chrome.storage
   │                     │                          │                         │─────┐
   │                     │                          │                         │<────┘
   │                     │                          │                         │
   │                     │                          │<────────────────────────│
   │                     │<─────────────────────────│                         │
   │<────────────────────│                          │                         │
   │                     │                          │                         │
```


### 3. WebMCP Discovery Sequence

```
┌──────┐     ┌─────────────────┐     ┌────────────┐     ┌───────────────┐     ┌─────────┐
│ User │     │ useToolsPopover │     │ Background │     │ Content Script│     │ Website │
└──┬───┘     └────────┬────────┘     └─────┬──────┘     └───────┬───────┘     └────┬────┘
   │                  │                    │                    │                  │
   │ Open Popover     │                    │                    │                  │
   │─────────────────>│                    │                    │                  │
   │                  │                    │                    │                  │
   │                  │ refreshWebMCPTools │                    │                  │
   │                  │───────────────────>│                    │                  │
   │                  │                    │                    │                  │
   │                  │ discoverWebMCPTools│                    │                  │
   │                  │───────────────────>│                    │                  │
   │                  │                    │                    │                  │
   │                  │                    │ Inject discovery   │                  │
   │                  │                    │───────────────────>│                  │
   │                  │                    │                    │                  │
   │                  │                    │                    │ Check for        │
   │                  │                    │                    │ WebMCP endpoint  │
   │                  │                    │                    │─────────────────>│
   │                  │                    │                    │                  │
   │                  │                    │                    │<─────────────────│
   │                  │                    │                    │ Tools list       │
   │                  │                    │                    │                  │
   │                  │                    │<───────────────────│                  │
   │                  │                    │ webmcp/tools/      │                  │
   │                  │                    │ register           │                  │
   │                  │                    │                    │                  │
   │                  │<───────────────────│                    │                  │
   │                  │ webmcp/tools/      │                    │                  │
   │                  │ updated            │                    │                  │
   │                  │                    │                    │                  │
   │<─────────────────│                    │                    │                  │
   │ UI Updated       │                    │                    │                  │
   │                  │                    │                    │                  │
```

### 4. Mode Change Sequence

```
┌──────┐          ┌──────────────┐          ┌─────────────────┐          ┌─────────────┐
│ User │          │ ModeSelector │          │ useToolsPopover │          │ Storage     │
└──┬───┘          └──────┬───────┘          └────────┬────────┘          └──────┬──────┘
   │                     │                           │                          │
   │ Click "Chat" mode   │                           │                          │
   │────────────────────>│                           │                          │
   │                     │                           │                          │
   │                     │ onModeChange('chat')      │                          │
   │                     │──────────────────────────>│                          │
   │                     │                           │                          │
   │                     │                           │ Get CHAT_MODE_TOOLS      │
   │                     │                           │─────────┐                │
   │                     │                           │<────────┘                │
   │                     │                           │                          │
   │                     │                           │ Filter Supermemory tools │
   │                     │                           │ (if not configured)      │
   │                     │                           │─────────┐                │
   │                     │                           │<────────┘                │
   │                     │                           │                          │
   │                     │                           │ Build new enabledMap     │
   │                     │                           │─────────┐                │
   │                     │                           │<────────┘                │
   │                     │                           │                          │
   │                     │                           │ setEnabledToolsOverride()│
   │                     │                           │─────────────────────────>│
   │                     │                           │                          │
   │                     │                           │ setToolsMode('chat')     │
   │                     │                           │─────────────────────────>│
   │                     │                           │                          │
   │                     │                           │<─────────────────────────│
   │                     │<──────────────────────────│                          │
   │<────────────────────│                           │                          │
   │ UI shows Chat mode  │                           │                          │
   │                     │                           │                          │
```


---

## Gated Tools (Supermemory)

Some tools require external service configuration before they can be enabled.

### Supermemory Tools

```typescript
const SUPERMEMORY_TOOLS = ['addMemory', 'searchMemories'];
```

### Gating Logic

```typescript
const handleToggleTool = async (tool: string, checked: boolean) => {
    // Block enabling Supermemory tools if not configured
    if (checked && SUPERMEMORY_TOOLS.includes(tool) && !supermemoryConfigured) {
        setShowSupermemoryTooltip(tool);
        return; // Prevent toggle
    }
    // ... proceed with toggle
};
```

### Category Toggle with Gating

```typescript
const handleToggleCategory = async (e: React.MouseEvent, _category: string, tools: string[]) => {
    const allEnabled = tools.every(t => enabledMap[t] === true);
    const newState = !allEnabled;

    // Filter out Supermemory tools if enabling and not configured
    const toolsToUpdate = newState && !supermemoryConfigured
        ? tools.filter(t => !SUPERMEMORY_TOOLS.includes(t))
        : tools;

    if (toolsToUpdate.length === 0) {
        setShowSupermemoryTooltip(tools[0] || null);
        return;
    }
    // ... proceed with toggle
};
```

---

## Warning System

### Tool Count Warning

When too many tools are enabled, performance may degrade. The system warns users:

```typescript
const TOOL_WARNING_THRESHOLD = 40;
const isTooManyTools = totalEnabledCount > TOOL_WARNING_THRESHOLD;
```

### Warning Display

The Footer component shows a warning state:

```tsx
<div className={`tools-popover-footer ${isTooManyTools ? 'tools-popover-footer--warning' : ''}`}>
    {isTooManyTools && (
        <>
            <AlertTriangle size={12} className="tools-popover-warning-icon" />
            <span className="tools-popover-warning-text">Too many tools</span>
        </>
    )}
</div>
```


---

## File Structure

```
src/components/features/chat/components/modals/ToolPopover/
├── index.ts                    # Barrel export
├── ToolsPopover.tsx            # Main component
├── useToolsPopover.ts          # Primary hook with all state logic
├── types.ts                    # TypeScript interfaces
├── constants.ts                # Mode definitions, thresholds
└── components/
    ├── SearchBar.tsx           # Search input
    ├── ModeSelector.tsx        # Chat/Agent mode buttons
    ├── ToolCategory.tsx        # Extension tool category
    ├── McpCategory.tsx         # MCP server category
    ├── WebMcpSection.tsx       # WebMCP tools section
    ├── Footer.tsx              # Count display and warnings
    └── SupermemoryGatedIcon.tsx # Gated tool indicator

Related Files:
├── src/constants/toolDescriptions.ts    # Tool categories and descriptions
├── src/ai/tools/enabledTools.ts         # Default enabled tools list
├── src/types/settings.ts                # UserSettings interface
├── src/utils/settings/settingsStorage.ts # Storage helpers
├── src/mcp/toolsConfig.ts               # MCP tool config storage
├── src/hooks/webmcp/useWebMCPTools.ts   # WebMCP hook
├── src/types/webmcp.ts                  # WebMCP types
└── src/styles/features/copilot/tools-modal.css # Styles
```

---

## Key Implementation Details

### 1. Load-Once Pattern

Tools are loaded only once when the popover opens to prevent re-triggering on dependency changes:

```typescript
const hasLoadedToolsRef = useRef(false);

useEffect(() => {
    if (isOpen && !hasLoadedToolsRef.current) {
        hasLoadedToolsRef.current = true;
        loadTools();
        checkSupermemory();
        loadMcpTools();
    }
    
    if (!isOpen) {
        hasLoadedToolsRef.current = false; // Reset on close
    }
}, [isOpen]);
```

### 2. Domain-Based WebMCP Caching

WebMCP discovery is cached per domain to avoid redundant discovery:

```typescript
const lastDiscoveredDomainRef = useRef<string | null>(null);

const checkAndDiscoverWebMCP = async () => {
    const currentTabDomain = new URL(activeTab.url).hostname;
    
    // Skip if already discovered for this domain
    if (lastDiscoveredDomainRef.current === currentTabDomain) {
        return;
    }
    
    lastDiscoveredDomainRef.current = currentTabDomain;
    await discoverWebMCPTools();
};
```

### 3. Click Outside Handling

The popover closes when clicking outside, with a timeout to prevent immediate closure:

```typescript
useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
        if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
            onClose();
        }
    };

    // Delay listener attachment to prevent immediate closure
    const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
    };
}, [isOpen, onClose]);
```

### 4. Storage Change Listeners

The system listens for storage changes to keep UI in sync:

```typescript
// In useWebMCPTools.ts
useEffect(() => {
    const handleStorageChange = (
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: string
    ) => {
        if (areaName === 'local' && changes[WEBMCP_DISABLED_TOOLS_KEY]) {
            const newValue = changes[WEBMCP_DISABLED_TOOLS_KEY].newValue;
            if (Array.isArray(newValue)) {
                setDisabledTools(newValue);
            }
        }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
}, []);
```

