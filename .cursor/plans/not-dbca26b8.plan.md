<!-- dbca26b8-73e5-4a9f-b028-57481dfb7925 a73b38c0-f5ab-4a89-8a74-3108929cfaa8 -->
# Notion MCP (Hosted SSE + PKCE OAuth) — Corrected Implementation Plan

### Problem Recap

- Current code targets `api.notion.com/v1/oauth/*` using a client secret. That installs a custom Notion integration and yields tokens that are not valid for the hosted MCP server.
- The correct flow must use `https://mcp.notion.com/authorize` with PKCE (no client secret) and exchange at `https://mcp.notion.com/token`. The `client_id` is the MCP client id (short id like `Oh46dYkUrzferlRE`), not an integration UUID.

### Target Behavior

- “Connect” launches Notion MCP install/auth (the page that says “Connect with Notion MCP”).
- On success, we receive a code on the extension redirect, exchange at MCP token endpoint using `code_verifier` (no secret), store token in background, then connect SSE with Bearer token.
- UI (`McpManager`/`McpServerCard`) remains button-only; no manual tokens.

### Edits (by file)

- `src/constants.ts`
- Replace OAuth endpoints:
- `OAUTH_AUTH_URL = 'https://mcp.notion.com/authorize'`
- `OAUTH_TOKEN_URL = 'https://mcp.notion.com/token'`
- Replace `OAUTH_CLIENT_ID` with your MCP client id (short form). Remove `OAUTH_CLIENT_SECRET` usage entirely.
- Keep `MCP_SSE_URL = 'https://mcp.notion.com/sse'` and `MCP_BASE_URL = 'https://mcp.notion.com/mcp'`.
- Add `MCP_RESOURCE = 'https://mcp.notion.com/'`.

- `src/mcp/oauth.ts` (new or update)
- Add PKCE helpers:
- `createCodeVerifier()`, `createCodeChallenge(verifier)` (SHA-256 → base64url).
- `buildAuthUrl(state)` builds:
- `https://mcp.notion.com/authorize?response_type=code&client_id=<id>&redirect_uri=<ext_redirect>&code_challenge=<challenge>&code_challenge_method=S256&resource=https%3A%2F%2Fmcp.notion.com%2F&state=<state>`
- `exchangeCodeForTokens(code, redirectUri)` POST to `https://mcp.notion.com/token` with JSON:
- `{ grant_type: 'authorization_code', code, redirect_uri, client_id, code_verifier }`
- Token type: `{ access_token, token_type, expires_in, refresh_token? }` — persist refresh only if present.

- `src/background.ts`
- Use the new PKCE-based builders; drop any secret usage.
- Save `code_verifier` in memory (and `state`) between `launchWebAuthFlow` start and callback.
- After exchange, set status `authenticated` and allow “Enable” to connect SSE.
- On SSE 401/invalid token, clear access token and set status `needs-auth` (refresh only if MCP provides a refresh token endpoint/contract).

- `src/mcp/notionClient.ts`
- No protocol change; ensure it sends `Authorization: Bearer <access_token>` to `MCP_SSE_URL` and posts to `MCP_BASE_URL` for requests. Reconnect on network errors; surface `needs-auth` on 401.

- `manifest.json` (MV3 build template)
- Ensure permissions: `identity`.
- `host_permissions`: `https://mcp.notion.com/*`, `https://www.notion.so/*` (install UI), and `https://api.notion.com/*` only if still needed elsewhere.
- Confirm redirect URI `https://<EXT_ID>.chromiumapp.org/` is registered in the Notion MCP client console.

### Guardrails & UX

- Never expose tokens to UI; background only.
- Detect misconfiguration: if `client_id` looks like UUID (integration id) or auth URL is `api.notion.com`, log a clear error and surface `status.error = 'Use MCP client id and endpoints'`.
- If user is mid-connection and closes the popup, show `connecting…` then fallback to `needs-auth` after timeout.

### Validation Checklist

- Clicking Connect opens “Connect with Notion MCP” (not custom integration page).
- Redirect hits extension identity URL and returns a `code`.
- Exchange at `mcp.notion.com/token` without secret succeeds.
- Enabling connects SSE; `initialize` and `tools/list` succeed.
- 401 from SSE transitions to `needs-auth` and requires reconnect.

### Notes from Docs

- Notion MCP OAuth: `developers.notion.com/docs/mcp` and “Get started with MCP”.
- CopilotKit MCP client guidance confirms PKCE-only and background storage patterns.

### Implementation Risks

- Using the integration UUID will lead to the wrong page; add a config assertion for MCP client id format.
- If your MCP app hasn’t registered the extension redirect, auth will fail; provide actionable error.

### To-dos

- [ ] Point constants to mcp.notion.com; set MCP client id
- [ ] Add PKCE helpers and state in oauth.ts
- [ ] Exchange code at mcp.notion.com/token without secret
- [ ] Wire background to PKCE flow; store verifier/state
- [ ] Use MCP token to connect SSE; handle 401→needs-auth
- [ ] Ensure identity + host_permissions for MCP/Notion
- [ ] Add runtime checks for wrong client id/endpoints
- [ ] Test happy path and misconfig (wrong client id)