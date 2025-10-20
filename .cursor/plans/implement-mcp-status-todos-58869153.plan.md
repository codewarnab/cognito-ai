<!-- 58869153-7954-4cb2-8ddb-5cb4eb1e6b94 e61ab188-2c2e-4387-91d8-3519da8221c3 -->
# Implement Connection Status and Tool Count in getMCPStatus()

## Overview

The `getMCPStatus()` function in `src/ai/mcpClient.ts` currently returns hardcoded values for `connected` (false) and `toolCount` (0). The infrastructure to retrieve this data already exists in the background script, but the function doesn't use it.

## Changes Required

### File: `src/ai/mcpClient.ts`

**Current Implementation (lines 354-377):**

```typescript
export async function getMCPStatus(): Promise<{...}> {
  const servers = await getEnabledMCPServers();
  const status = {
    servers: servers.map(server => ({
      id: server.id,
      name: server.name,
      enabled: server.enabled || false,
      connected: false, // TODO: Implement connection status check
      toolCount: 0 // TODO: Implement tool count
    })),
    totalTools: 0
  };
  return status;
}
```

**Required Implementation:**

1. **Fetch Real Connection Status** (line 370)

   - For each server, send message `mcp/{serverId}/status/get` to background script
   - Extract `state` field from response
   - Set `connected: true` if `state === 'connected'`, otherwise `false`

2. **Fetch Real Tool Counts** (line 371)

   - For each server, send message `mcp/{serverId}/tools/list` to get tools array
   - For each server, fetch disabled tools from storage: `mcp.{serverId}.tools.disabled`
   - Calculate enabled tool count: `total tools - disabled tools`
   - Set `toolCount` to the enabled tool count

3. **Calculate Total Tools**

   - Sum up all enabled tool counts across all servers
   - Set `totalTools` field to this sum

**Implementation Strategy:**

```typescript
export async function getMCPStatus(): Promise<{...}> {
  const servers = await getEnabledMCPServers();
  let totalToolsCount = 0;
  
  const serverStatuses = await Promise.all(
    servers.map(async (server) => {
      // Get connection status
      const statusResponse = await chrome.runtime.sendMessage({
        type: `mcp/${server.id}/status/get`
      });
      const isConnected = statusResponse?.success && 
                          statusResponse.data?.state === 'connected';
      
      // Get tools and disabled tools
      const toolsResponse = await chrome.runtime.sendMessage({
        type: `mcp/${server.id}/tools/list`
      });
      const tools = toolsResponse?.success ? toolsResponse.data || [] : [];
      
      const disabledToolsKey = `mcp.${server.id}.tools.disabled`;
      const disabledResult = await chrome.storage.local.get(disabledToolsKey);
      const disabledTools = disabledResult[disabledToolsKey] || [];
      
      // Count only enabled tools
      const enabledToolCount = tools.length - disabledTools.filter(
        dt => tools.some(t => t.name === dt)
      ).length;
      
      totalToolsCount += enabledToolCount;
      
      return {
        id: server.id,
        name: server.name,
        enabled: server.enabled || false,
        connected: isConnected,
        toolCount: enabledToolCount
      };
    })
  );
  
  return {
    servers: serverStatuses,
    totalTools: totalToolsCount
  };
}
```

## Key Implementation Details

- Use `Promise.all()` to fetch status/tools for all servers in parallel for better performance
- Handle errors gracefully - if a server fails to respond, default to `connected: false` and `toolCount: 0`
- Only count tools that are both available AND not in the disabled list
- Wrap chrome.runtime.sendMessage in try-catch to handle potential failures
- The background script already has message handlers for `mcp/{serverId}/status/get` and `mcp/{serverId}/tools/list`

## Testing Considerations

After implementation, verify:

- Connection status reflects actual server state (connected/disconnected)
- Tool counts exclude disabled tools
- Total tools correctly sums all enabled tools across all servers
- Function handles errors gracefully when servers are unavailable

### To-dos

- [ ] Implement connection status check by calling mcp/{serverId}/status/get for each server
- [ ] Implement tool count by calling mcp/{serverId}/tools/list and excluding disabled tools
- [ ] Calculate totalTools by summing enabled tool counts across all servers
- [ ] Add proper error handling for failed message sends and default to safe values