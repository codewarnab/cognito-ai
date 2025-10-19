<!-- 0f07ad7e-616e-4459-a5e8-d2ede5ba6259 324ecaa4-68b5-4839-bb59-fd59eef58e16 -->
# MCP Tool Management Implementation

## Overview

Enable users to selectively enable/disable individual tools from MCP servers. This gives granular control over which tools the AI can access from each server.

## Architecture Changes

### 1. Storage Layer (chrome.storage.local)

**Pattern**: `mcp.{serverId}.tools.disabled` → `string[]` (array of disabled tool names)

- Store only disabled tools (default: all enabled)
- Example: `mcp.context7.tools.disabled = ["resolve-library-id"]`

### 2. Type Definitions (`src/mcp/types.ts`)

Add new interfaces:

```typescript
export interface McpToolConfig {
    serverId: string;
    disabledTools: string[]; // Tool names that are disabled
}
```

### 3. Background Script (`src/background.ts`)

Add new message handlers in the switch statement (~line 1151):

- `tools/list` - Get available tools for a server (requires server to be connected)
- `tools/disable` - Disable specific tools (payload: `{toolNames: string[]}`)
- `tools/enable` - Enable specific tools (payload: `{toolNames: string[]}`)
- `tools/config/get` - Get disabled tools list for a server
- `tools/config/set` - Set disabled tools list (payload: `{disabledTools: string[]}`)

Add helper functions:

```typescript
async function getDisabledTools(serverId: string): Promise<string[]>
async function setDisabledTools(serverId: string, toolNames: string[]): Promise<void>
async function getServerTools(serverId: string): Promise<McpTool[]>
```

### 4. MCP Client Filtering (`src/ai/mcpClient.ts`)

Modify `initializeMCPClients` function (~line 248):

- After getting tools from server: `const mcpTools = await mcpClient.tools()`
- Fetch disabled tools from storage: `const disabledTools = await getDisabledTools(serverId)`
- Filter out disabled tools before adding to tools object:
```typescript
const filteredTools = Object.entries(mcpTools).reduce((acc, [name, def]) => {
    if (!disabledTools.includes(name)) {
        acc[name] = def;
    }
    return acc;
}, {});
tools = { ...tools, ...filteredTools };
```


### 5. UI Components

#### A. McpServerCard Component (`src/components/McpServerCard.tsx`)

Add "Manage Tools" button next to existing buttons (~line 360):

- When expanded (`!isNarrowView`): Show button with text "Manage Tools"
- When narrow (`isNarrowView`): Show icon button (settings/sliders icon from lucide-react)
- Only visible when `isEnabled && isAuthenticated`
- On click: Call `onManageTools(id)` callback

Update interface to add:

```typescript
interface McpServerCardProps {
    // ... existing props
    onManageTools?: (serverId: string) => void;
}
```

#### B. McpManager Component (`src/components/McpManager.tsx`)

Add state for nested view:

```typescript
const [activeView, setActiveView] = useState<'list' | 'tools'>('list')
const [selectedServerId, setSelectedServerId] = useState<string | null>(null)
```

Implement conditional rendering:

- When `activeView === 'list'`: Show current server list
- When `activeView === 'tools'`: Render `McpToolsManager` component

Add handler:

```typescript
const handleManageTools = (serverId: string) => {
    setSelectedServerId(serverId)
    setActiveView('tools')
}
```

#### C. New Component: McpToolsManager (`src/components/McpToolsManager.tsx`)

Create new component for tool management:

**Header Section**:

- Back button (arrow left icon)
- Server icon and name from config
- Title: "Manage Tools"

**Tools List Section**:

- Fetch tools on mount: `chrome.runtime.sendMessage({type: 'mcp/{serverId}/tools/list'})`
- Fetch disabled config: `chrome.runtime.sendMessage({type: 'mcp/{serverId}/tools/config/get'})`
- Show loading state while fetching
- Display each tool as a card/row with:
  - Checkbox (checked = enabled, unchecked = disabled)
  - Tool name (bold)
  - Tool description (truncated with "read more" if too long)
- Handle checkbox changes:
  - Update local state immediately for responsiveness
  - Debounce save to storage (500ms)
  - Send update: `chrome.runtime.sendMessage({type: 'mcp/{serverId}/tools/config/set', payload: {disabledTools}})`

**Empty State**:

- If no tools available: Show message "No tools available from this server"

### 6. Styling (`src/styles/mcp.css`)

Add styles for:

- `.mcp-tools-panel` - Container for tools management view
- `.mcp-tools-header` - Header with back button and server info
- `.mcp-tools-list` - List container for tools
- `.mcp-tool-item` - Individual tool row/card
- `.mcp-tool-checkbox` - Styled checkbox
- `.mcp-tool-info` - Tool name and description container

### 7. McpManager Props Update (`src/components/McpManager.tsx`)

Pass `onManageTools` handler to each McpServerCard:

```typescript
<McpServerCard
    // ... existing props
    onManageTools={handleManageTools}
/>
```

## Implementation Flow

1. User clicks "Manage Tools" button on an enabled server
2. McpManager switches to tools view, renders McpToolsManager
3. McpToolsManager fetches available tools and disabled config
4. User toggles tool checkboxes
5. Changes are debounced and saved to chrome.storage
6. When AI is invoked, mcpClient.ts filters tools based on disabled list
7. Only enabled tools are available to the AI

## Error Handling

- If server is not connected: Show error "Please connect and enable the server first"
- If tools fetch fails: Show retry button
- If save fails: Show error toast and revert UI state

## Edge Cases

- Server disconnects while on tools page: Show notice, allow user to go back
- Tools list changes after user configured: New tools default to enabled
- User disables all tools: Allow but show warning "At least one tool should be enabled for this server to be useful"

### To-dos

- [ ] Add helper functions in background.ts for getting/setting disabled tools in chrome.storage
- [ ] Add message handlers in background.ts for tools/list, tools/config/get, tools/config/set
- [ ] Modify mcpClient.ts initializeMCPClients to filter out disabled tools before registering
- [ ] Add 'Manage Tools' button to McpServerCard (responsive: button text when expanded, icon when narrow)
- [ ] Add view state management to McpManager for list vs tools view
- [ ] Create McpToolsManager component with header, tools list, and checkbox controls
- [ ] Add CSS styles for tools management panel and components
- [ ] Add McpToolConfig interface to mcp/types.ts