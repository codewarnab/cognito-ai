# WebMCP (Web-based Model Context Protocol) Module

**WebMCP** stands for **Web-based Model Context Protocol** — an extension of MCP that enables discovering and executing tools directly from websites that implement the WebMCP standard.

## What is WebMCP?

WebMCP allows websites to expose tools that AI assistants can discover and execute. Unlike traditional MCP servers that run as separate services, WebMCP tools are embedded in web pages and executed in the browser context.

### Key Differences from MCP

| Aspect | MCP (Server-based) | WebMCP (Browser-based) |
|--------|-------------------|----------------------|
| **Where** | Remote server | Active browser tab |
| **Discovery** | Via SSE connection | Via content script |
| **Execution** | Server-side | Client-side (in webpage) |
| **Scope** | Always available | Only on active tab |
| **Auth** | OAuth 2.0 | Uses existing webpage session |

## How It Works

1. **Content Script Injection**: The `webmcp-proxy.content.ts` script is injected into web pages
2. **Tool Discovery**: When a page has WebMCP tools, they're detected and reported to the background
3. **Tool Registration**: The WebMCP Manager tracks tools from the active tab only
4. **Tool Execution**: When the AI requests a WebMCP tool, the request is routed to the content script

## Module Structure

```
src/background/webmcp/
├── README.md           # This file
├── index.ts            # Barrel exports
└── manager.ts          # WebMCP state management and tool execution

Related files:
├── src/entrypoints/webmcp-proxy.content.ts  # Content script for pages
├── src/types/webmcp.ts                       # Type definitions
├── src/ai/tools/webmcpTools.ts               # AI tool definitions
├── src/ai/backend/webmcpIntegration.ts       # Backend mode integration
├── src/background/messaging/webmcpHandler.ts # Message handler
└── src/hooks/webmcp/useWebMCPTools.ts        # React hook for UI
```

## Key Functions

### `manager.ts`

| Function | Description |
|----------|-------------|
| `initializeWebMCPManager()` | Set up Chrome tab listeners |
| `registerWebMCPTools(tabId, domain, tools)` | Register tools from a page |
| `executeWebMCPTool(toolName, args)` | Execute a tool on active tab |
| `getActiveTabWebMCPTools()` | Get current tab's tools |
| `setActiveTab(tabId)` | Switch active tab and discover tools |
| `clearWebMCPTools()` | Clear tools on tab switch/close |
| `onToolsUpdate(callback)` | Subscribe to tool changes |

## Tool Naming Convention

WebMCP tools are prefixed to avoid conflicts:

```
webmcp_{domain}_{toolName}
```

Example: A tool called `search` on `example.com` becomes:
```
webmcp_example_com_search
```

## Usage

### Getting Available Tools

```typescript
import { getActiveTabWebMCPTools } from '@/background/webmcp';

const tools = getActiveTabWebMCPTools();
// Returns: WebMCPTool[]
```

### Executing a Tool

```typescript
import { executeWebMCPTool } from '@/background/webmcp';

const result = await executeWebMCPTool('webmcp_example_com_search', {
  query: 'search term',
});
```

### Subscribing to Updates

```typescript
import { onToolsUpdate } from '@/background/webmcp';

const unsubscribe = onToolsUpdate((tools) => {
  console.log('Tools updated:', tools);
});

// Later: unsubscribe();
```

## Active Tab Only Design

Unlike some WebMCP implementations that track all tabs, Cognito's WebMCP module intentionally tracks **only the active tab**. This design choice:

- **Reduces memory usage** - No need to store tools from all tabs
- **Simplifies state** - Clear mental model for users
- **Avoids stale data** - Tools are always fresh from current page
- **Improves security** - Only interacts with the tab user is viewing

## Content Script Messages

| Message Type | Direction | Purpose |
|-------------|-----------|---------|
| `webmcp/tools/refresh` | Background → Content | Request tool discovery |
| `webmcp/tools/register` | Content → Background | Register discovered tools |
| `webmcp/tool/execute` | Background → Content | Execute a tool |
| `webmcp/tools/updated` | Background → UI | Notify UI of changes |

## See Also

- [MCP Module](../../mcp/README.md) - Server-based MCP implementation
- [WebMCP Types](../../types/webmcp.ts) - Type definitions
- [WebMCP Proxy Content Script](../../entrypoints/webmcp-proxy.content.ts) - Content script
