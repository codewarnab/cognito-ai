# MCP Transport Support

This application supports both MCP transport specifications to ensure compatibility with various MCP servers.

## Supported Transports

### 1. Streamable HTTP Transport (2025-06-18) - Recommended
**Protocol Version:** `2025-06-18`

**How it works:**
1. **Initial Connection:** Client sends a POST request to the MCP endpoint with the `initialize` request in the body
2. **Response:** Server responds with either:
   - `Content-Type: text/event-stream` - SSE stream containing the initialize response and subsequent messages
   - `Content-Type: application/json` - Direct JSON response with initialize result
3. **Session Management:** Server MAY include `Mcp-Session-Id` header in the initialize response
4. **Subsequent Requests:** All requests are POST to the same endpoint, with session ID included if provided

**Key Features:**
- Single endpoint for all operations
- Session-based communication
- Supports both SSE streaming and direct JSON responses
- Better error handling and reconnection support

**Example Servers:**
- Notion MCP (`https://mcp.notion.com/mcp`)
- Canva MCP (`https://mcp.canva.com/mcp`)
- Most modern MCP servers

### 2. HTTP+SSE Transport (2024-11-05) - Legacy
**Protocol Version:** `2024-11-05`

**How it works:**
1. **Initial Connection:** Client sends a GET request to open an SSE stream
2. **Endpoint Event:** Server sends an SSE `event: endpoint` with a POST endpoint URL
3. **Initialize Request:** Client POSTs the `initialize` request to the endpoint from step 2
4. **Subsequent Communication:** All messages use the endpoint from the SSE event

**Key Features:**
- Separate GET (receive) and POST (send) endpoints
- Endpoint negotiation via SSE events
- Legacy compatibility

**Example Servers:**
- Older MCP implementations
- Servers that return `405 Method Not Allowed` for POST to main endpoint

## Transport Detection

The client automatically detects which transport to use:

```typescript
// 1. Try Streamable HTTP (POST)
POST /mcp
Content-Type: application/json
{ "jsonrpc": "2.0", "method": "initialize", ... }

// If successful (200 OK) → Use Streamable HTTP
// If 405 Method Not Allowed → Fall back to HTTP+SSE

// 2. Fall back to HTTP+SSE (GET)
GET /mcp
Accept: text/event-stream

// Wait for endpoint event, then POST to that endpoint
```

## Implementation Details

### Connection Flow

#### Streamable HTTP (New)
```
1. POST /mcp with initialize request
2. Receive response (SSE or JSON)
   - Extract Mcp-Session-Id header if present
   - Parse initialize result from response
3. Process SSE stream for server messages
4. POST all subsequent requests to /mcp with Mcp-Session-Id header
```

#### HTTP+SSE (Old)
```
1. GET /mcp to open SSE stream
2. Receive endpoint event with POST URL
3. POST initialize to endpoint from step 2
4. Receive initialize response via SSE message event
5. POST all subsequent requests to endpoint from step 2
```

### Code Structure

- `connectWithFetch()`: Attempts Streamable HTTP first, falls back to HTTP+SSE
- `transportType`: Tracks which transport is being used (`'streamable-http'` | `'http-sse'`)
- `getPostUrl()`: Returns correct endpoint based on transport type
- `initialize()`: Handles initialization for both transports

### Headers

#### Streamable HTTP
```
POST /mcp
Authorization: Bearer <token>
Content-Type: application/json
Accept: text/event-stream, application/json
MCP-Protocol-Version: 2025-06-18
Mcp-Session-Id: <session-id>  (after initialization)
```

#### HTTP+SSE
```
GET /mcp
Authorization: Bearer <token>
Accept: text/event-stream
MCP-Protocol-Version: 2024-11-05
```

## Troubleshooting

### Error: 405 Method Not Allowed
- **Cause:** Server doesn't support Streamable HTTP (POST)
- **Solution:** Client automatically falls back to HTTP+SSE (GET)
- **Action:** No user action needed

### Error: Message endpoint not available
- **Cause:** Using HTTP+SSE but endpoint event not received yet
- **Solution:** Wait for SSE connection to be established
- **Action:** Check network connectivity and server logs

### Error: Initialization timeout
- **Cause:** No initialization response received within 10 seconds
- **Solution:** Check server health and authentication
- **Action:** Verify access token is valid and server is responsive

## Testing

To verify transport support:

1. **Test Streamable HTTP:**
   ```bash
   curl -X POST https://mcp.notion.com/mcp \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -H "Accept: text/event-stream, application/json" \
     -H "MCP-Protocol-Version: 2025-06-18" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
   ```

2. **Test HTTP+SSE:**
   ```bash
   curl https://mcp.example.com/mcp \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Accept: text/event-stream"
   ```

## References

- [MCP Streamable HTTP Transport Spec (2025-06-18)](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- [MCP HTTP+SSE Transport Spec (2024-11-05)](https://modelcontextprotocol.io/specification/2024-11-05/basic/transports)
