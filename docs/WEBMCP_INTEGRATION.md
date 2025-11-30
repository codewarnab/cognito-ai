# WebMCP Integration System Documentation

This document provides a comprehensive overview of the WebMCP (Browser-based MCP) integration system, which enables the Chrome extension to discover and execute tools exposed by websites implementing the Model Context Protocol.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Component Breakdown](#component-breakdown)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Sequence Diagrams](#sequence-diagrams)
6. [Message Types](#message-types)
7. [State Management](#state-management)

---

## Overview

WebMCP allows websites to expose tools that can be discovered and executed by the Chrome extension. Unlike traditional MCP servers that run on remote endpoints, WebMCP tools are discovered directly from the active browser tab and executed within the page context.

### Key Features

- **Dynamic Tool Discovery**: Automatically discovers MCP tools when navigating to WebMCP-enabled websites
- **Active Tab Focus**: Only tracks tools from the currently active tab (not all tabs)
- **Real-time Updates**: Tools are refreshed on tab switches, navigation, and page reloads
- **AI Integration**: Discovered tools are seamlessly integrated with the AI chat system
- **User Control**: Tools can be individually enabled/disabled via the UI

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CHROME EXTENSION                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐    │
│  │   Side Panel    │    │   Background     │    │   Content Script    │    │
│  │   (React UI)    │    │   Service Worker │    │   (webmcp-proxy)    │    │
│  ├─────────────────┤    ├──────────────────┤    ├─────────────────────┤    │
│  │                 │    │                  │    │                     │    │
│  │ useWebMCPTools  │◄──►│  WebMCP Manager  │◄──►│  TabClientTransport │    │
│  │     Hook        │    │                  │    │                     │    │
│  │                 │    │  Message Router  │    │  MCP SDK Client     │    │
│  │ ToolsPopover    │    │                  │    │                     │    │
│  │   Component     │    │  WebMCP Handler  │    │                     │    │
│  │                 │    │                  │    │                     │    │
│  └────────┬────────┘    └────────┬─────────┘    └──────────┬──────────┘    │
│           │                      │                         │               │
│           │  chrome.runtime      │   chrome.tabs           │               │
│           │  .sendMessage()      │   .sendMessage()        │               │
│           └──────────────────────┴─────────────────────────┘               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ postMessage (TabClientTransport)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WEBSITE WITH WEBMCP                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      WebMCP Server (Page Script)                     │   │
│  │                                                                      │   │
│  │   - Exposes tools via MCP protocol                                  │   │
│  │   - Handles tool execution requests                                 │   │
│  │   - Sends tool list change notifications                            │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Content Script: `webmcp-proxy.ts`

**Location**: `src/contents/webmcp-proxy.ts`

**Purpose**: Bridge between the page's WebMCP server and the extension's background service.

**Responsibilities**:
- Connects to page's WebMCP server via `TabClientTransport`
- Discovers available tools using MCP SDK Client
- Reports tools to background service worker
- Executes tool calls forwarded from background
- Handles tool list change notifications

**Key Functions**:
```typescript
attemptConnection()     // Connect to page's WebMCP server
fetchAndReportTools()   // Discover and send tools to background
executeTool()           // Execute tool call from background
```

### 2. Background Service: WebMCP Manager

**Location**: `src/background/webmcp/manager.ts`

**Purpose**: Central state management for WebMCP tools.

**Responsibilities**:
- Maintains in-memory state of active tab's tools
- Tracks active tab changes
- Routes tool execution requests to content script
- Broadcasts tool updates to UI components

**Key Functions**:
```typescript
initializeWebMCPManager()    // Setup Chrome event listeners
registerWebMCPTools()        // Store tools from content script
executeWebMCPTool()          // Forward execution to content script
setActiveTab()               // Handle tab switches
clearWebMCPTools()           // Clear tools on navigation/close
```

### 3. Message Handler: `webmcpHandler.ts`

**Location**: `src/background/messaging/webmcpHandler.ts`

**Purpose**: Routes WebMCP-related messages to appropriate handlers.

**Handled Message Types**:
- `webmcp/tools/register` - Register tools from content script
- `webmcp/tools/list` - Get current tools list
- `webmcp/tools/state` - Get full WebMCP state
- `webmcp/tools/discover` - Trigger tool discovery
- `webmcp/tool/call` - Execute a tool

### 4. React Hook: `useWebMCPTools`

**Location**: `src/hooks/webmcp/useWebMCPTools.ts`

**Purpose**: Provides WebMCP tools state to React components.

**Features**:
- Real-time tool updates via message listener
- Tool enable/disable persistence
- Loading and error states
- Manual refresh and discovery triggers

**Return Values**:
```typescript
{
  tools: WebMCPTool[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  discover: () => Promise<void>;
  disabledTools: string[];
  toggleTool: (name: string, enabled: boolean) => Promise<void>;
  enabledCount: number;
  currentDomain: string | null;
}
```

### 5. AI Integration: `webmcpTools.ts`

**Location**: `src/ai/tools/webmcpTools.ts`

**Purpose**: Converts WebMCP tools to AI SDK format.

**Key Functions**:
```typescript
convertWebMCPToolsToAITools()    // Convert to AI SDK format
getWebMCPToolsFromBackground()   // Fetch and convert tools
```

### 6. UI Component: `WebMcpSection.tsx`

**Location**: `src/components/features/chat/components/modals/ToolPopover/components/WebMcpSection.tsx`

**Purpose**: Displays WebMCP tools in the tools popover.

**Features**:
- Shows tools grouped by active tab
- Individual tool enable/disable toggles
- Loading state during discovery
- Favicon display for visual identification

---

## Data Flow Diagrams

### Tool Discovery Flow

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Website    │     │ Content Script  │     │   Background     │     │  Side Panel │
│  (WebMCP)    │     │ (webmcp-proxy)  │     │ Service Worker   │     │    (UI)     │
└──────┬───────┘     └────────┬────────┘     └────────┬─────────┘     └──────┬──────┘
       │                      │                       │                      │
       │  1. Page loads       │                       │                      │
       │◄─────────────────────│                       │                      │
       │                      │                       │                      │
       │  2. Connect via      │                       │                      │
       │     TabClientTransport                       │                      │
       │◄─────────────────────│                       │                      │
       │                      │                       │                      │
       │  3. listTools()      │                       │                      │
       │◄─────────────────────│                       │                      │
       │                      │                       │                      │
       │  4. Return tools     │                       │                      │
       │─────────────────────►│                       │                      │
       │                      │                       │                      │
       │                      │  5. webmcp/tools/     │                      │
       │                      │     register          │                      │
       │                      │──────────────────────►│                      │
       │                      │                       │                      │
       │                      │                       │  6. webmcp/tools/    │
       │                      │                       │     updated          │
       │                      │                       │─────────────────────►│
       │                      │                       │                      │
       │                      │                       │                      │  7. Update UI
       │                      │                       │                      │◄────────────
       │                      │                       │                      │
```

### Tool Execution Flow

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Website    │     │ Content Script  │     │   Background     │     │   AI Chat   │
│  (WebMCP)    │     │ (webmcp-proxy)  │     │ Service Worker   │     │   System    │
└──────┬───────┘     └────────┬────────┘     └────────┬─────────┘     └──────┬──────┘
       │                      │                       │                      │
       │                      │                       │  1. AI decides to    │
       │                      │                       │     use WebMCP tool  │
       │                      │                       │◄─────────────────────│
       │                      │                       │                      │
       │                      │                       │  2. webmcp/tool/call │
       │                      │                       │◄─────────────────────│
       │                      │                       │                      │
       │                      │  3. webmcp/tool/      │                      │
       │                      │     execute           │                      │
       │                      │◄──────────────────────│                      │
       │                      │                       │                      │
       │  4. callTool()       │                       │                      │
       │◄─────────────────────│                       │                      │
       │                      │                       │                      │
       │  5. Tool result      │                       │                      │
       │─────────────────────►│                       │                      │
       │                      │                       │                      │
       │                      │  6. webmcp/tool/      │                      │
       │                      │     result            │                      │
       │                      │──────────────────────►│                      │
       │                      │                       │                      │
       │                      │                       │  7. Return result    │
       │                      │                       │─────────────────────►│
       │                      │                       │                      │
```

---

## Sequence Diagrams

### Tab Switch Sequence

```
┌─────────┐          ┌──────────────┐          ┌─────────────────┐          ┌─────────────┐
│  User   │          │    Chrome    │          │   Background    │          │Content Script│
└────┬────┘          └──────┬───────┘          └────────┬────────┘          └──────┬──────┘
     │                      │                           │                          │
     │  Switch Tab          │                           │                          │
     │─────────────────────►│                           │                          │
     │                      │                           │                          │
     │                      │  tabs.onActivated         │                          │
     │                      │──────────────────────────►│                          │
     │                      │                           │                          │
     │                      │                           │  clearWebMCPTools()      │
     │                      │                           │─────────────────────────►│
     │                      │                           │                          │
     │                      │                           │  setActiveTab(newTabId)  │
     │                      │                           │─────────────────────────►│
     │                      │                           │                          │
     │                      │                           │  webmcp/tools/refresh    │
     │                      │                           │─────────────────────────►│
     │                      │                           │                          │
     │                      │                           │                          │  Connect &
     │                      │                           │                          │  Discover
     │                      │                           │                          │◄─────────
     │                      │                           │                          │
     │                      │                           │  webmcp/tools/register   │
     │                      │                           │◄─────────────────────────│
     │                      │                           │                          │
     │                      │                           │  Broadcast update        │
     │                      │                           │─────────────────────────►│
     │                      │                           │                          │
```

### AI Tool Integration Sequence

```
┌──────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌─────────────┐
│   User   │     │  AI System  │     │ Tool Manager │     │  Background  │     │Content Script│
└────┬─────┘     └──────┬──────┘     └──────┬───────┘     └──────┬───────┘     └──────┬──────┘
     │                  │                   │                    │                    │
     │  Send message    │                   │                    │                    │
     │─────────────────►│                   │                    │                    │
     │                  │                   │                    │                    │
     │                  │  setupRemoteTools │                    │                    │
     │                  │──────────────────►│                    │                    │
     │                  │                   │                    │                    │
     │                  │                   │  getWebMCPTools    │                    │
     │                  │                   │  FromBackground()  │                    │
     │                  │                   │───────────────────►│                    │
     │                  │                   │                    │                    │
     │                  │                   │                    │  webmcp/tools/list │
     │                  │                   │                    │───────────────────►│
     │                  │                   │                    │                    │
     │                  │                   │                    │  Return tools      │
     │                  │                   │◄───────────────────│                    │
     │                  │                   │                    │                    │
     │                  │                   │  convertWebMCPTools│                    │
     │                  │                   │  ToAITools()       │                    │
     │                  │                   │◄──────────────────►│                    │
     │                  │                   │                    │                    │
     │                  │  Combined tools   │                    │                    │
     │                  │◄──────────────────│                    │                    │
     │                  │                   │                    │                    │
     │                  │  AI uses tool     │                    │                    │
     │                  │──────────────────────────────────────────────────────────►│
     │                  │                   │                    │                    │
     │  Response        │                   │                    │                    │
     │◄─────────────────│                   │                    │                    │
     │                  │                   │                    │                    │
```

---

## Message Types

### WebMCP Message Interface

```typescript
// Tool registration from content script
interface WebMCPToolsRegisterMessage {
  type: 'webmcp/tools/register';
  tools: WebMCPTool[];
  tabId: number;
  domain: string;
  url: string;
}

// Request tools list
interface WebMCPToolsListRequest {
  type: 'webmcp/tools/list';
}

// Get full state
interface WebMCPStateRequest {
  type: 'webmcp/tools/state';
}

// Execute tool
interface WebMCPToolCallRequest {
  type: 'webmcp/tool/call';
  payload: {
    toolName: string;
    args: Record<string, unknown>;
  };
}

// Tool execution (to content script)
interface WebMCPToolExecutionRequest {
  type: 'webmcp/tool/execute';
  toolName: string;
  originalToolName: string;
  args: Record<string, unknown>;
  requestId: string;
}

// Tool result (from content script)
interface WebMCPToolExecutionResult {
  type: 'webmcp/tool/result';
  requestId: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

// Broadcast tool updates
interface WebMCPToolsUpdatedMessage {
  type: 'webmcp/tools/updated';
  tools: WebMCPTool[];
}
```

---

## State Management

### WebMCPToolsState

```typescript
interface WebMCPToolsState {
  tools: WebMCPTool[];           // Current tools from active tab
  activeTabId: number | null;    // Currently tracked tab
  activeDomain: string | null;   // Domain of active tab
  isDiscovering: boolean;        // Discovery in progress
  lastUpdated: number;           // Timestamp of last update
}
```

### WebMCPTool Interface

```typescript
interface WebMCPTool extends Tool {
  originalName: string;   // Original name from page's MCP server
  name: string;           // Prefixed name: webmcp_{domain}_{name}
  domain: string;         // Domain where tool was discovered
  tabId: number;          // Tab ID where tool exists
  url: string;            // Full URL of the page
  favicon?: string;       // Website favicon URL
}
```

### Storage Keys

| Key | Purpose |
|-----|---------|
| `webmcp.tools.disabled` | Array of disabled tool names |

---

## Block Diagram: Complete System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    CHROME EXTENSION                                      │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              PRESENTATION LAYER                                  │   │
│  │                                                                                  │   │
│  │   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐    │   │
│  │   │  ToolsPopover   │    │  WebMcpSection  │    │   useToolsPopover       │    │   │
│  │   │   Component     │───►│   Component     │◄───│      Hook               │    │   │
│  │   └─────────────────┘    └─────────────────┘    └───────────┬─────────────┘    │   │
│  │                                                              │                  │   │
│  └──────────────────────────────────────────────────────────────┼──────────────────┘   │
│                                                                 │                      │
│                                                                 ▼                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                               HOOKS LAYER                                        │   │
│  │                                                                                  │   │
│  │   ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │   │                         useWebMCPTools                                   │   │   │
│  │   │                                                                          │   │   │
│  │   │   • tools state          • disabledTools        • toggleTool()          │   │   │
│  │   │   • isLoading            • enabledCount         • refresh()             │   │   │
│  │   │   • error                • currentDomain        • discover()            │   │   │
│  │   │                                                                          │   │   │
│  │   └──────────────────────────────────┬──────────────────────────────────────┘   │   │
│  │                                      │                                          │   │
│  └──────────────────────────────────────┼──────────────────────────────────────────┘   │
│                                         │ chrome.runtime.sendMessage                   │
│                                         ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                          BACKGROUND SERVICE WORKER                               │   │
│  │                                                                                  │   │
│  │   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐    │   │
│  │   │  Message Router │───►│ WebMCP Handler  │───►│    WebMCP Manager       │    │   │
│  │   │                 │    │                 │    │                         │    │   │
│  │   │ isWebMCPMessage │    │ handleWebMCP    │    │ • state management      │    │   │
│  │   │ routing logic   │    │ Message()       │    │ • tab tracking          │    │   │
│  │   └─────────────────┘    └─────────────────┘    │ • tool registration     │    │   │
│  │                                                  │ • execution routing     │    │   │
│  │                                                  └───────────┬─────────────┘    │   │
│  │                                                              │                  │   │
│  └──────────────────────────────────────────────────────────────┼──────────────────┘   │
│                                                                 │                      │
│                                         chrome.tabs.sendMessage │                      │
│                                                                 ▼                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              CONTENT SCRIPT                                      │   │
│  │                                                                                  │   │
│  │   ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │   │                        webmcp-proxy.ts                                   │   │   │
│  │   │                                                                          │   │   │
│  │   │   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    │   │   │
│  │   │   │ TabClient       │    │   MCP Client    │    │ Message Handler │    │   │   │
│  │   │   │ Transport       │───►│   (SDK)         │◄───│                 │    │   │   │
│  │   │   └─────────────────┘    └─────────────────┘    └─────────────────┘    │   │   │
│  │   │                                                                          │   │   │
│  │   └──────────────────────────────────┬──────────────────────────────────────┘   │   │
│  │                                      │                                          │   │
│  └──────────────────────────────────────┼──────────────────────────────────────────┘   │
│                                         │ postMessage (TabClientTransport)             │
└─────────────────────────────────────────┼───────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   WEBSITE PAGE                                           │
│                                                                                         │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │                           WebMCP Server Implementation                           │   │
│   │                                                                                  │   │
│   │   • Implements MCP protocol                                                     │   │
│   │   • Exposes tools via listTools()                                               │   │
│   │   • Handles callTool() requests                                                 │   │
│   │   • Emits ToolListChanged notifications                                         │   │
│   │                                                                                  │   │
│   └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## AI Integration Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                AI TOOL INTEGRATION                                       │
│                                                                                         │
│   ┌─────────────────┐                                                                   │
│   │   User Message  │                                                                   │
│   └────────┬────────┘                                                                   │
│            │                                                                            │
│            ▼                                                                            │
│   ┌─────────────────┐                                                                   │
│   │  Tool Manager   │                                                                   │
│   │ setupRemoteTools│                                                                   │
│   └────────┬────────┘                                                                   │
│            │                                                                            │
│            ├──────────────────────┬──────────────────────┬─────────────────────┐        │
│            ▼                      ▼                      ▼                     ▼        │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐   ┌─────────────┐   │
│   │ Extension Tools │    │   MCP Tools     │    │  WebMCP Tools   │   │ Agent Tools │   │
│   │ (getAllTools)   │    │ (getMCPTools    │    │ (getWebMCPTools │   │ (YouTube,   │   │
│   │                 │    │  FromBackground)│    │  FromBackground)│   │  PDF)       │   │
│   └────────┬────────┘    └────────┬────────┘    └────────┬────────┘   └──────┬──────┘   │
│            │                      │                      │                   │          │
│            └──────────────────────┴──────────────────────┴───────────────────┘          │
│                                          │                                              │
│                                          ▼                                              │
│                              ┌─────────────────────┐                                    │
│                              │   Combined Tools    │                                    │
│                              │   { ...extension,   │                                    │
│                              │     ...mcp,         │                                    │ 
│                              │     ...webmcp,      │                                    │
│                              │     ...agents }     │                                    │
│                              └──────────┬──────────┘                                    │
│                                    │                                          │
│                                                            │
│                         ┌───────────────                            │
│                        │    AI Model                          │
│                      │  (Gemin                            │
│                              └──────────┬──────────┘
│                                         │                                              │
│                                         ▼                                              │
│                              ┌─────────────────────┐                                   │
│                              │  Tool Execution     │                                   │
│                              │  (via proxy)        │                                   │
│                              └─────────────────────┘                                   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## File Reference

| File | Purpose |
|------|---------|
| `src/types/webmcp.ts` | Type definitions for WebMCP |
| `src/contents/webmcp-proxy.ts` | Content script for tool discovery |
| `src/background/webmcp/manager.ts` | State management |
| `src/background/webmcp/index.ts` | Module exports |
| `src/background/messaging/webmcpHandler.ts` | Message routing |
| `src/background/messaging/router.ts` | Central message router |
| `src/hooks/webmcp/useWebMCPTools.ts` | React hook |
| `src/ai/tools/webmcpTools.ts` | AI SDK integration |
| `src/ai/tools/manager.ts` | Tool aggregation |
| `src/components/.../WebMcpSection.tsx` | UI component |
| `src/components/.../useToolsPopover.ts` | Popover hook |
