# WebMCP Integration into AI SDK: Technical Analysis & Implementation Guide

**Author:** Cognito Team  
**Date:** December 11, 2024  
**Status:** Draft for WIP Pull Request

---

## Executive Summary

This report outlines a comprehensive plan to add first-class **WebMCP** (browser-based Model Context Protocol) support to the Vercel AI SDK. WebMCP enables AI applications running in browser environments (Chrome extensions, web apps, etc.) to discover and interact with MCP servers embedded in websites via `postMessage`-based transport.

The goal is to make WebMCP as easy to use as the existing HTTP and SSE transports, while maintaining flexibility for different browser contexts (content scripts, service workers, iframes).

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [What is WebMCP?](#what-is-webmcp)
3. [Proposed Architecture](#proposed-architecture)
4. [Implementation Plan](#implementation-plan)
5. [API Design](#api-design)
6. [Testing Strategy](#testing-strategy)
7. [Documentation Updates](#documentation-updates)
8. [Draft PR Scope](#draft-pr-scope)

---

## Current State Analysis

### AI SDK MCP Package (`@ai-sdk/mcp`)

The current AI SDK MCP implementation in `packages/mcp/` provides:

| Component | Location | Description |
|-----------|----------|-------------|
| `MCPClient` | `mcp-client.ts` | Lightweight MCP client for tool conversion |
| `MCPTransport` | `mcp-transport.ts` | Transport interface definition |
| `HttpMCPTransport` | `mcp-http-transport.ts` | Streamable HTTP transport |
| `SseMCPTransport` | `mcp-sse-transport.ts` | Server-Sent Events transport |
| `StdioMCPTransport` | `mcp-stdio/` | Local stdio transport (Node.js only) |
| OAuth Support | `oauth.ts`, `oauth-types.ts` | OAuth 2.0/PKCE authentication |

#### Transport Factory Pattern

```typescript
// Current createMcpTransport implementation
export function createMcpTransport(config: MCPTransportConfig): MCPTransport {
  switch (config.type) {
    case 'sse':
      return new SseMCPTransport(config);
    case 'http':
      return new HttpMCPTransport(config);
    default:
      throw new MCPClientError({
        message: 'Unsupported transport configuration...',
      });
  }
}
```

#### Transport Interface

```typescript
export interface MCPTransport {
  start(): Promise<void>;
  send(message: JSONRPCMessage): Promise<void>;
  close(): Promise<void>;
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;
}
```

### Chrome Extension WebMCP Implementation

Our Cognito Chrome extension has a working WebMCP implementation:

| Component | Location | Description |
|-----------|----------|-------------|
| Content Script | `webmcp-proxy.ts` | Discovers WebMCP tools from pages |
| AI Tools Converter | `webmcpTools.ts` | Converts MCP tools to AI SDK format |
| TabClientTransport | `@mcp-b/transports` | External postMessage-based transport |
| Manager | `background/webmcp/` | State management and routing |

#### Key Insight: Tool Conversion Pattern

```typescript
// Current tool conversion (converts MCP tools to AI SDK tools)
function convertWebMCPToolsToAITools(webmcpTools: WebMCPTool[]): Record<string, unknown> {
  const tools: Record<string, unknown> = {};
  
  for (const webmcpTool of webmcpTools) {
    const zodSchema = convertToZodSchema(webmcpTool.inputSchema);
    
    tools[toolName] = {
      description: `[WebMCP - ${webmcpTool.domain}] ${webmcpTool.description}`,
      inputSchema: zodSchema,
      execute: async (args) => {
        // Routes through background service worker
        return chrome.runtime.sendMessage({
          type: 'webmcp/tool/call',
          payload: { toolName, args },
        });
      },
    };
  }
  
  return tools;
}
```

---

## What is WebMCP?

WebMCP is a browser-native transport mechanism for MCP that uses `postMessage` to communicate between:
- **Content Scripts** ↔ **Page Scripts** (same tab)
- **Iframes** ↔ **Parent Windows**
- **Extension Background** ↔ **Content Scripts** (via Chrome messaging)

### Use Cases

| Environment | Description | Example |
|-------------|-------------|---------|
| Chrome Extensions | Extension discovers tools from active tab | Cognito AI Assistant |
| Web Applications | SPA connects to embedded MCP server | AI-powered web dashboard |
| Iframes | Parent page uses tools from iframe | Embedded AI widget |
| Cross-Origin | Secure cross-origin tool sharing | OAuth-protected MCP servers |

### Transport Mechanism

```
┌──────────────────────┐     postMessage      ┌──────────────────────┐
│   MCP Client         │◄───────────────────►│   WebMCP Server      │
│   (Content Script)   │                      │   (Page Script)      │
│                      │                      │                      │
│   TabClientTransport │     JSON-RPC         │   TabServerTransport │
└──────────────────────┘                      └──────────────────────┘
```

---

## Proposed Architecture

### Option A: Native WebMCP Transport (Recommended)

Add a new `WebMCPTransport` class directly to `@ai-sdk/mcp`:

```
packages/mcp/
├── src/
│   ├── tool/
│   │   ├── mcp-transport.ts          # Add 'webmcp' type
│   │   ├── mcp-http-transport.ts     # Existing
│   │   ├── mcp-sse-transport.ts      # Existing
│   │   ├── mcp-webmcp-transport.ts   # NEW: Browser postMessage transport
│   │   └── ...
│   └── index.ts                       # Export WebMCP transport
```

### Option B: Plugin/Extension Pattern

Allow external transports to be registered:

```typescript
// User brings their own transport (already supported)
const mcpClient = await createMCPClient({
  transport: new TabClientTransport({ targetOrigin: window.location.origin }),
});
```

### Recommendation: Hybrid Approach

1. **Option A** for core postMessage support (browser-native, no external deps)
2. **Option B** for advanced use cases (Chrome extension APIs, custom routing)

---

## Implementation Plan

### Phase 1: Core WebMCP Transport

#### 1.1 Create `mcp-webmcp-transport.ts`

A new transport that:
- Uses `window.postMessage` for communication
- Handles message serialization/deserialization
- Supports origin validation for security
- Works in both client and server roles

```typescript
export class WebMCPTransport implements MCPTransport {
  private port?: MessagePort;
  private targetOrigin: string;
  private messageChannel?: MessageChannel;
  
  constructor(options: WebMCPTransportConfig) {
    this.targetOrigin = options.targetOrigin || '*';
  }
  
  async start(): Promise<void> {
    // Create MessageChannel for bidirectional communication
    this.messageChannel = new MessageChannel();
    this.port = this.messageChannel.port1;
    
    this.port.onmessage = (event) => {
      const message = JSONRPCMessageSchema.parse(event.data);
      this.onmessage?.(message);
    };
    
    // Post handshake to target (page script, iframe, etc.)
    window.postMessage({
      type: 'mcp:connect',
      port: this.messageChannel.port2,
    }, this.targetOrigin, [this.messageChannel.port2]);
  }
  
  async send(message: JSONRPCMessage): Promise<void> {
    this.port?.postMessage(message);
  }
  
  async close(): Promise<void> {
    this.port?.close();
    this.onclose?.();
  }
  
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;
}
```

#### 1.2 Update Transport Factory

```typescript
export type MCPTransportConfig = {
  type: 'sse' | 'http' | 'webmcp';  // Add 'webmcp'
  url?: string;
  headers?: Record<string, string>;
  authProvider?: OAuthClientProvider;
  
  // WebMCP-specific options
  targetOrigin?: string;
  targetWindow?: Window;
};

export function createMcpTransport(config: MCPTransportConfig): MCPTransport {
  switch (config.type) {
    case 'sse':
      return new SseMCPTransport(config);
    case 'http':
      return new HttpMCPTransport(config);
    case 'webmcp':
      return new WebMCPTransport(config);  // NEW
    default:
      throw new MCPClientError({...});
  }
}
```

### Phase 2: Chrome Extension Utilities (Optional Package)

For Chrome extension-specific functionality:

```
packages/mcp-browser/  # NEW optional package
├── src/
│   ├── chrome-extension-transport.ts   # Chrome runtime.sendMessage
│   ├── content-script-discovery.ts     # Auto-discover WebMCP on pages
│   ├── tab-transport.ts                # Re-export from @mcp-b/transports
│   └── index.ts
```

### Phase 3: Server-Side WebMCP Support

For websites wanting to expose MCP servers:

```typescript
// Website exposes tools via WebMCP
const server = new WebMCPServer({
  tools: {
    'search': { ... },
    'getData': { ... },
  },
});

server.listen(); // Listens for postMessage connections
```

---

## API Design

### Client Usage (Recommended API)

```typescript
import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp';

// Option 1: Built-in WebMCP transport
const mcpClient = await createMCPClient({
  transport: {
    type: 'webmcp',
    targetOrigin: 'https://example.com',  // Security: validate origin
    targetWindow: window,                   // Optional: default is window
  },
});

// Option 2: Custom transport (current pattern, still supported)
import { TabClientTransport } from '@mcp-b/transports';

const mcpClient = await createMCPClient({
  transport: new TabClientTransport({
    targetOrigin: window.location.origin,
  }),
});

// Use tools normally
const tools = await mcpClient.tools();
const result = await streamText({
  model: google('gemini-2.0-flash'),
  tools,
  prompt: 'Search for recent news',
});
```

### Configuration Options

```typescript
interface WebMCPTransportConfig {
  type: 'webmcp';
  
  /**
   * Target origin for postMessage security.
   * Use '*' only for development.
   * @default '*'
   */
  targetOrigin?: string;
  
  /**
   * Target window to communicate with.
   * @default window
   */
  targetWindow?: Window;
  
  /**
   * Message channel name for disambiguation.
   * Useful when multiple WebMCP connections exist.
   */
  channelId?: string;
  
  /**
   * Connection timeout in milliseconds.
   * @default 5000
   */
  timeout?: number;
}
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('WebMCPTransport', () => {
  it('should establish connection via postMessage', async () => {
    const transport = new WebMCPTransport({
      targetOrigin: '*',
    });
    
    await transport.start();
    expect(transport.isConnected).toBe(true);
  });
  
  it('should send and receive JSON-RPC messages', async () => {
    const transport = new WebMCPTransport({...});
    const messages: JSONRPCMessage[] = [];
    transport.onmessage = (msg) => messages.push(msg);
    
    await transport.send({ jsonrpc: '2.0', method: 'test' });
    // Verify message was received
  });
  
  it('should validate origin for security', async () => {
    const transport = new WebMCPTransport({
      targetOrigin: 'https://trusted.com',
    });
    
    // Should reject messages from untrusted origins
  });
});
```

### Integration Tests

1. **Browser E2E Tests**: Playwright/Puppeteer tests with real browser
2. **Chrome Extension Tests**: Load extension, navigate to WebMCP page
3. **Cross-Origin Tests**: Verify security with different origins

### Example Test Page

Create a test WebMCP server page:

```html
<!-- test-webmcp-server.html -->
<script type="module">
  import { TabServerTransport } from '@mcp-b/transports';
  import { Server } from '@modelcontextprotocol/sdk/server';
  
  const server = new Server({ name: 'test-server', version: '1.0.0' });
  const transport = new TabServerTransport();
  
  server.setRequestHandler('tools/list', () => ({
    tools: [{ name: 'test_tool', description: 'A test tool' }],
  }));
  
  await server.connect(transport);
</script>
```

---

## Documentation Updates

### New Documentation Files

1. **`content/docs/03-ai-sdk-core/17-webmcp-tools.mdx`**

```mdx
---
title: WebMCP (Browser-based MCP)
description: Connect to MCP servers embedded in web pages
---

# WebMCP (Browser-based MCP)

WebMCP enables AI applications in browser environments to discover and use 
tools from websites that implement the Model Context Protocol.

## Use Cases

- Chrome extensions discovering tools from active tabs
- Web apps connecting to embedded AI services
- Cross-origin tool sharing with iframes

## Quick Start

\`\`\`typescript
import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp';

const mcpClient = await createMCPClient({
  transport: {
    type: 'webmcp',
    targetOrigin: 'https://api.example.com',
  },
});

const tools = await mcpClient.tools();
\`\`\`

## Security

Always specify `targetOrigin` to prevent cross-origin attacks...
```

2. **`content/cookbook/01-next/74-webmcp-tools.mdx`**
3. **Update `content/docs/03-ai-sdk-core/16-mcp-tools.mdx`** to reference WebMCP

---

## Draft PR Scope

### Phase 1 PR: Core WebMCP Transport

**Title:** `feat(mcp): Add WebMCP transport for browser environments`

**Files to Create/Modify:**

| File | Status | Description |
|------|--------|-------------|
| `packages/mcp/src/tool/mcp-webmcp-transport.ts` | NEW | WebMCP transport implementation |
| `packages/mcp/src/tool/mcp-webmcp-transport.test.ts` | NEW | Unit tests |
| `packages/mcp/src/tool/mcp-transport.ts` | MODIFY | Add 'webmcp' type, update factory |
| `packages/mcp/src/index.ts` | MODIFY | Export WebMCPTransport |
| `content/docs/03-ai-sdk-core/16-mcp-tools.mdx` | MODIFY | Add WebMCP section |

### Changeset

```md
---
"@ai-sdk/mcp": minor
---

Added experimental WebMCP transport for browser environments.

WebMCP enables MCP connections via `postMessage`, allowing:
- Chrome extensions to discover tools from web pages
- Web apps to connect to embedded MCP servers
- Cross-origin tool sharing with iframes

Usage:
\`\`\`typescript
const mcpClient = await createMCPClient({
  transport: {
    type: 'webmcp',
    targetOrigin: 'https://example.com',
  },
});
\`\`\`
```

---

## Code References

### From Our Chrome Extension

| File | Purpose |
|------|---------|
| [`webmcp-proxy.ts`](file:///c:/Users/User/code/hackathons/chrome-ai/src/contents/webmcp-proxy.ts) | Content script that discovers WebMCP tools |
| [`webmcpTools.ts`](file:///c:/Users/User/code/hackathons/chrome-ai/src/ai/tools/webmcpTools.ts) | Converts MCP tools to AI SDK format |
| [`WEBMCP_INTEGRATION.md`](file:///c:/Users/User/code/hackathons/chrome-ai/docs/WEBMCP_INTEGRATION.md) | Comprehensive architecture documentation |

### From AI SDK

| File | Purpose |
|------|---------|
| [`mcp-transport.ts`](file:///c:/Users/User/code/hackathons/chrome-ai/ai/packages/mcp/src/tool/mcp-transport.ts) | Transport interface and factory |
| [`mcp-client.ts`](file:///c:/Users/User/code/hackathons/chrome-ai/ai/packages/mcp/src/tool/mcp-client.ts) | MCP client implementation |
| [`mcp-http-transport.ts`](file:///c:/Users/User/code/hackathons/chrome-ai/ai/packages/mcp/src/tool/mcp-http-transport.ts) | HTTP transport (reference for implementation) |
| [`16-mcp-tools.mdx`](file:///c:/Users/User/code/hackathons/chrome-ai/ai/content/docs/03-ai-sdk-core/16-mcp-tools.mdx) | Current MCP documentation |

---

## Next Steps

1. **[ ] Create WebMCP transport implementation**  
   Start with a minimal `mcp-webmcp-transport.ts`

2. **[ ] Add unit tests**  
   Cover basic message passing and origin validation

3. **[ ] Update transport factory**  
   Add 'webmcp' type to `createMcpTransport`

4. **[ ] Write documentation**  
   Add WebMCP section to existing MCP docs

5. **[ ] Create example**  
   Add `examples/node/webmcp-tools.ts` (or browser example)

6. **[ ] Open Draft PR**  
   Submit as WIP for feedback from AI SDK maintainers

---

## Open Questions for AI SDK Maintainers

1. **Package location**: Should WebMCP be in `@ai-sdk/mcp` or a separate `@ai-sdk/mcp-browser` package?

2. **Server-side support**: Should we include `WebMCPServer` for websites to expose tools?

3. **Chrome Extension utilities**: Is there interest in Chrome-specific helpers (e.g., `createContentScriptMCPClient`)?

4. **MessagePort vs postMessage**: Should we use `MessageChannel` ports or raw `postMessage`?

5. **Compatibility with `@modelcontextprotocol/sdk`**: Should we align with or wrap their `TabClientTransport`?

---

## Appendix: Browser Compatibility

| API | Chrome | Firefox | Safari | Edge |
|-----|--------|---------|--------|------|
| `postMessage` | ✅ | ✅ | ✅ | ✅ |
| `MessageChannel` | ✅ | ✅ | ✅ | ✅ |
| `Transferable` (ports) | ✅ | ✅ | ✅ | ✅ |
| Service Workers | ✅ | ✅ | ✅ | ✅ |
| Extension APIs | ✅ | ✅ | ⚠️ | ✅ |

---

*This document will be updated as the implementation progresses.*
