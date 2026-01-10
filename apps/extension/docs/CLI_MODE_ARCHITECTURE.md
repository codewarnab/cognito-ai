# CLI Mode & MCP Architecture

This document details the architecture of the **Cognito Chrome Extension**, focusing on **CLI Mode**, **Model Context Protocol (MCP)** integration, and **WebMCP**.

---

## High-Level Architecture

The extension acts as a central hub connecting various AI providers and tools.

```text
                                  User
                                    │
                                    ▼
                           ┌──────────────────┐
                           │ Chrome Extension │
                           └────────┬─────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│ Local Environment│      │  MCP Ecosystem   │      │ Web Integration  │
│                  │      │                  │      │                  │
│  ┌────────────┐  │      │  ┌────────────┐  │      │  ┌────────────┐  │
│  │ Local      │◄─┼──────┼─►│ MCP Client │  │      │  │ WebMCP     │  │
│  │ Bridge     │  │      │  └─────┬──────┘  │      │  │ Manager    │  │
│  └─────┬──────┘  │      │        │         │      │  └─────┬──────┘  │
│        │         │      │        │         │      │        │         │
│        ▼         │      │        ▼         │      │        ▼         │
│  ┌────────────┐  │      │  ┌────────────┐  │      │  ┌────────────┐  │
│  │ Agent CLI  │  │      │  │ MCP Servers│  │      │  │ Active Tab │  │
│  └─────┬──────┘  │      │  │ (SSE/HTTP) │  │      │  │ Tools      │  │
│        │         │      │  └────────────┘  │      │  └────────────┘  │
│        ▼         │      │                  │      │                  │
│  ┌────────────┐  │      │                  │      │                  │
│  │ Local Files│  │      │                  │      │                  │
│  └────────────┘  │      │                  │      │                  │
└──────────────────┘      └──────────────────┘      └──────────────────┘
```


---

## 1. CLI Mode (Local Bridge)

Enables communication with a local agent CLI (Gemini CLI, Claude Code, Codex CLI) via a local bridge server.

### Components

*   **Extension (Side Panel)**:
    *   **Mode Selector**: Switches to `ToolsMode = 'cli'`.
    *   **Bridge Pairing**: secure OTP pairing with `@cognito/code-bridge`.
    *   **Chat Interface**: Streams responses from the CLI agent.
*   **Local Bridge (`@cognito/code-bridge`)**:
    *   Runs on `http://127.0.0.1:8787`.
    *   **SSE `/events`**: Real-time status streaming ("Starting agent...", "Connected...").
    *   **ACP Protocol**: Spawns and controls the agent CLI.
    *   **StdIO MCP**: Can spawn local MCP servers via StdIO and proxy them to the extension.

### Data Flow

1.  **Pairing**: User enters OTP -> Extension gets Token.
2.  **Chat**: Extension sends message -> Bridge via HTTP POST -> Bridge spawns Agent via ACP -> Agent streams response.
3.  **Events**: Bridge streams status/logs via SSE `/events` to Extension.

---

## 2. Model Context Protocol (MCP) Integration

The extension implements a full **MCP Client** capable of connecting to remote MCP servers via SSE.

### Directory Structure: `apps/extension/src/mcp/`

*   **`types.ts`**: Core MCP type definitions (JSON-RPC, Resources, Tools).
*   **`client/`**:
    *   `McpSSEClient.ts`: Main client implementation.
    *   `ConnectionManager.ts`: Handles reconnection fallback and lifecycle.
    *   `TransportDetector.ts`: Detects `Streamable HTTP` vs legacy `HTTP+SSE`.
    *   `discovery.ts`: Implements **RFC 9728** (Protected Resource Metadata) and **RFC 8414** (Auth Server Discovery).
    *   `oauth.ts`: Handles Dynamic Client Registration and OAuth 2.0 flows.

### Connection Features

*   **Transport Modes**:
    *   **Streamable HTTP**: Single connection for bidirectional streaming (efficient).
    *   **HTTP+SSE**: Separate streams for server->client and client->server (legacy).
*   **Authentication**:
    *   Supports OAuth 2.0 with PKCE.
    *   Auto-discovery of auth endpoints via `.well-known/oauth-protected-resource`.
*   **Reliability**:
    *   Automatic reconnection with exponential backoff.
    *   Session resumption support.

---

## 3. WebMCP (Web-based MCP)

**WebMCP** allows the active browser tab to expose tools to the AI agent safely.

### Directory: `apps/extension/src/background/webmcp/`

### Key Design Principles

1.  **Active Tab Only**: The manager *only* tracks tools from the currently active tab.
    *   Reduces memory usage.
    *   Prevents stale tools.
    *   Improves security (user is looking at the context).
2.  **Security Layers**:
    *   **Origin Validation**: Tools must match the active tab's domain.
    *   **Tab ID Validation**: Execution is restricted to the registering tab ID.
    *   **Schema Validation**: Inputs are validated against `inputSchema` before execution.

### Discovery Flow

1.  **Tab Activation**: User switches to a tab.
2.  **Discovery**: Extension clears old tools -> requests `webmcp/tools/refresh` from content script.
3.  **Registration**: Content script sends available tools -> Manager validates & stores them.
4.  **Execution**: Agent calls tool -> Manager validates -> sends `webmcp/tool/execute` to tab.

---

## 4. Background Architecture

The background service worker acts as a central orchestrator.

### File: `apps/extension/src/entrypoints/background.ts`

Orchestrates initialization of all modules:
*   Initializes `LoggerConfigManager`.
*   Sets up `OAuthRedirectURI`.
*   Starts `WebMCPManager`.
*   Delegates message handling to **Router**.

### Message Router: `apps/extension/src/background/messaging/router.ts`

Centralizes all incoming `chrome.runtime.onMessage` events and routes them:
*   **`handleMcpMessage`**: Routes `mcp/*` messages to specific MCP clients.
*   **`handleWebMCPMessage`**: Routes WebMCP discovery/execution messages.
*   **`handleUiMessage`**: Handles UI actions (Sidebar toggles, etc.).
*   **`handleSummarize` / `handleWrite`**: Routes AI task requests.

---

## 5. Security Considerations

1.  **Local Bridge**:
    *   Binds only to `127.0.0.1`.
    *   Requires Pairing Token for all sensitive endpoints.
    *   CORS restricted to Extension ID.
2.  **MCP**:
    *   OAuth tokens stored securely in `chrome.storage.local`.
    *   Explicit user approval flow for connecting new servers.
3.  **WebMCP**:
    *   Strict Origin and Tab ID checks prevent cross-site tool injection ("Tool Shadowing").
    *   Tools are cleared immediately when the tab is closed or backgrounded.

---

## 6. Configuration

### Gemini CLI (`~/.gemini/settings.json`)

To configure the Gemini CLI to use the Cognito local bridge, update your `settings.json`.

> [!WARNING]
> Do NOT include a `type` field in the `mcpServers` configuration. This will cause an `Unrecognized key(s) in object: 'type'` error.

**Correct Configuration:**

```json
{
  "mcpServers": {
    "cognito": {
      "url": "http://127.0.0.1:8787/mcp",
      "trust": true
    }
  }
}
```

### Protocol Details

- **Transport**: SSE (Server-Sent Events)
- **URL**: `http://127.0.0.1:8787/mcp`
- **Scope**: User (global)

