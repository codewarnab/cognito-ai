# MCP (Model Context Protocol) Module

**MCP** stands for **Model Context Protocol**, an open standard for connecting AI models to external tools and data sources. This module implements the MCP client for the Cognito Chrome extension, enabling seamless integration with MCP-compliant servers.

## What is MCP?

Model Context Protocol (MCP) is a specification created by Anthropic that defines how AI applications can:
- **Discover** tools and resources available from external servers
- **Execute** tool calls requested by AI models
- **Read** resources like documents, databases, or APIs
- **Use** prompts and templates provided by servers

Learn more at the [MCP specification](https://modelcontextprotocol.io/).

## Module Structure

```
src/mcp/
├── README.md                # This file
├── types.ts                 # Type definitions for MCP protocol
├── client/                  # SSE-based MCP client implementation
│   ├── index.ts             # Barrel exports
│   ├── McpSSEClient.ts      # Main SSE client class
│   ├── config.ts            # Client configuration
│   ├── connectionManager.ts # Connection lifecycle management
│   ├── errorHandler.ts      # Error handling and recovery
│   ├── messageHandler.ts    # MCP message processing
│   ├── requestManager.ts    # Request/response tracking
│   ├── streamProcessor.ts   # SSE stream parsing
│   └── transportDetector.ts # Transport type detection
├── discovery.ts             # OAuth endpoint discovery (RFC 9728, RFC 8414)
├── oauth.ts                 # OAuth 2.0 with Dynamic Client Registration
├── authHelpers.ts           # Authentication utilities
├── scopeHandler.ts          # OAuth scope management
├── sseClient.ts             # SSE connection utilities
├── state.ts                 # Connection state management
├── toolsConfig.ts           # Tool enable/disable configuration
└── events.ts                # Event types and emitters
```

## Key Components

### McpSSEClient (`client/McpSSEClient.ts`)
The main MCP client implementation using Server-Sent Events (SSE) for real-time communication with MCP servers.

### Discovery (`discovery.ts`)
Implements OAuth discovery per RFC standards:
- **RFC 9728**: Protected Resource Metadata
- **RFC 8414**: Authorization Server Metadata

### OAuth (`oauth.ts`)
OAuth 2.0 implementation with:
- Dynamic Client Registration (RFC 7591)
- PKCE (Proof Key for Code Exchange)
- Token refresh and storage

### Types (`types.ts`)
Complete TypeScript definitions for:
- Connection states (`McpConnectionState`)
- Protocol messages (`McpMessage`, `McpTool`, `McpResource`, etc.)
- OAuth tokens and credentials
- Server configuration

## Usage

### Connecting to an MCP Server

```typescript
import { McpSSEClient } from '@/mcp/client';

const client = new McpSSEClient({
  serverUrl: 'https://mcp.example.com',
  serverId: 'example-server',
});

await client.connect();
const tools = await client.listTools();
```

### Executing a Tool

```typescript
const result = await client.callTool('tool_name', {
  argument1: 'value1',
  argument2: 'value2',
});
```

## Connection States

| State | Description |
|-------|-------------|
| `disconnected` | Not connected, ready to connect |
| `needs-auth` | OAuth authentication required |
| `registering` | Registering dynamic OAuth client |
| `authorizing` | User is authorizing via OAuth |
| `authenticated` | OAuth complete, not yet connected |
| `connecting` | Establishing SSE connection |
| `connected` | Fully operational |
| `error` | Connection error occurred |
| `token-refresh` | Refreshing expired OAuth token |

## Related Files

- **Store**: `src/stores/mcp/mcpStore.ts` - Zustand store for MCP state
- **Handler**: `src/background/messaging/mcpHandler.ts` - Background message handler
- **UI Components**: `src/components/features/mcp/` - MCP management UI

## See Also

- [WebMCP Module](../background/webmcp/README.md) - Browser-based MCP for web pages
- [MCP Specification](https://modelcontextprotocol.io/docs)
- [Anthropic MCP SDK](https://github.com/anthropics/mcp-sdk-js)
