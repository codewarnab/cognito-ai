# MCP StdIO Transport Architecture

This document describes the implementation of Standard I/O (StdIO) transport for the Model Context Protocol (MCP) in the Cognito AI extension. This feature enables the extension to connect to MCP servers that use stdio transport (spawned as local processes), even from a browser context where direct process spawning is impossible.

## Overview

The MCP specification defines two primary transport mechanisms:

- **StdIO** - Communication over standard input/output with spawned subprocess
- **Streamable HTTP/SSE** - Communication via HTTP requests and Server-Sent Events

Browser extensions cannot spawn local processes directly. To support StdIO-based MCP servers, Cognito implements a backend-proxied execution model where:

1. The extension handles configuration, authentication, and tool discovery UI
2. The backend spawns the MCP server process and executes tools
3. Both BYOK (Bring Your Own Key) and Cloud Mode use the backend for StdIO tool execution

> **SECURITY**: Commands are stored in a secure server-side registry (`@cognito/shared/constants/mcpRegistry.ts`), NOT sent from the frontend. The frontend only sends `serverId` + `credentials`. This prevents arbitrary command execution attacks.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COGNITO AI EXTENSION                               │
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │  MCP Settings   │    │  MCP Manager    │    │ McpBackendClient│         │
│  │  UI (Sidepanel) │◄──►│  (Background)   │◄──►│  (StdIO Proxy)  │         │
│  └─────────────────┘    └─────────────────┘    └────────┬────────┘         │
│                                                          │                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Tool Discovery & Execution Flow                  │   │
│  │                                                                      │   │
│  │  Server Config (mcpServers.tsx)                                      │   │
│  │  ├── id: "magic-mcp"                                                 │   │
│  │  ├── isBackendOnly: true ◄── Indicates StdIO server                  │   │
│  │  └── authConfig: { type: 'pat', ... }                                │   │
│  │                                                                      │   │
│  │  SECURITY: Commands are in backend registry, NOT in frontend config  │   │
│  │  └── Backend Registry: @cognito/shared/constants/mcpRegistry.ts      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ HTTP POST
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        VERCEL BACKEND (@cognito/backend-vercel)              │
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │ /api/ai/mcp/    │    │ StdioMcpService │    │  MCP Process    │         │
│  │ discover        │───►│                 │───►│                 │         │
│  │ execute         │    │ - createClient  │    │ stdio transport │         │
│  └─────────────────┘    │ - discoverTools │    │ (subprocess)    │         │
│                         │ - executeTool   │    └─────────────────┘         │
│                         └─────────────────┘                                 │
│                                 │                                            │
│                         ┌───────▼───────┐                                   │
│                         │  Redis Cache  │                                   │
│                         │  (24h TTL)    │                                   │
│                         └───────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Reference

### Extension Components

| Component | Path | Purpose |
|-----------|------|---------|
| McpBackendClient | `src/background/mcp/McpBackendClient.ts` | Client proxy for StdIO servers |
| manager.ts | `src/background/mcp/manager.ts` | Connection manager (SSE & StdIO) |
| mcpServers.tsx | `src/constants/mcpServers.tsx` | Server configurations |
| types.ts | `src/mcp/types.ts` | Shared MCP type definitions |

### Backend Components

| Component | Path | Purpose |
|-----------|------|---------|
| mcp.ts (routes) | `src/routes/ai/mcp.ts` | API endpoints for MCP operations |
| StdioMcpService | `src/services/mcp/stdio.ts` | StdIO process management |
| chat.ts | `src/routes/ai/chat.ts` | Chat endpoint with MCP integration |

### Shared Types

| Type | Package | Purpose |
|------|---------|---------|
| MCP_SERVER_REGISTRY | `@cognito/shared` | Secure server command registry |
| McpStdioRequest | `@cognito/shared` | Discovery/execute request (serverId + credentials) |
| McpExecuteRequest | `@cognito/shared` | Tool execution request payload |
| McpDiscoveryResponse | `@cognito/shared` | Tool discovery response payload |

---

## Sequence Diagrams

### Server Connection & Tool Discovery

```
┌────────┐     ┌────────┐     ┌────────────────┐     ┌───────────┐     ┌───────────┐
│Settings│     │  MCP   │     │ McpBackend     │     │ Backend   │     │   MCP     │
│   UI   │     │Manager │     │ Client         │     │   API     │     │ Process   │
└───┬────┘     └───┬────┘     └───────┬────────┘     └─────┬─────┘     └─────┬─────┘
    │              │                   │                    │                 │
    │ Enable server│                   │                    │                 │
    │ (magic-mcp)  │                   │                    │                 │
    │─────────────►│                   │                    │                 │
    │              │                   │                    │                 │
    │              │ Check isBackendOnly flag               │                 │
    │              │──────────┐        │                    │                 │
    │              │          │        │                    │                 │
    │              │◄─────────┘        │                    │                 │
    │              │                   │                    │                 │
    │              │ [isBackendOnly = true]                 │                 │
    │              │                   │                    │                 │
    │              │ new McpBackendClient(config)           │                 │
    │              │──────────────────►│                    │                 │
    │              │                   │                    │                 │
    │              │                   │ Set state:         │                 │
    │              │                   │ connecting         │                 │
    │              │                   │────────┐           │                 │
    │              │                   │        │           │                 │
    │              │                   │◄───────┘           │                 │
    │              │                   │                    │                 │
    │              │ connect()         │                    │                 │
    │              │──────────────────►│                    │                 │
    │              │                   │                    │                 │
    │              │                   │ Set state:         │                 │
    │              │                   │ connected          │                 │
    │              │                   │────────┐           │                 │
    │              │                   │        │           │                 │
    │              │                   │◄───────┘           │                 │
    │              │                   │                    │                 │
    │              │ initialize()      │                    │                 │
    │              │──────────────────►│                    │                 │
    │              │                   │                    │                 │
    │              │                   │ POST /api/ai/mcp/discover            │
    │              │                   │ { serverId, credentials }            │
    │              │                   │───────────────────►│                 │
    │              │                   │                    │                 │
    │              │                   │                    │ Validate server │
    │              │                   │                    │ in registry     │
    │              │                   │                    │────────┐        │
    │              │                   │                    │        │        │
    │              │                   │                    │◄───────┘        │
    │              │                   │                    │                 │
    │              │                   │                    │ Check Redis     │
    │              │                   │                    │ cache           │
    │              │                   │                    │────────┐        │
    │              │                   │                    │        │        │
    │              │                   │                    │◄───────┘        │
    │              │                   │                    │                 │
    │              │                   │    [Cache MISS]    │                 │
    │              │                   │                    │                 │
    │              │                   │                    │ Spawn process   │
    │              │                   │                    │ (stdio)         │
    │              │                   │                    │────────────────►│
    │              │                   │                    │                 │
    │              │                   │                    │ Connection ready│
    │              │                   │                    │◄────────────────│
    │              │                   │                    │                 │
    │              │                   │                    │ tools/list      │
    │              │                   │                    │────────────────►│
    │              │                   │                    │                 │
    │              │                   │                    │ Tool schemas    │
    │              │                   │                    │◄────────────────│
    │              │                   │                    │                 │
    │              │                   │                    │ Cache to Redis  │
    │              │                   │                    │ (24h)           │
    │              │                   │                    │────────┐        │
    │              │                   │                    │        │        │
    │              │                   │                    │◄───────┘        │
    │              │                   │                    │                 │
    │              │                   │ { tools: [...] }   │                 │
    │              │                   │◄───────────────────│                 │
    │              │                   │                    │                 │
    │              │                   │ Store tools        │                 │
    │              │                   │ in status          │                 │
    │              │                   │────────┐           │                 │
    │              │                   │        │           │                 │
    │              │                   │◄───────┘           │                 │
    │              │                   │                    │                 │
    │              │ Discovery complete│                    │                 │
    │              │◄──────────────────│                    │                 │
    │              │                   │                    │                 │
    │ Broadcast    │                   │                    │                 │
    │ status update│                   │                    │                 │
    │◄─────────────│                   │                    │                 │
    │              │                   │                    │                 │
```

### Tool Execution Flow

```
┌──────┐   ┌───────┐   ┌────────┐   ┌─────────┐   ┌──────────────┐   ┌───────────┐
│ User │   │ Chat  │   │   AI   │   │ Backend │   │ StdioMcp     │   │   MCP     │
│      │   │  UI   │   │ Logic  │   │         │   │ Service      │   │ Process   │
└──┬───┘   └───┬───┘   └───┬────┘   └────┬────┘   └──────┬───────┘   └─────┬─────┘
   │           │           │             │               │                 │
   │ "Use magic│           │             │               │                 │
   │ tool to..."           │             │               │                 │
   │──────────►│           │             │               │                 │
   │           │           │             │               │                 │
   │           │ Send      │             │               │                 │
   │           │ message   │             │               │                 │
   │           │──────────►│             │               │                 │
   │           │           │             │               │                 │
   │           │           │ [Backend Mode]              │                 │
   │           │           │             │               │                 │
   │           │           │ POST /api/ai/chat-with-tools│                 │
   │           │           │ { mcpServers: [{ type: 'stdio', ... }] }      │
   │           │           │────────────►│               │                 │
   │           │           │             │               │                 │
   │           │           │             │ createClient  │                 │
   │           │           │             │ (config)      │                 │
   │           │           │             │──────────────►│                 │
   │           │           │             │               │                 │
   │           │           │             │               │ Spawn process   │
   │           │           │             │               │────────────────►│
   │           │           │             │               │                 │
   │           │           │             │               │ Ready           │
   │           │           │             │               │◄────────────────│
   │           │           │             │               │                 │
   │           │           │             │ Merge tools   │                 │
   │           │           │             │ (frontend +   │                 │
   │           │           │             │ server + stdio)                 │
   │           │           │             │────────┐      │                 │
   │           │           │             │        │      │                 │
   │           │           │             │◄───────┘      │                 │
   │           │           │             │               │                 │
   │           │           │             │ streamText    │                 │
   │           │           │             │ ({ tools })   │                 │
   │           │           │             │────────┐      │                 │
   │           │           │             │        │      │                 │
   │           │           │             │◄───────┘      │                 │
   │           │           │             │               │                 │
   │           │ SSE: tool-input-available               │                 │
   │           │◄────────────────────────│               │                 │
   │           │           │             │               │                 │
   │           │ Show tool │             │               │                 │
   │           │ call UI   │             │               │                 │
   │           │────────┐  │             │               │                 │
   │           │        │  │             │               │                 │
   │           │◄───────┘  │             │               │                 │
   │           │           │             │               │                 │
   │           │           │             │ tool.execute  │                 │
   │           │           │             │ (args)        │                 │
   │           │           │             │──────────────►│                 │
   │           │           │             │               │                 │
   │           │           │             │               │ Call tool via   │
   │           │           │             │               │ stdin           │
   │           │           │             │               │────────────────►│
   │           │           │             │               │                 │
   │           │           │             │               │ Result via      │
   │           │           │             │               │ stdout          │
   │           │           │             │               │◄────────────────│
   │           │           │             │               │                 │
   │           │           │             │ Tool result   │                 │
   │           │           │             │◄──────────────│                 │
   │           │           │             │               │                 │
   │           │ SSE: tool-output-available              │                 │
   │           │◄────────────────────────│               │                 │
   │           │           │             │               │                 │
   │           │ SSE: text-delta        │               │                 │
   │           │ (response) │             │               │                 │
   │           │◄────────────────────────│               │                 │
   │           │           │             │               │                 │
   │           │           │             │ client.close()│                 │
   │           │           │             │──────────────►│                 │
   │           │           │             │               │                 │
   │           │           │             │               │ Terminate       │
   │           │           │             │               │ process         │
   │           │           │             │               │────────────────►│
   │           │           │             │               │                 │
```

### Direct Tool Execution (BYOK Mode)

```
┌────────────────┐     ┌───────────┐     ┌──────────────┐     ┌───────────┐
│ McpBackend     │     │ Backend   │     │ StdioMcp     │     │   MCP     │
│ Client         │     │   API     │     │ Service      │     │ Process   │
└───────┬────────┘     └─────┬─────┘     └──────┬───────┘     └─────┬─────┘
        │                    │                  │                   │
        │ POST /api/ai/mcp/execute              │                   │
        │ { serverId, credentials,               │                   │
        │   toolName, toolArgs }                 │                   │
        │───────────────────►│                  │                   │
        │                    │                  │                   │
        │                    │ Validate server  │                   │
        │                    │ in registry      │                   │
        │                    │────────┐         │                   │
        │                    │        │         │                   │
        │                    │◄───────┘         │                   │
        │                    │                  │                   │
        │                    │ executeTool      │                   │
        │                    │ (config, name,   │                   │
        │                    │  args)           │                   │
        │                    │─────────────────►│                   │
        │                    │                  │                   │
        │                    │                  │ Spawn process     │
        │                    │                  │──────────────────►│
        │                    │                  │                   │
        │                    │                  │ Ready             │
        │                    │                  │◄──────────────────│
        │                    │                  │                   │
        │                    │                  │ Write to stdin    │
        │                    │                  │ (JSON-RPC)        │
        │                    │                  │──────────────────►│
        │                    │                  │                   │
        │                    │                  │ Read from stdout  │
        │                    │                  │◄──────────────────│
        │                    │                  │                   │
        │                    │                  │ Close process     │
        │                    │                  │──────────────────►│
        │                    │                  │                   │
        │                    │ Tool result      │                   │
        │                    │◄─────────────────│                   │
        │                    │                  │                   │
        │ { result: ... }    │                  │                   │
        │◄───────────────────│                  │                   │
        │                    │                  │                   │
```

---

## Data Flow Diagrams

### Configuration Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            Extension (Browser)                                │
│                                                                              │
│  ┌─────────────────────┐                                                     │
│  │ Server Config       │                                                     │
│  │ (mcpServers.tsx)    │                                                     │
│  └──────────┬──────────┘                                                     │
│             │                                                                │
│             ▼                                                                │
│      ┌──────────────┐                                                        │
│      │isBackendOnly?│                                                        │
│      └──────┬───────┘                                                        │
│             │                                                                │
│      ┌──────┴──────┐                                                         │
│      │             │                                                         │
│      ▼             ▼                                                         │
│   [true]        [false]                                                      │
│      │             │                                                         │
│      ▼             ▼                                                         │
│  ┌──────────┐  ┌───────────┐                                                 │
│  │McpBackend│  │McpSSE     │                                                 │
│  │Client    │  │Client     │                                                 │
│  └────┬─────┘  └─────┬─────┘                                                 │
│       │              │                                                       │
│       ▼              ▼                                                       │
│  ┌──────────┐  ┌───────────────┐                                             │
│  │Send to   │  │Direct SSE     │                                             │
│  │Backend   │  │Connection     │                                             │
│  └────┬─────┘  └───────────────┘                                             │
│       │                                                                      │
└───────┼──────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                            Backend (Vercel)                                   │
│                                                                              │
│  ┌───────────────────────┐                                                   │
│  │ /api/ai/mcp/discover  │                                                   │
│  └───────────┬───────────┘                                                   │
│              │                                                               │
│              ▼                                                               │
│  ┌───────────────────────┐                                                   │
│  │ StdioMcpService       │                                                   │
│  └───────────┬───────────┘                                                   │
│              │                                                               │
│              ▼                                                               │
│  ┌───────────────────────┐                                                   │
│  │ Spawn MCP Process     │                                                   │
│  └───────────┬───────────┘                                                   │
│              │                                                               │
│              ▼                                                               │
│  ┌───────────────────────┐                                                   │
│  │ Get Tool Schemas      │                                                   │
│  └───────────┬───────────┘                                                   │
│              │                                                               │
│              ▼                                                               │
│  ┌───────────────────────┐                                                   │
│  │ Redis Cache           │                                                   │
│  └───────────────────────┘                                                   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Return to Extension                                   │
└──────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Display Tools in UI                                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Tool Execution Modes

```
                    ┌───────────────────┐
                    │    Tool Call      │
                    │     Trigger       │
                    │    (AI Model)     │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │  Tool Location?   │
                    └─────────┬─────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
  [Frontend Tool]       [Server Tool]         [StdIO Tool]
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   Frontend    │     │    Server     │     │    StdIO      │
│   Execution   │     │   Execution   │     │   Execution   │
└───────┬───────┘     └───────┬───────┘     └───────┬───────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  Browser APIs │     │ Tavily/Jina/  │     │ StdioMcp      │
│               │     │ etc           │     │ Service       │
└───────┬───────┘     └───────┬───────┘     └───────┬───────┘
        │                     │                     │
        │                     │                     ▼
        │                     │             ┌───────────────┐
        │                     │             │ Spawn Process │
        │                     │             └───────┬───────┘
        │                     │                     │
        │                     │                     ▼
        │                     │             ┌───────────────┐
        │                     │             │ Execute Tool  │
        │                     │             └───────┬───────┘
        │                     │                     │
        └──────────┬──────────┴──────────┬──────────┘
                   │                     │
                   ▼                     ▼
           ┌───────────────────────────────────┐
           │          Return to AI             │
           └───────────────────────────────────┘
```

### Authentication & Credentials Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                               Extension                                       │
│                                                                              │
│  ┌──────────────────────┐                                                    │
│  │ User enters API Key  │                                                    │
│  └──────────┬───────────┘                                                    │
│             │                                                                │
│             ▼                                                                │
│  ┌──────────────────────┐                                                    │
│  │ Store in Chrome      │                                                    │
│  │ Storage              │                                                    │
│  └──────────┬───────────┘                                                    │
│             │                                                                │
│             ▼                                                                │
│  ┌──────────────────────┐                                                    │
│  │ McpBackendClient     │                                                    │
│  └──────────┬───────────┘                                                    │
│             │                                                                │
│             ▼                                                                │
│  ┌──────────────────────┐                                                    │
│  │    Auth Type?        │                                                    │
│  └──────────┬───────────┘                                                    │
│             │                                                                │
│      ┌──────┴──────┐                                                         │
│      │             │                                                         │
│      ▼             ▼                                                         │
│   [PAT]         [OAuth]                                                      │
│      │             │                                                         │
│      ▼             ▼                                                         │
│  ┌──────────┐  ┌───────────────┐                                             │
│  │Include as│  │Include as     │                                             │
│  │env.API_  │  │Bearer token   │                                             │
│  │KEY       │  │               │                                             │
│  └────┬─────┘  └───────┬───────┘                                             │
│       │                │                                                     │
│       └────────┬───────┘                                                     │
│                │                                                             │
└────────────────┼─────────────────────────────────────────────────────────────┘
                 │
                 ▼
      ┌──────────────────────┐
      │ POST /api/ai/mcp/    │
      │ discover             │
      └──────────┬───────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                               Backend                                         │
│                                                                              │
│  ┌──────────────────────┐                                                    │
│  │ Extract credentials  │                                                    │
│  └──────────┬───────────┘                                                    │
│             │                                                                │
│             ▼                                                                │
│  ┌──────────────────────┐                                                    │
│  │ Inject into process  │                                                    │
│  │ env                  │                                                    │
│  └──────────┬───────────┘                                                    │
│             │                                                                │
│             ▼                                                                │
│  ┌──────────────────────┐                                                    │
│  │ Spawn MCP Process    │                                                    │
│  └──────────┬───────────┘                                                    │
│             │                                                                │
│             ▼                                                                │
│  ┌──────────────────────┐                                                    │
│  │ Process uses         │                                                    │
│  │ credentials          │                                                    │
│  └──────────────────────┘                                                    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### Server Configuration Schema

```typescript
// apps/extension/src/constants/mcpServers.tsx

interface ServerConfig {
    id: string;
    name: string;
    icon: ReactNode;
    url: string;
    description: string;
    requiresAuthentication: boolean;
    
    // StdIO-specific fields
    isBackendOnly?: boolean;           // Indicates StdIO server
    // NOTE: stdioConfig is NOT stored here for security.
    // Commands are in: @cognito/shared/constants/mcpRegistry.ts
    
    authConfig?: {
        type: 'pat' | 'oauth' | 'hybrid';
        patConfig?: {
            label: string;
            placeholder: string;
        };
    };
}
```

### McpBackendClient Interface

```typescript
// apps/extension/src/background/mcp/McpBackendClient.ts

/**
 * SECURITY: This client sends only serverId + credentials to the backend.
 * The backend resolves the actual command from its secure registry.
 * This prevents arbitrary command execution attacks.
 */
export class McpBackendClient implements McpClient {
    constructor(
        serverId: string,
        accessToken: string | null
    );
    
    // Lifecycle
    async connect(): Promise<void>;
    async initialize(): Promise<void>;  // Triggers discovery
    disconnect(): void;
    
    // Tool operations
    async listTools(): Promise<{ tools: McpTool[] }>;
    async callTool(name: string, args?: Record<string, any>): Promise<any>;
    
    // State
    getStatus(): McpServerStatus;
}
```

### Backend API Endpoints

```typescript
// packages/backend-vercel/src/routes/ai/mcp.ts

// SECURITY: Frontend sends only serverId + credentials.
// Backend resolves command from MCP_SERVER_REGISTRY.

// Tool Discovery
POST /api/ai/mcp/discover
Request:  { serverId: string, credentials?: { apiKey?: string } }
Response: { tools: Array<{ name, description, inputSchema }> }

// Tool Execution
POST /api/ai/mcp/execute
Request:  { serverId, credentials?, toolName: string, toolArgs: object }
Response: { result: any }
```

### StdioMcpService Implementation

```typescript
// packages/backend-vercel/src/services/mcp/stdio.ts

export class StdioMcpService {
    // Create MCP client from config
    static async createClient(config: StdioConfig): Promise<McpClient>;
    
    // Discover tools with Redis caching (24h TTL)
    static async discoverTools(
        config: StdioConfig, 
        skipCache?: boolean
    ): Promise<Tool[]>;
    
    // Execute specific tool
    static async executeTool(
        config: StdioConfig, 
        toolName: string, 
        toolArgs: any
    ): Promise<any>;
}
```

---

## Mode Comparison

### BYOK Mode (Bring Your Own Key)

In BYOK mode, the user provides their own API keys. For StdIO servers:

1. Extension stores user's credentials (e.g., Magic MCP API key)
2. When tool execution is needed, extension calls backend `/api/ai/mcp/execute`
3. Backend spawns process with credentials injected as environment variables
4. Tool result returns to extension for AI continuation

```
┌───────────┐  credentials + tool call  ┌─────────┐
│ Extension │ ─────────────────────────►│ Backend │
└───────────┘                           └────┬────┘
                                             │
                                             │ spawn with env
                                             ▼
                                        ┌─────────────┐
                                        │ MCP Process │
                                        └──────┬──────┘
                                               │
                                               │ result
                                               ▼
┌───────────┐       result              ┌─────────┐
│ Extension │◄──────────────────────────│ Backend │
└─────┬─────┘                           └─────────┘
      │
      │ continue
      ▼
┌───────────────┐
│ Local AI Model│
└───────────────┘
```

### Cloud Mode (Backend API Key)

In Cloud mode, the backend handles everything:

1. Extension sends chat request with `mcpServers` configuration
2. Backend initializes StdIO clients during chat processing
3. AI model calls tools, backend executes them
4. Results stream back to extension

```
┌───────────┐  chat + mcp config  ┌─────────┐
│ Extension │ ───────────────────►│ Backend │
└───────────┘                     └────┬────┘
                                       │
                              ┌────────┼────────┐
                              │        │        │
                              ▼        │        ▼
                         ┌─────────┐   │   ┌──────────┐
                         │  spawn  │   │   │streamText│
                         └────┬────┘   │   └────┬─────┘
                              │        │        │
                              ▼        │        ▼
                        ┌───────────┐  │   ┌──────────┐
                        │MCP Process│  │   │ AI Model │
                        └─────┬─────┘  │   └────┬─────┘
                              │        │        │
                              │        │  tool call
                              │        │◄───────┘
                              │        │
                              │◄───────┤ execute
                              │        │
                         result│       │
                              │────────►│
                              │        │
                              │        │stream
                              │        ▼
┌───────────┐                     ┌─────────┐
│ Extension │◄────────────────────│ Backend │
└───────────┘                     └─────────┘
```

---

## Caching Strategy

Tool discovery results are cached in Redis to avoid repeated process spawning:

| Cache Key | Format | TTL |
|-----------|--------|-----|
| Tool schemas | `mcp:tools:{sha256(cmd+args)}` | 24 hours |

### Cache Key Generation

```typescript
private static getCacheKey(config: StdioConfig): string {
    const hash = crypto
        .createHash('sha256')
        .update(JSON.stringify({ cmd: config.command, args: config.args }))
        .digest('hex');
    return `mcp:tools:${hash}`;
}
```

### Cache Bypass

The discovery endpoint supports a `skipCache` query parameter:

```
POST /api/ai/mcp/discover?skipCache=true
```

---

## Tool Name Sanitization

Gemini models require tool names to start with a letter or underscore. The system sanitizes tool names:

```typescript
function sanitizeToolName(name: string): string {
    let sanitized = name;
    
    // Prefix with tool_ if starts with digit
    if (/^[0-9]/.test(sanitized)) {
        sanitized = `tool_${sanitized}`;
    }
    
    // Replace invalid chars (allowed: a-z, A-Z, 0-9, _, ., -, :)
    sanitized = sanitized.replace(/[^a-zA-Z0-9_.:-]/g, '_');
    
    return sanitized;
}
```

A mapping is maintained to reverse sanitization when receiving tool calls from the AI.

---

## Error Handling

### Discovery Errors

| Error Type | Cause | Handling |
|------------|-------|----------|
| Config Missing | No `stdioConfig` in server config | Throw error, show in UI |
| Spawn Failure | Process failed to start | Log error, set status to 'error' |
| Timeout | Process didn't respond | Terminate process, return error |
| Network Error | Backend unreachable | Show network error in UI |

### Execution Errors

| Error Type | Cause | Handling |
|------------|-------|----------|
| Tool Not Found | Tool name doesn't exist | Return error to AI |
| Execution Failure | Tool threw error | Return error details to AI |
| Process Crash | MCP process died | Log error, cleanup resources |

---

## Example: Magic MCP Server

```typescript
// apps/extension/src/constants/mcpServers.tsx

{
    // SECURITY: Command/args defined in backend registry:
    // @cognito/shared/constants/mcpRegistry.ts
    id: "magic-mcp",
    name: "Magic MCP",
    icon: <McpServerIcon serverId="magic-mcp" />,
    initialEnabled: false,
    initialAuthenticated: false,
    url: "stdio://magic-mcp",  // Pseudo-URL for identification
    description: "Magic MCP server (Backend StdIO)",
    requiresAuthentication: true,
    isBackendOnly: true,
    // NOTE: stdioConfig is NOT here - see MCP_SERVER_REGISTRY
    authConfig: {
        type: 'pat',
        patConfig: {
            label: "Magic API Key",
            placeholder: "Enter your API Key",
        }
    }
}
```

---

## Platform Considerations

### Windows Compatibility

The backend handles Windows-specific process spawning:

```typescript
if (process.platform === 'win32') {
    const isNpmTool = /^(npm|npx|pnpm|yarn)(\.cmd)?$/i.test(command);
    if (isNpmTool || command.endsWith('.cmd')) {
        args = ['/c', command, ...args];
        command = 'cmd.exe';
    }
    
    // Normalize PATH environment variable
    const pathKeys = Object.keys(env).filter(k => k.toLowerCase() === 'path');
    // ... merge and deduplicate
}
```

### Process Lifecycle

- Processes are spawned per-request for tool execution
- Discovery creates a client, fetches tools, then closes
- Chat endpoints cleanup MCP clients on response finish

---

## Dependencies

### Extension

- `@ai-sdk/mcp` - MCP client utilities
- `@mcp-b/transports` - Transport implementations
- `@modelcontextprotocol/sdk` - Official MCP SDK

### Backend

- `@ai-sdk/mcp` - MCP client creation
- `zod-to-json-schema` - Schema conversion
- `@upstash/redis` - Caching layer

---

## Related Documentation

- [Server Tools Architecture](./SERVER_TOOLS_ARCHITECTURE.md) - Server-executed tools
- [Tool Approval System](./TOOL_APPROVAL_SYSTEM.md) - Human-in-the-loop approval
- [MCP Specification](https://spec.modelcontextprotocol.io/) - Official spec
- [AI SDK MCP](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling#mcp-tools) - Vercel AI SDK MCP docs

---

## Future Improvements

- **Connection Pooling** - Reuse spawned processes across requests
- **WebSocket Support** - Alternative transport for real-time communication
- **Local Proxy** - Native messaging for true local execution
- **Health Checks** - Periodic process health monitoring
- **Resource Management** - Memory and process limits
