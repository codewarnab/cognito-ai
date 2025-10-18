# MCP Integration with AI SDK - Implementation Summary

## Overview
This document describes the implementation of proper Model Context Protocol (MCP) support using the AI SDK v5 in the Chrome AI extension.

## What Was Implemented

### 1. MCP Client Manager (`src/ai/mcpClient.ts`)
A new module that handles MCP server connections and tool retrieval:

- **Dynamic Server Configuration**: Automatically retrieves enabled MCP servers from the background script
- **SSE Transport Support**: Uses Server-Sent Events for Notion MCP (production-ready)
- **Token Management**: Automatically fetches access tokens from storage
- **Tool Retrieval**: Uses AI SDK's `experimental_createMCPClient` to connect and retrieve tools
- **Proper Cleanup**: Ensures MCP clients are closed after use

**Key Features:**
- Communicates with background script via `chrome.runtime.sendMessage`
- Supports multiple MCP servers (currently Notion, easily extensible)
- Fallback mechanism if background script communication fails
- Comprehensive logging for debugging

### 2. AI Logic Integration (`src/ai/aiLogic.ts`)
Updated the AI streaming logic to include MCP tools:

- **Tool Combination**: Merges extension tools with MCP tools
- **Lifecycle Management**: Initializes MCP clients before streaming, cleans up after
- **Error Handling**: Proper cleanup even on errors
- **AbortSignal Support**: Respects request cancellation

**Changes Made:**
- MCP clients initialized before creating the UI message stream
- Tools from MCP servers combined with extension tools
- Cleanup handlers in multiple error paths (onFinish, catch blocks)

### 3. Background Script Updates (`src/background.ts`)
Added message handler for MCP server configuration:

- **New Message Type**: `mcp/servers/get` - returns enabled MCP server configurations
- **Server Configuration Function**: `getMCPServerConfigs()` - builds server config with tokens
- **Dynamic Token Injection**: Automatically includes fresh access tokens in server configs

**What It Returns:**
```javascript
{
  success: true,
  data: [
    {
      id: 'notion',
      name: 'Notion MCP',
      url: 'https://mcp.notion.com/sse',
      type: 'sse',
      headers: [
        { key: 'Authorization', value: 'Bearer <access_token>' },
        { key: 'Accept', value: 'application/json, text/event-stream' }
      ],
      enabled: true,
      status: { ... }
    }
  ]
}
```

## How It Works

### Flow Diagram
```
User sends message
    ↓
aiLogic.ts: streamAIResponse()
    ↓
1. Initialize MCP clients
    ↓
mcpClient.ts: initializeMCPClients()
    ↓
2. Request server configs from background
    ↓
background.ts: getMCPServerConfigs()
    ↓
3. Get stored tokens and build config
    ↓
4. Return to mcpClient.ts
    ↓
5. Create MCP client with AI SDK
    ↓
6. Call mcpClient.tools() to get tools
    ↓
7. Combine with extension tools
    ↓
8. Pass all tools to streamText()
    ↓
9. AI can now use MCP tools
    ↓
10. Cleanup MCP clients when done
```

### Key Implementation Details

1. **No Tool Prefixing**: Unlike the initial implementation, MCP tools are NOT prefixed. The AI SDK expects the original tool names from the MCP server.

2. **SSE Transport**: Uses the AI SDK's built-in SSE transport support:
   ```javascript
   const transport = {
     type: 'sse' as const,
     url: 'https://mcp.notion.com/sse',
     headers: {
       'Authorization': 'Bearer <token>',
       'Accept': 'application/json, text/event-stream'
     }
   };
   const mcpClient = await createMCPClient({ transport });
   ```

3. **Tool Format**: Tools returned from `mcpClient.tools()` are already in the correct format for `streamText()`:
   ```javascript
   {
     toolName: {
       description: 'Tool description',
       inputSchema: zodSchema,
       execute: async (params) => { ... }
     }
   }
   ```

## Testing the Integration

### Prerequisites
1. Extension must be loaded in Chrome
2. Notion MCP must be authenticated and enabled via the McpServerCard UI
3. User must have enabled the Notion MCP server in the extension settings

### Test Steps

1. **Enable Notion MCP**:
   - Open the extension side panel
   - Go to MCP Servers section
   - Click "Connect" on Notion MCP card
   - Complete OAuth flow
   - Toggle "Enable" to ON
   - Wait for green "Connected and verified" status

2. **Test Tool Availability**:
   - Open browser DevTools (F12)
   - Filter console logs by "MCP-Client" or "AI-Logic"
   - Send a message in the chat
   - Look for logs showing:
     ```
     [MCP-Client] ✅ MCP tools from Notion MCP: { count: X, tools: [...] }
     [AI-Logic] 🎯 Total available tools: { count: Y, extension: Z, mcp: X }
     ```

3. **Test Tool Execution**:
   - Ask the AI to search Notion: "Search my Notion for pages about project planning"
   - The AI should call Notion MCP tools (e.g., `search_database_items`)
   - Watch console for tool call logs
   - Verify tool results are returned

### Debugging

If tools aren't available:

1. **Check Background Script**:
   ```javascript
   // In DevTools console (service worker):
   chrome.runtime.sendMessage({ type: 'mcp/servers/get' }, console.log)
   ```
   Should return server configs with tokens

2. **Check MCP Client Initialization**:
   Look for these log patterns:
   - `🚀 Initializing MCP clients...`
   - `📋 Found MCP servers: { count: 1 }`
   - `🔌 Connecting to MCP server: Notion MCP (sse)`
   - `✅ MCP client created successfully`
   - `✅ MCP tools from Notion MCP:`

3. **Check Tool Format**:
   Tools should have:
   - `description` (string)
   - `inputSchema` (Zod schema)
   - `execute` (function)

## Common Issues

### Issue: "Model tried to call unavailable tool"
**Cause**: MCP tools not being included in the tools object  
**Solution**: Check that `mcpTools` is not empty and is being spread into the combined tools object

### Issue: "Failed to initialize MCP clients"
**Cause**: Connection error or authentication failure  
**Solutions**:
- Verify Notion MCP is enabled: `chrome.storage.local.get('mcp.notion.enabled')`
- Check token validity: Tokens might be expired
- Verify network connectivity to `https://mcp.notion.com/sse`

### Issue: Tools have wrong format
**Cause**: AI SDK version mismatch or incorrect tool structure  
**Solution**: Ensure AI SDK v5+ is installed and `experimental_createMCPClient` is used

## Files Modified

1. **src/ai/mcpClient.ts** (NEW) - MCP client manager
2. **src/ai/aiLogic.ts** - Integrated MCP tools into AI streaming
3. **src/background.ts** - Added server config message handler

## Dependencies

Required packages (already in package.json):
- `ai` v5.0.75+
- `@modelcontextprotocol/sdk` v1.20.0+
- `@ai-sdk/google` v2.0.23+

## Next Steps

1. **Test with Real Notion Data**: Ensure tools work with actual Notion workspace
2. **Add More MCP Servers**: Extend to support GitHub, Linear, etc.
3. **Error Recovery**: Improve handling of token expiration during tool execution
4. **Tool Caching**: Consider caching tool definitions to reduce latency
5. **User Feedback**: Show MCP tool execution status in the UI

## Architecture Benefits

- **Separation of Concerns**: MCP logic isolated in mcpClient.ts
- **Extensible**: Easy to add new MCP servers
- **Secure**: Tokens managed by background script, not exposed to content scripts
- **Reliable**: Proper cleanup prevents memory leaks
- **Debuggable**: Comprehensive logging at each step

