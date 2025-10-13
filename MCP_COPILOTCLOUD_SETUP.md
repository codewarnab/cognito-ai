# MCP Server Integration with CopilotCloud

## Overview

The Chrome AI extension now uses **CopilotCloud** with the `setMcpServers` approach for MCP (Model Context Protocol) server connections, as per the official CopilotKit documentation.

## What Changed?

### ❌ Old Approach (Custom Backend)
- Self-hosted backend runtime
- MCP tokens passed via headers to backend
- Backend created MCP clients with `createMCPClient`
- Complex connection pooling and client management

### ✅ New Approach (CopilotCloud + setMcpServers)
- CopilotCloud hosted runtime
- Direct client-side connection to MCP servers
- Simple `setMcpServers` configuration
- CopilotCloud handles all MCP management

## Architecture

```
Chrome Extension
  ├── OAuth Flow (chrome.storage)
  │   └── Saves access tokens locally
  │
  └── CopilotKit Provider
      ├── publicApiKey → CopilotCloud
      │
      └── McpServerManager Component
          └── useCopilotChat().setMcpServers([...])
              └── Connects to MCP servers directly
```

## Implementation Files

### 1. McpServerManager Component
**Location:** `src/components/McpServerManager.tsx`

This component:
- Uses `useCopilotChat()` hook to access `setMcpServers`
- Loads OAuth tokens from `chrome.storage`
- Configures MCP servers with authentication headers
- Returns `null` (doesn't render anything)

```typescript
import { useCopilotChat } from "@copilotkit/react-core";
import { useEffect } from "react";

function McpServerManager() {
  const { setMcpServers } = useCopilotChat();
  
  useEffect(() => {
    // Load tokens and configure servers
    setMcpServers([
      {
        endpoint: "https://mcp.notion.com/sse",
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      },
    ]);
  }, [setMcpServers]);
  
  return null;
}
```

### 2. Updated SidePanel
**Location:** `src/sidepanel.tsx`

Changes:
- ✅ Added `<McpServerManager />` component
- ✅ Removed custom backend MCP header logic
- ✅ Removed `mcpHeaders` state
- ✅ Removed `isLoadingTokens` state
- ✅ Removed `loadMCPTokens` useEffect
- ✅ Using `publicApiKey` for CopilotCloud

```typescript
function SidePanel() {
  return (
    <CopilotKit publicApiKey="ck_pub_0f2b859676875143d926df3e2a9a3a7a">
      <CopilotChatContent />
    </CopilotKit>
  );
}

function CopilotChatContent() {
  return (
    <>
      <McpServerManager />
      <CopilotChatWindow {...props} />
    </>
  );
}
```

## How It Works

### 1. User Authenticates
User clicks "Authenticate" in MCP Manager UI:
```
McpServerCard → OAuth flow → chrome.storage.local.set('oauth.notion.mcp.tokens', tokens)
```

### 2. McpServerManager Loads Tokens
On component mount:
```typescript
const notionTokenData = await chrome.storage.local.get('oauth.notion.mcp.tokens');
const token = notionTokenData['oauth.notion.mcp.tokens']?.access_token;
```

### 3. Configure MCP Servers
```typescript
setMcpServers([
  {
    endpoint: "https://mcp.notion.com/sse",
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  },
]);
```

### 4. CopilotCloud Connects
CopilotCloud runtime:
- Receives MCP server configuration
- Establishes SSE connections
- Discovers available tools
- Makes tools available to AI agent

### 5. AI Uses MCP Tools
When user chats with AI:
```
User: "Show me my Notion pages"
  ↓
AI detects intent → Uses Notion MCP tools
  ↓
CopilotCloud → Notion MCP Server → Returns data
  ↓
AI formats response → Shows in chat
```

## Adding More MCP Servers

### Example: Adding a Public MCP Server
```typescript
setMcpServers([
  // Notion (requires auth)
  {
    endpoint: "https://mcp.notion.com/sse",
    headers: {
      'Authorization': `Bearer ${notionToken}`,
    },
  },
  
  // Public MCP server (no auth)
  {
    endpoint: "https://mcp.composio.dev/sse",
  },
]);
```

### Example: Adding Supabase MCP
```typescript
const supabaseTokenData = await chrome.storage.local.get('oauth.supabase.mcp.tokens');
const supabaseToken = supabaseTokenData['oauth.supabase.mcp.tokens']?.access_token;

if (supabaseToken) {
  servers.push({
    endpoint: "https://mcp.supabase.com/sse",
    headers: {
      'Authorization': `Bearer ${supabaseToken}`,
    },
  });
}
```

## Benefits of This Approach

### ✅ Simpler Architecture
- No custom backend MCP client code
- No connection pooling logic
- No manual tool discovery

### ✅ Better Developer Experience
- Follows official CopilotKit documentation
- Standard `setMcpServers` API
- Easy to add new MCP servers

### ✅ CopilotCloud Features
- Automatic MCP connection management
- Built-in error handling
- Optimized for performance

### ✅ No Backend Required
- Frontend-only integration
- No need to deploy custom runtime
- Lower hosting costs

## Configuration

### CopilotCloud API Key
In `src/sidepanel.tsx`:
```typescript
<CopilotKit publicApiKey="ck_pub_0f2b859676875143d926df3e2a9a3a7a">
```

**Note:** Replace with your actual CopilotCloud public API key from [CopilotKit Dashboard](https://cloud.copilotkit.ai)

### MCP Server Endpoints
In `src/components/McpServerManager.tsx`:
```typescript
const servers = [
  {
    endpoint: "https://mcp.notion.com/sse",
    headers: { 'Authorization': `Bearer ${token}` },
  },
];
```

## Testing

### 1. Check MCP Connection
Open Chrome DevTools console:
```
[McpServerManager] Configuring MCP servers
[McpServerManager] Adding Notion MCP server
[McpServerManager] Setting up 1 MCP server(s)
```

### 2. Verify Token Storage
```javascript
chrome.storage.local.get('oauth.notion.mcp.tokens', (data) => {
  console.log('Notion tokens:', data);
});
```

### 3. Test AI Tool Usage
Ask the AI:
- "List my Notion pages"
- "Search my Notion workspace for 'project'"
- "Show me my recent Notion updates"

## Troubleshooting

### MCP Server Not Connected
**Problem:** AI doesn't have access to MCP tools

**Solutions:**
1. Check token in chrome.storage: `oauth.notion.mcp.tokens`
2. Verify OAuth flow completed successfully
3. Check console for MCP setup logs
4. Ensure `McpServerManager` is rendered

### Token Expired
**Problem:** MCP tools return 401 errors

**Solutions:**
1. Re-authenticate via MCP Manager UI
2. Check token expiration time
3. Implement token refresh logic

### Wrong Endpoint
**Problem:** Connection fails

**Solutions:**
1. Verify MCP SSE endpoint URL
2. Check MCP server documentation
3. Test endpoint with curl:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" https://mcp.notion.com/sse
   ```

## Migration from Custom Backend

If you were using the custom backend approach:

### Files to Remove/Archive
- `backend/lib/mcp/` (entire directory)
- `backend/MCP_CONFIGURATION.md`
- `backend/MCP_IMPLEMENTATION_SUMMARY.md`

### Files to Update
- ✅ `src/sidepanel.tsx` - Already updated
- ✅ `src/components/McpServerManager.tsx` - New file created

### Environment Variables to Remove
From `backend/.env.local`:
- `MCP_NOTION_SSE_URL`
- `MCP_NOTION_BASE_URL`

### Backend Code Changes
In `backend/app/api/route.ts`, remove:
```typescript
// Remove this:
createMCPClient: async (config) => {
  const client = await createMCPClientForRuntime(req.headers);
  return client;
}
```

## References

- [CopilotKit MCP Documentation](https://docs.copilotkit.ai/connect-mcp-servers)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [Notion MCP Server](https://developers.notion.com/docs/mcp)
- [CopilotCloud Dashboard](https://cloud.copilotkit.ai)

## Summary

✅ **Migration Complete!**

Your Chrome AI extension now uses:
- CopilotCloud for runtime hosting
- `setMcpServers` for MCP connections
- Direct client-side MCP integration
- Simpler, standard architecture

Next steps:
1. Test MCP tool integration
2. Add more MCP servers as needed
3. Remove old backend MCP code
4. Update documentation

