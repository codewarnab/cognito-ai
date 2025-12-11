# Remote MCP Integration Architecture

This document provides a comprehensive analysis of the Remote MCP (Model Context Protocol) integration implementation in the Chrome AI Extension.

## Table of Contents

1. [Overview](#overview)
2. [Architecture Block Diagram](#architecture-block-diagram)
3. [Core Components](#core-components)
4. [Connection Flow](#connection-flow)
5. [OAuth Authentication Flow](#oauth-authentication-flow)
6. [Transport Protocols](#transport-protocols)
7. [Tool Execution Flow](#tool-execution-flow)
8. [State Management](#state-management)
9. [Error Handling](#error-handling)

---

## Overview

The Remote MCP integration enables the Chrome extension to connect to external MCP servers (like Notion, Linear, Ahrefs, etc.) and expose their tools to the AI assistant. The architecture follows a **proxy pattern** where:

- **Background Service Worker** maintains persistent connections to MCP servers
- **Frontend (Sidepanel)** communicates with background via Chrome messaging
- **AI SDK** uses proxy tools that delegate execution to background connections

### Key Design Principles

1. **Persistent Connections**: Background service worker maintains long-lived SSE connections
2. **OAuth 2.0 with Dynamic Client Registration**: RFC 7591 compliant authentication
3. **Dual Transport Support**: Streamable HTTP (POST) and HTTP+SSE (GET) protocols
4. **Per-Server Error Isolation**: One server failure doesn't break others
5. **Automatic Token Refresh**: Proactive token refresh before expiration

---

## Architecture Block Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    CHROME EXTENSION                                  │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                           FRONTEND (Sidepanel)                               │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │    │
│  │  │   McpManager    │  │   AI Chat UI    │  │     MCP Proxy Module        │  │    │
│  │  │   Component     │  │   Component     │  │  (src/ai/mcp/proxy.ts)      │  │    │
│  │  │                 │  │                 │  │                             │  │    │
│  │  │ • Server List   │  │ • User Input    │  │ • getMCPToolsFromBackground │  │    │
│  │  │ • Enable/Disable│  │ • AI Response   │  │ • convertMCPSchemaToZod     │  │    │
│  │  │ • Auth Trigger  │  │ • Tool Results  │  │ • Proxy Tool Executors      │  │    │
│  │  └────────┬────────┘  └────────┬────────┘  └─────────────┬───────────────┘  │    │
│  │           │                    │                         │                   │    │
│  └───────────┼────────────────────┼─────────────────────────┼───────────────────┘    │
│              │                    │                         │                        │
│              │    chrome.runtime.sendMessage()              │                        │
│              ▼                    ▼                         ▼                        │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                      CHROME MESSAGING LAYER                                  │    │
│  │                                                                              │    │
│  │   Message Types:                                                             │    │
│  │   • mcp/{serverId}/auth/start     • mcp/{serverId}/enable                   │    │
│  │   • mcp/{serverId}/disconnect     • mcp/{serverId}/tool/call                │    │
│  │   • mcp/{serverId}/status/get     • mcp/tools/list                          │    │
│  │   • mcp/servers/get               • mcp/{serverId}/health/check             │    │
│  │                                                                              │    │
│  └──────────────────────────────────────┬───────────────────────────────────────┘    │
│                                         │                                            │
│                                         ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                    BACKGROUND SERVICE WORKER                                 │    │
│  │                                                                              │    │
│  │  ┌──────────────────────────────────────────────────────────────────────┐   │    │
│  │  │                     Message Router                                    │   │    │
│  │  │                (src/background/messaging/router.ts)                   │   │    │
│  │  │                                                                       │   │    │
│  │  │  Routes messages to appropriate handlers based on type prefix         │   │    │
│  │  └───────────────────────────────┬───────────────────────────────────────┘   │    │
│  │                                  │                                           │    │
│  │                                  ▼                                           │    │
│  │  ┌──────────────────────────────────────────────────────────────────────┐   │    │
│  │  │                     MCP Handler                                       │   │    │
│  │  │            (src/background/messaging/mcpHandler.ts)                   │   │    │
│  │  │                                                                       │   │    │
│  │  │  Dispatches to: Auth Module | Manager Module | Tools Module           │   │    │
│  │  └───────────────────────────────┬───────────────────────────────────────┘   │    │
│  │                                  │                                           │    │
│  │          ┌───────────────────────┼───────────────────────┐                   │    │
│  │          ▼                       ▼                       ▼                   │    │
│  │  ┌──────────────┐      ┌──────────────┐      ┌──────────────────┐           │    │
│  │  │  Auth Module │      │   Manager    │      │   Tools Module   │           │    │
│  │  │  (auth.ts)   │      │ (manager.ts) │      │   (tools.ts)     │           │    │
│  │  │              │      │              │      │                  │           │    │
│  │  │• startOAuth  │      │• connect     │      │• getServerTools  │           │    │
│  │  │• disconnect  │      │• disconnect  │      │• performHealth   │           │    │
│  │  │• tokenExpiry │      │• enable      │      │• getAllMCPTools  │           │    │
│  │  │• invalidToken│      │• disable     │      │• callServerTool  │           │    │
│  │  └──────┬───────┘      └──────┬───────┘      └────────┬─────────┘           │    │
│  │         │                     │                       │                      │    │
│  │         └─────────────────────┼───────────────────────┘                      │    │
│  │                               ▼                                              │    │
│  │  ┌──────────────────────────────────────────────────────────────────────┐   │    │
│  │  │                     Server State Manager                              │   │    │
│  │  │                    (src/mcp/state.ts)                                 │   │    │
│  │  │                                                                       │   │    │
│  │  │  serverStates: Map<serverId, ServerState>                            │   │    │
│  │  │                                                                       │   │    │
│  │  │  ServerState {                                                        │   │    │
│  │  │    client: McpSSEClient | null                                       │   │    │
│  │  │    tokens: McpOAuthTokens | null                                     │   │    │
│  │  │    credentials: DynamicClientCredentials | null                      │   │    │
│  │  │    status: McpServerStatus                                           │   │    │
│  │  │    oauthEndpoints: OAuthEndpoints | null                             │   │    │
│  │  │    oauthState: OAuthState | null                                     │   │    │
│  │  │    isEnabled: boolean                                                │   │    │
│  │  │  }                                                                    │   │    │
│  │  └───────────────────────────────┬───────────────────────────────────────┘   │    │
│  │                                  │                                           │    │
│  │                                  ▼                                           │    │
│  │  ┌──────────────────────────────────────────────────────────────────────┐   │    │
│  │  │                     MCP SSE Client                                    │   │    │
│  │  │                (src/mcp/client/McpSSEClient.ts)                       │   │    │
│  │  │                                                                       │   │    │
│  │  │  Orchestrates:                                                        │   │    │
│  │  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │   │    │
│  │  │  │TransportDetector│  │ StreamProcessor │  │ RequestManager  │       │   │    │
│  │  │  │                 │  │                 │  │                 │       │   │    │
│  │  │  │• POST vs GET    │  │• Parse SSE      │  │• Send requests  │       │   │    │
│  │  │  │• Endpoint mgmt  │  │• Handle events  │  │• Timeout mgmt   │       │   │    │
│  │  │  └─────────────────┘  └─────────────────┘  └─────────────────┘       │   │    │
│  │  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │   │    │
│  │  │  │ConnectionManager│  │ MessageHandler  │  │  ErrorHandler   │       │   │    │
│  │  │  │                 │  │                 │  │                 │       │   │    │
│  │  │  │• Reconnection   │  │• Route messages │  │• Categorize     │       │   │    │
│  │  │  │• Exp. backoff   │  │• Pending reqs   │  │• User messages  │       │   │    │
│  │  │  └─────────────────┘  └─────────────────┘  └─────────────────┘       │   │    │
│  │  └───────────────────────────────────────────────────────────────────────┘   │    │
│  │                                                                              │    │
│  └──────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         │ HTTPS (SSE / Streamable HTTP)
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL MCP SERVERS                                     │
│                                                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Notion    │  │   Linear    │  │   Ahrefs    │  │  Supabase   │  │   Custom    │ │
│  │   /mcp      │  │   /sse      │  │   /mcp      │  │   /mcp      │  │   Server    │ │
│  │             │  │             │  │             │  │             │  │             │ │
│  │ • OAuth 2.0 │  │ • OAuth 2.0 │  │ • OAuth 2.0 │  │ • OAuth 2.0 │  │ • Headers   │ │
│  │ • DCR       │  │ • DCR       │  │ • DCR       │  │ • DCR       │  │ • No Auth   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
│                                                                                       │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Frontend Layer

| Component | File | Purpose |
|-----------|------|---------|
| McpManager | `src/components/features/mcp/McpManager.tsx` | UI for managing MCP servers |
| MCP Proxy | `src/ai/mcp/proxy.ts` | Creates proxy tools for AI SDK |
| MCP Client (AI) | `src/ai/mcp/client.ts` | Direct MCP client for AI SDK (alternative) |

### 2. Background Service Worker

| Module | File | Purpose |
|--------|------|---------|
| MCP Handler | `src/background/messaging/mcpHandler.ts` | Routes MCP messages |
| Auth Module | `src/background/mcp/auth.ts` | OAuth flow management |
| Manager Module | `src/background/mcp/manager.ts` | Connection lifecycle |
| Tools Module | `src/background/mcp/tools.ts` | Tool discovery & execution |

### 3. MCP Client Library

| Component | File | Purpose |
|-----------|------|---------|
| McpSSEClient | `src/mcp/client/McpSSEClient.ts` | Main orchestrator class |
| TransportDetector | `src/mcp/client/transportDetector.ts` | POST vs GET detection |
| StreamProcessor | `src/mcp/client/streamProcessor.ts` | SSE stream parsing |
| RequestManager | `src/mcp/client/requestManager.ts` | Request/response handling |
| ConnectionManager | `src/mcp/client/connectionManager.ts` | Reconnection logic |
| MessageHandler | `src/mcp/client/messageHandler.ts` | Message routing |
| ErrorHandler | `src/mcp/client/errorHandler.ts` | Error categorization |

### 4. OAuth & Discovery

| Module | File | Purpose |
|--------|------|---------|
| Discovery | `src/mcp/discovery.ts` | RFC 9728/8414 metadata discovery |
| OAuth | `src/mcp/oauth.ts` | Token management, DCR |
| Auth Helpers | `src/mcp/authHelpers.ts` | Token refresh scheduling |
| Scope Handler | `src/mcp/scopeHandler.ts` | OAuth scope management |

### 5. State Management

| Module | File | Purpose |
|--------|------|---------|
| State | `src/mcp/state.ts` | Centralized server state |
| Events | `src/mcp/events.ts` | Status broadcast |
| Tools Config | `src/mcp/toolsConfig.ts` | Disabled tools management |

---

## Connection Flow

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           MCP SERVER CONNECTION FLOW                              │
└──────────────────────────────────────────────────────────────────────────────────┘

User clicks "Enable" on MCP Server
            │
            ▼
┌───────────────────────────────────────┐
│  1. enableMcpServer(serverId)         │
│     (src/background/mcp/manager.ts)   │
│                                       │
│  • Set isEnabled = true               │
│  • Store in chrome.storage            │
│  • Update keep-alive state            │
└───────────────────┬───────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ Requires Auth?        │
        └───────────┬───────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌───────────────┐       ┌───────────────┐
│  YES          │       │  NO           │
│               │       │               │
│ Check tokens  │       │ Connect       │
│ in storage    │       │ directly      │
└───────┬───────┘       └───────┬───────┘
        │                       │
        ▼                       │
┌───────────────────────┐       │
│ Has valid tokens?     │       │
└───────────┬───────────┘       │
            │                   │
    ┌───────┴───────┐           │
    │               │           │
    ▼               ▼           │
┌───────┐     ┌───────────┐     │
│ YES   │     │ NO        │     │
│       │     │           │     │
│Connect│     │Return     │     │
│       │     │"Auth      │     │
│       │     │Required"  │     │
└───┬───┘     └───────────┘     │
    │                           │
    └───────────────────────────┤
                                │
                                ▼
┌───────────────────────────────────────┐
│  2. connectMcpServer(serverId)        │
│     (src/background/mcp/manager.ts)   │
│                                       │
│  • Get server config                  │
│  • Ensure valid token (if auth req)   │
│  • Create McpSSEClient instance       │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│  3. McpSSEClient.connect()            │
│     (src/mcp/client/McpSSEClient.ts)  │
│                                       │
│  • TransportDetector.detectAndConnect │
│  • Try POST first (Streamable HTTP)   │
│  • Fall back to GET (HTTP+SSE)        │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│  4. McpSSEClient.initialize()         │
│                                       │
│  • Send 'initialize' request          │
│  • Send 'notifications/initialized'   │
│  • Fetch available tools              │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│  5. Connection Established            │
│                                       │
│  • Status: 'connected'                │
│  • Tools cached in state              │
│  • Broadcast status update            │
└───────────────────────────────────────┘
```

---

## OAuth Authentication Flow

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           OAUTH 2.0 AUTHENTICATION FLOW                           │
│                    (with Dynamic Client Registration - RFC 7591)                  │
└──────────────────────────────────────────────────────────────────────────────────┘

User clicks "Connect" on authenticated MCP Server
            │
            ▼
┌───────────────────────────────────────┐
│  1. startOAuthFlow(serverId)          │
│     (src/background/mcp/auth.ts)      │
│                                       │
│  Status: 'connecting'                 │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│  2. OAuth Discovery                   │
│     (src/mcp/discovery.ts)            │
│                                       │
│  discoverOAuthEndpoints(mcpUrl)       │
│                                       │
│  Discovery Methods (parallel):        │
│  ├─ Protected Resource Metadata       │
│  │  (RFC 9728)                        │
│  │  GET /.well-known/oauth-protected- │
│  │      resource{/path}               │
│  │                                    │
│  └─ Authorization Server Metadata     │
│     (RFC 8414)                        │
│     GET /.well-known/oauth-           │
│         authorization-server          │
│     GET /.well-known/openid-          │
│         configuration                 │
│                                       │
│  Returns: OAuthEndpoints {            │
│    authorization_endpoint             │
│    token_endpoint                     │
│    registration_endpoint              │
│    scopes_supported                   │
│  }                                    │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│  3. Dynamic Client Registration       │
│     (src/mcp/oauth.ts)                │
│                                       │
│  Status: 'registering'                │
│                                       │
│  POST {registration_endpoint}         │
│  Body: {                              │
│    client_name: "Chrome AI Extension" │
│    redirect_uris: [chrome.identity    │
│                    .getRedirectURL()] │
│    grant_types: ["authorization_code",│
│                  "refresh_token"]     │
│    response_types: ["code"]           │
│    scope: "..."                       │
│  }                                    │
│                                       │
│  Response: DynamicClientCredentials { │
│    client_id                          │
│    client_secret                      │
│    redirect_uris                      │
│  }                                    │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│  4. Build Authorization URL           │
│     (src/mcp/oauth.ts)                │
│                                       │
│  Status: 'authorizing'                │
│                                       │
│  buildAuthUrl() creates:              │
│  {authorization_endpoint}?            │
│    response_type=code&                │
│    client_id={client_id}&             │
│    redirect_uri={redirect_uri}&       │
│    state={random_csrf_token}&         │
│    scope={scopes}                     │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│  5. Launch OAuth Flow                 │
│     (Chrome Identity API)             │
│                                       │
│  chrome.identity.launchWebAuthFlow({  │
│    url: authUrl,                      │
│    interactive: true                  │
│  })                                   │
│                                       │
│  User sees OAuth consent screen       │
│  User approves or denies              │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│  6. Handle Redirect                   │
│                                       │
│  Redirect URL contains:               │
│  ?code={authorization_code}&          │
│   state={csrf_token}                  │
│                                       │
│  Validate state matches stored value  │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│  7. Exchange Code for Tokens          │
│     (src/mcp/oauth.ts)                │
│                                       │
│  POST {token_endpoint}                │
│  Headers:                             │
│    Authorization: Basic {base64(      │
│      client_id:client_secret)}        │
│    Content-Type: application/         │
│      x-www-form-urlencoded            │
│  Body:                                │
│    grant_type=authorization_code&     │
│    code={code}&                       │
│    redirect_uri={redirect_uri}        │
│                                       │
│  Response: McpOAuthTokens {           │
│    access_token                       │
│    refresh_token                      │
│    token_type: "Bearer"               │
│    expires_in                         │
│  }                                    │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│  8. Store & Schedule Refresh          │
│                                       │
│  • Store tokens in chrome.storage     │
│  • Store client credentials           │
│  • Schedule token refresh alarm       │
│  • Update granted scopes              │
│                                       │
│  Status: 'authenticated'              │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│  9. Auto-Connect (if enabled)         │
│                                       │
│  connectMcpServer(serverId)           │
│  → Proceeds to Connection Flow        │
└───────────────────────────────────────┘
```



---

## Transport Protocols

The MCP client supports two transport protocols, automatically detecting which one the server supports:

### 1. Streamable HTTP (POST) - MCP Protocol Version 2025-06-18

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        STREAMABLE HTTP TRANSPORT                                 │
│                        (Preferred - Newer Protocol)                              │
└─────────────────────────────────────────────────────────────────────────────────┘

Client                                                              Server
   │                                                                   │
   │  POST /mcp                                                        │
   │  Headers:                                                         │
   │    Accept: text/event-stream, application/json                    │
   │    Content-Type: application/json                                 │
   │    MCP-Protocol-Version: 2025-06-18                              │
   │    Authorization: Bearer {token}                                  │
   │  Body: {                                                          │
   │    jsonrpc: "2.0",                                                │
   │    id: 1,                                                         │
   │    method: "initialize",                                          │
   │    params: { protocolVersion, capabilities, clientInfo }          │
   │  }                                                                │
   │ ─────────────────────────────────────────────────────────────────►│
   │                                                                   │
   │  HTTP 200 OK                                                      │
   │  Headers:                                                         │
   │    Content-Type: text/event-stream                                │
   │    Mcp-Session-Id: {session-id}                                   │
   │  Body (SSE):                                                      │
   │    data: {"jsonrpc":"2.0","id":1,"result":{...}}                 │
   │◄─────────────────────────────────────────────────────────────────│
   │                                                                   │
   │  Subsequent requests use same endpoint with session ID            │
   │  POST /mcp                                                        │
   │  Headers:                                                         │
   │    Mcp-Session-Id: {session-id}                                   │
   │ ─────────────────────────────────────────────────────────────────►│
   │                                                                   │

Key Characteristics:
• Single endpoint for all requests
• Session ID in headers for request correlation
• Each request gets its own response stream
• Stream closes after response (normal behavior)
```

### 2. HTTP+SSE (GET) - MCP Protocol Version 2024-11-05

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           HTTP+SSE TRANSPORT                                     │
│                        (Fallback - Older Protocol)                               │
└─────────────────────────────────────────────────────────────────────────────────┘

Client                                                              Server
   │                                                                   │
   │  GET /sse                                                         │
   │  Headers:                                                         │
   │    Accept: text/event-stream                                      │
   │    MCP-Protocol-Version: 2025-06-18                              │
   │    Authorization: Bearer {token}                                  │
   │ ─────────────────────────────────────────────────────────────────►│
   │                                                                   │
   │  HTTP 200 OK (SSE Stream Opens)                                   │
   │  Content-Type: text/event-stream                                  │
   │                                                                   │
   │  event: endpoint                                                  │
   │  data: /sse/message?sessionId={session-id}                       │
   │◄─────────────────────────────────────────────────────────────────│
   │                                                                   │
   │  POST /sse/message?sessionId={session-id}                        │
   │  Body: { jsonrpc: "2.0", id: 1, method: "initialize", ... }      │
   │ ─────────────────────────────────────────────────────────────────►│
   │                                                                   │
   │  Response comes via SSE stream:                                   │
   │  event: message                                                   │
   │  data: {"jsonrpc":"2.0","id":1,"result":{...}}                   │
   │◄─────────────────────────────────────────────────────────────────│
   │                                                                   │
   │  SSE stream stays open for server-initiated messages              │
   │                                                                   │

Key Characteristics:
• Separate endpoints for SSE stream and POST requests
• Server provides message endpoint via 'endpoint' event
• Long-lived SSE connection for receiving responses
• Session ID in query parameter
```

### Transport Detection Logic

```typescript
// src/mcp/client/transportDetector.ts

async detectAndConnect(messageId: number): Promise<Response> {
    // Step 1: Try POST (Streamable HTTP)
    try {
        response = await fetch(sseUrl, {
            method: 'POST',
            headers: { 'MCP-Protocol-Version': '2025-06-18', ... },
            body: JSON.stringify({ method: 'initialize', ... })
        });
        
        if (response.ok) {
            this.transportType = 'streamable-http';
            return response;
        }
        
        if (response.status === 405) {
            // Server doesn't support POST, try GET
            throw new Error('Method not allowed, try GET');
        }
    } catch (error) {
        // Fall through to GET
    }
    
    // Step 2: Fall back to GET (HTTP+SSE)
    response = await fetch(sseUrl, {
        method: 'GET',
        headers: { 'Accept': 'text/event-stream', ... }
    });
    
    this.transportType = 'http-sse';
    return response;
}
```

---

## Tool Execution Flow

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              TOOL EXECUTION FLOW                                  │
│                         (Proxy Pattern via Background)                            │
└──────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                AI CHAT SESSION                                   │
│                                                                                  │
│  User: "Create a new page in Notion called 'Meeting Notes'"                     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  1. AI SDK Tool Resolution                                                       │
│     (src/ai/mcp/proxy.ts)                                                        │
│                                                                                  │
│  getMCPToolsFromBackground() returns proxy tools:                               │
│                                                                                  │
│  tools = {                                                                       │
│    "notion_create_page": {                                                       │
│      description: "Create a new page in Notion",                                │
│      parameters: z.object({ title: z.string(), ... }),                          │
│      execute: async (args) => {                                                 │
│        // Proxy to background                                                   │
│        return chrome.runtime.sendMessage({                                      │
│          type: 'mcp/notion/tool/call',                                          │
│          payload: { name: 'notion_create_page', arguments: args }               │
│        });                                                                       │
│      }                                                                           │
│    },                                                                            │
│    ...                                                                           │
│  }                                                                               │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ AI model selects tool
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  2. Proxy Tool Execution                                                         │
│                                                                                  │
│  tools["notion_create_page"].execute({                                          │
│    title: "Meeting Notes",                                                       │
│    parent_id: "..."                                                              │
│  })                                                                              │
│                                                                                  │
│  → chrome.runtime.sendMessage({                                                 │
│      type: 'mcp/notion/tool/call',                                              │
│      payload: {                                                                  │
│        name: 'notion_create_page',                                              │
│        arguments: { title: "Meeting Notes", ... }                               │
│      }                                                                           │
│    })                                                                            │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Chrome messaging
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  3. Background Handler                                                           │
│     (src/background/messaging/mcpHandler.ts)                                     │
│                                                                                  │
│  handleMcpMessage(message) {                                                    │
│    // Parse: mcp/{serverId}/{action}                                            │
│    serverId = "notion"                                                           │
│    action = "tool/call"                                                          │
│                                                                                  │
│    → callServerTool(serverId, name, args)                                       │
│  }                                                                               │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  4. Tool Execution via Persistent Connection                                     │
│     (src/background/mcp/tools.ts)                                                │
│                                                                                  │
│  callServerTool(serverId, name, args) {                                         │
│    const state = getServerState(serverId);                                      │
│    return state.client.callTool(name, args);                                    │
│  }                                                                               │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  5. MCP Protocol Request                                                         │
│     (src/mcp/client/requestManager.ts)                                           │
│                                                                                  │
│  sendRequest('tools/call', {                                                    │
│    name: 'notion_create_page',                                                  │
│    arguments: { title: "Meeting Notes", ... }                                   │
│  })                                                                              │
│                                                                                  │
│  POST {mcp_endpoint}                                                             │
│  Headers:                                                                        │
│    Authorization: Bearer {access_token}                                          │
│    Mcp-Session-Id: {session_id}                                                  │
│  Body: {                                                                         │
│    jsonrpc: "2.0",                                                               │
│    id: 42,                                                                       │
│    method: "tools/call",                                                         │
│    params: {                                                                     │
│      name: "notion_create_page",                                                │
│      arguments: { title: "Meeting Notes", ... }                                 │
│    }                                                                             │
│  }                                                                               │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTPS
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  6. MCP Server (Notion)                                                          │
│                                                                                  │
│  • Validates token                                                               │
│  • Executes tool logic                                                           │
│  • Creates page via Notion API                                                   │
│  • Returns result                                                                │
│                                                                                  │
│  Response: {                                                                     │
│    jsonrpc: "2.0",                                                               │
│    id: 42,                                                                       │
│    result: {                                                                     │
│      content: [{ type: "text", text: "Page created: ..." }]                     │
│    }                                                                             │
│  }                                                                               │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Response bubbles back
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  7. Result Returned to AI                                                        │
│                                                                                  │
│  AI receives tool result and generates response:                                │
│  "I've created a new page called 'Meeting Notes' in your Notion workspace."     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## State Management

### Server State Structure

```typescript
// src/mcp/state.ts

interface ServerState {
    /** SSE client instance for this server */
    client: McpSSEClient | null;
    
    /** OAuth tokens for authentication */
    tokens: McpOAuthTokens | null;
    
    /** Dynamic client credentials from registration */
    credentials: DynamicClientCredentials | null;
    
    /** Current server status */
    status: McpServerStatus;
    
    /** Discovered OAuth endpoints */
    oauthEndpoints: OAuthEndpoints | null;
    
    /** OAuth state for CSRF protection */
    oauthState: OAuthState | null;
    
    /** Whether this server is currently enabled */
    isEnabled: boolean;
}

// Global state map
const serverStates = new Map<string, ServerState>();
```

### Connection States

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           MCP CONNECTION STATES                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │  disconnected   │ ◄─── Initial state
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              │              ▼
    ┌─────────────────┐      │     ┌─────────────────┐
    │   needs-auth    │      │     │   connecting    │ (no auth required)
    └────────┬────────┘      │     └────────┬────────┘
             │               │              │
             ▼               │              │
    ┌─────────────────┐      │              │
    │   registering   │      │              │
    └────────┬────────┘      │              │
             │               │              │
             ▼               │              │
    ┌─────────────────┐      │              │
    │   authorizing   │      │              │
    └────────┬────────┘      │              │
             │               │              │
             ▼               │              │
    ┌─────────────────┐      │              │
    │  authenticated  │      │              │
    └────────┬────────┘      │              │
             │               │              │
             ▼               │              │
    ┌─────────────────┐      │              │
    │   connecting    │◄─────┘              │
    └────────┬────────┘                     │
             │                              │
             └──────────────┬───────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │    connected    │ ◄─── Fully operational
                   └────────┬────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐
    │    error    │  │token-refresh│  │ cloudflare-error│
    └─────────────┘  └─────────────┘  └─────────────────┘
              │             │             │
              └─────────────┼─────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │  invalid-token  │ ──► Requires re-auth
                   └─────────────────┘
```

### Chrome Storage Keys

| Key Pattern | Purpose |
|-------------|---------|
| `mcp.{serverId}.enabled` | Server enabled state |
| `oauth.{serverId}.tokens` | OAuth access/refresh tokens |
| `oauth.{serverId}.client` | Dynamic client credentials |
| `mcp.{serverId}.oauth.endpoints` | Discovered OAuth endpoints |
| `oauth.{serverId}.granted_scopes` | Granted OAuth scopes |
| `oauth.{serverId}.challenged_scopes` | Scopes from 401 challenge |
| `mcp.{serverId}.tools.disabled` | Disabled tool names |
| `mcp.{serverId}.sessionId` | MCP session ID (for reconnection) |
| `customMcpServers` | User-added custom servers |

---

## Error Handling

### Error Categories

```typescript
// src/errors/errorTypes.ts

class MCPError extends AppError {
    static connectionFailed(serverId: string, details: string): MCPError;
    static authFailed(serverId: string, details: string): MCPError;
    static toolExecutionFailed(serverId: string, toolName: string, details: string): MCPError;
    static cloudflareWorkerError(serverId: string, details: string): MCPError;
}

class NetworkError extends AppError {
    static timeout(message: string): NetworkError;
    static connectionRefused(message: string): NetworkError;
}
```

### Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ERROR HANDLING FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

Error Occurs
     │
     ▼
┌─────────────────────────────────────┐
│  ErrorHandler.categorizeError()     │
│  (src/mcp/client/errorHandler.ts)   │
│                                     │
│  Categorizes by:                    │
│  • HTTP status code                 │
│  • Error message patterns           │
│  • Network conditions               │
└─────────────────┬───────────────────┘
                  │
     ┌────────────┼────────────┬────────────┐
     │            │            │            │
     ▼            ▼            ▼            ▼
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐
│  Auth   │ │ Network │ │ Server  │ │ Cloudflare  │
│  Error  │ │  Error  │ │  Error  │ │   Error     │
│         │ │         │ │         │ │             │
│ 401/403 │ │ Timeout │ │ 500/502 │ │ Error 1101  │
│ Invalid │ │ No conn │ │ 503/504 │ │ Worker exc  │
│ token   │ │         │ │         │ │             │
└────┬────┘ └────┬────┘ └────┬────┘ └──────┬──────┘
     │           │           │             │
     └───────────┴───────────┴─────────────┘
                       │
                       ▼
┌─────────────────────────────────────┐
│  buildUserMessage(error)            │
│  (src/errors/errorMessages.ts)      │
│                                     │
│  Creates user-friendly message      │
│  based on error type                │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  Update Status & Broadcast          │
│                                     │
│  state.status = {                   │
│    state: 'error' | 'needs-auth',   │
│    error: userMessage               │
│  }                                  │
│                                     │
│  broadcastStatusUpdate(serverId,    │
│                        status)      │
└─────────────────────────────────────┘
```

### Retry Strategy

```typescript
// src/errors/retryManager.ts

const RetryPresets = {
    Quick: {
        maxRetries: 2,
        initialDelay: 500,
        maxDelay: 2000,
        backoffMultiplier: 2
    },
    Standard: {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2
    }
};

// Connection retry with exponential backoff
// Delay = min(initialDelay * (multiplier ^ attempt), maxDelay)
```

---

## Server Configuration

### Built-in Servers

```typescript
// src/constants/mcpServers.tsx

interface ServerConfig {
    id: string;                      // Unique identifier
    name: string;                    // Display name
    icon: React.ReactNode;           // Icon component
    url?: string;                    // MCP endpoint URL
    description: string;             // Server description
    requiresAuthentication: boolean; // OAuth required?
    paid?: boolean;                  // Paid service?
    isCustom?: boolean;              // User-added?
    headers?: KeyValuePair[];        // Custom HTTP headers
    oauth?: {                        // OAuth configuration
        scopes?: string[];           // Default scopes
        resource?: string;           // RFC 8707 resource
    };
}

// Example servers:
// - Notion (/mcp) - OAuth required
// - Linear (/sse) - OAuth required  
// - Ahrefs (/mcp) - OAuth required
// - Context7 (/mcp) - No auth
// - DeepWiki (/mcp) - No auth
```

### Custom Server Support

Users can add custom MCP servers with:
- Custom URL endpoint
- Optional authentication headers
- Custom icon (base64 image)

---

## Key Implementation Details

### 1. Keep-Alive Mechanism

The background service worker uses Chrome alarms to maintain persistent connections:

```typescript
// Token refresh alarms
chrome.alarms.create(`mcp-token-refresh-${serverId}`, {
    when: tokens.expires_at - TOKEN_REFRESH_BUFFER
});
```

### 2. Session Management

- **Streamable HTTP**: Session ID in `Mcp-Session-Id` header
- **HTTP+SSE**: Session ID in query parameter (`?sessionId=...`)
- Sessions are NOT reused for new client instances (prevents initialization errors)

### 3. Tool Filtering

Users can disable specific tools per server:

```typescript
// Stored in chrome.storage
`mcp.${serverId}.tools.disabled`: string[]

// Filtered during tool loading
const filteredTools = Object.entries(mcpTools)
    .filter(([name]) => !disabledTools.includes(name));
```

### 4. Scope Step-Up Authorization

Handles `insufficient_scope` errors by:
1. Parsing WWW-Authenticate header
2. Storing challenged scopes
3. Re-initiating OAuth with expanded scopes

---

## Summary

The Remote MCP integration provides a robust, production-ready implementation for connecting to external MCP servers with:

- **Dual transport support** (Streamable HTTP + HTTP+SSE)
- **Full OAuth 2.0 compliance** with Dynamic Client Registration
- **Persistent background connections** via service worker
- **Proxy pattern** for efficient tool execution
- **Comprehensive error handling** with user-friendly messages
- **Automatic token refresh** before expiration
- **Per-server isolation** preventing cascade failures
