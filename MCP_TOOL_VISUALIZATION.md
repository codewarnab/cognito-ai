# MCP Tool Call Visualization Implementation

## Overview
Implemented MCP (Model Context Protocol) tool call visualization similar to CopilotKit's documentation, showing real-time execution status, arguments, and results of MCP server tools.

## Components Created

### 1. **McpToolCall.tsx** (`src/components/McpToolCall.tsx`)
- Displays individual MCP tool calls with:
  - **Tool icons** (Notion, Figma, GitHub, Linear, Supabase)
  - **Status indicators** (executing, complete, failed) with color coding
  - **Loading spinner** for executing tools
  - **Collapsible Arguments section** showing input parameters
  - **Collapsible Result section** showing tool output
  - **Error display** for failed executions

### 2. **ToolRenderer.tsx** (`src/components/ToolRenderer.tsx`)
- Registers a catch-all action handler using `useCopilotAction({ name: "*" })`
- Intercepts all MCP tool calls from any connected MCP server
- Maps CopilotKit status to component status
- Renders each tool call using McpToolCall component

### 3. **mcp-tools.css** (`src/styles/mcp-tools.css`)
- Complete styling for MCP tool visualization
- Responsive design with dark theme
- Status badges with color coding
- Loading animations
- Collapsible sections
- Syntax-highlighted code blocks
- Custom scrollbars

## Icon Assets Used
Located in `/assets/` folder:
- ✅ **notion.tsx** - Notion logo
- ✅ **figma.tsx** - Figma logo
- ✅ **github.tsx** - GitHub logo
- ✅ **linear.tsx** - Linear logo
- ✅ **supabase.tsx** - Supabase logo

## Integration

### Updated `sidepanel.tsx`:
```tsx
import { ToolRenderer } from "./components/ToolRenderer";
import "./styles/mcp-tools.css";

function CopilotChatContent() {
  return (
    <>
      <McpServerManager />
      <ToolRenderer />  {/* NEW: Catches all MCP tool calls */}
      <CopilotChatWindow {...props} />
    </>
  );
}
```

## Features

### Status Indicators
- 🔵 **Executing** - Blue badge with loading spinner
- ✅ **Complete** - Green badge with checkmark
- ❌ **Failed** - Red badge with error message

### Collapsible Sections
- **Arguments**: Shows input parameters (opens by default when executing)
- **Result**: Shows tool output (opens by default when complete)
- **Error**: Shows error details for failed executions

### Smart Icon Matching
Automatically detects tool type from name:
- `notion_search` → Notion icon
- `github_create_issue` → GitHub icon
- `figma_get_file` → Figma icon
- Generic tools show no icon

### JSON Formatting
- Pretty-printed JSON for arguments and results
- Syntax highlighting
- Scrollable content with max height
- Word wrapping for long strings

## How It Works

1. **MCP Server connects** via `McpServerManager` using `setMcpServers()`
2. **User asks AI** to perform a task requiring MCP tools
3. **AI invokes tool** from connected MCP server (e.g., Notion)
4. **ToolRenderer catches** the tool call via `useCopilotAction({ name: "*" })`
5. **McpToolCall renders** the tool UI with status, args, and results
6. **Real-time updates** as tool progresses through executing → complete/failed

## Example Usage

When a user asks: "Search my Notion for project ideas"

The visualization will show:
```
[Notion Icon] notion_search                    [🔵 Running...]

Arguments ▼
{
  "query": "project ideas",
  "limit": 10
}

Result ▼
{
  "results": [
    { "title": "AI Chrome Extension", ... },
    { "title": "MCP Integration", ... }
  ]
}
```

## Styling Guidelines

All styles follow the dark theme of the extension:
- Background: `rgba(255, 255, 255, 0.05)`
- Borders: `rgba(255, 255, 255, 0.1)`
- Text: `rgba(255, 255, 255, 0.9)`
- Code blocks: `rgba(0, 0, 0, 0.3)`

## Future Enhancements

Potential improvements:
- [ ] Add more MCP server icons
- [ ] Syntax highlighting for code in results
- [ ] Copy button for results
- [ ] Execution time display
- [ ] Tool call history/timeline
- [ ] Retry failed actions
- [ ] Download results as JSON

## Testing

To test the implementation:
1. Ensure Notion MCP server is connected (authenticate via MCP Manager)
2. Ask the AI: "Search my Notion workspace for [query]"
3. Watch the tool call visualization appear in real-time
4. Check status transitions: executing → complete
5. Expand/collapse arguments and results sections

## Documentation Reference

Based on official CopilotKit docs:
https://docs.copilotkit.ai/connect-mcp-servers?cli=do-it-manually

Section: "Visualize MCP Tool Calls (Optional)"
