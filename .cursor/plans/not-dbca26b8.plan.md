<!-- dbca26b8-73e5-4a9f-b028-57481dfb7925 e4a4a2dc-5678-4876-bbe7-78fa7f852104 -->
# Notion MCP (Hosted SSE + OAuth) — Implementation Plan

### Scope

- Integrate Notion’s hosted MCP server via SSE using OAuth — no manual token entry.
- Background owns OAuth + token rotation + SSE lifecycle; UI triggers connect and shows status.
- Works inside Chrome MV3 extension; persists across sessions; auto-reconnects.

### Architecture

- UI: `src/components/McpManager.tsx`, `src/components/McpServerCard.tsx`
- Add “Connect Notion” and “Enable” controls; show statuses (Disconnected, Connecting, Connected, Error, Needs Auth).
- Background: `src/background.ts`
- Implement `chrome.identity.launchWebAuthFlow` for Notion OAuth.
- Store `access_token`, `refresh_token`, `expires_at` in `chrome.storage.local` (access token short-lived, refresh stored; mark with createdAt/issuer).
- Refresh flow via Notion token endpoint; rotate on 401.
- Host MCP SSE client (Notion hosted endpoint) and expose status + request/response via `chrome.runtime.onMessage` and/or `chrome.runtime.Port`.
- MCP Client: `src/mcp/notionClient.ts`
- Thin wrapper over hosted MCP SSE: connect, send `initialize`, `tools/list`, `tools/call`, `resources/read`, `prompts/list`, etc., with Bearer token in `Authorization`.
- Reconnect with exponential backoff; propagate events to background.
- Config/Secrets: `src/constants.ts`
- Add NOTION_OAUTH_CLIENT_ID, NOTION_OAUTH_REDIRECT_ID (Chrome extension ID redirect), NOTION_OAUTH_SCOPES, NOTION_MCP_SSE_URL, TOKEN_AUDIENCE/ISSUER.
- Read from env at build or fallback to placeholder for local dev.

### OAuth Flow (No manual token entry)

1. UI clicks “Connect Notion” → send `mcp/notion/auth/start` to background.
2. Background builds auth URL (Notion OAuth, response_type=code, PKCE) and calls `launchWebAuthFlow` interactive.
3. Receive redirect URL → exchange code for tokens (fetch to Notion token endpoint) from background.
4. Persist tokens in `chrome.storage.local` (space: `oauth.notion`).
5. Background notifies UI: status `authenticated`.

### SSE Connection Lifecycle

- Preconditions: valid `access_token`.
- Connect to `NOTION_MCP_SSE_URL` with `Authorization: Bearer <access_token>`.
- On open → send MCP `initialize` (client info, capabilities), then `tools/list` to verify.
- On 401 or expired → refresh token and retry (debounced); if refresh fails → clear tokens and set `needs_auth`.
- Heartbeat/ping; auto-reconnect with capped exponential backoff (e.g., 0.5s → 30s).
- Expose status updates to UI via runtime messages; include last error.

### UI Wiring

- `McpServerCard` gets new props/callbacks or uses message bus to query background for server status.
- Buttons:
- “Connect” → triggers OAuth start.
- “Enable” toggle → starts/stops SSE client in background.
- “Disconnect” → stops client and clears tokens (optional).
- Visuals: use `StatusBadge` for state, respect styles in `src/styles/mcp.css`.

### Messaging Contract

- Messages from UI to BG:
- `mcp/notion/auth/start`
- `mcp/notion/enable` { enabled: boolean }
- `mcp/notion/status/get`
- `mcp/notion/tool/call` { name, arguments }
- Messages from BG to UI (broadcast):
- `mcp/notion/status` { state: 'unauth'|'auth'|'connecting'|'connected'|'error', error? }

### Storage & Security

- Use `chrome.storage.local` for `refresh_token`, `expires_at`, `workspace_id`.
- Keep `access_token` in memory in background; only persist if needed with short TTL.
- Never expose tokens to UI; UI only gets status booleans and errors.
- Implement `storage.migrations` key to handle future schema changes.

### Error Handling & Telemetry

- Centralize errors in background with structured logs via `src/logger.ts`.
- Map common errors: network, 401, invalid_scope, consent_required.

### Build/Permissions

- Update `manifest.json` (MV3) to include:
- `identity` permission (for `launchWebAuthFlow`).
- `externally_connectable` (if required by Notion’s redirect pattern) or register extension redirect URI in Notion app.
- `host_permissions` for Notion OAuth/token endpoints, MCP SSE base URL.

### Testing Plan

- Happy path: Connect → Enable → tool list → call simple tool.
- Token expiry: simulate expires_at in past → refresh → reconnect.
- Revoked consent: Notion returns 401 → clear tokens → UI shows Needs Auth.
- Offline: SSE backoff; UI shows Connecting.

### Minimal API Surfaces (illustrative snippets)

- Start auth from UI:
- UI: `chrome.runtime.sendMessage({ type: 'mcp/notion/auth/start' })`
- Background handles auth complete, stores tokens, emits status.
- Enable connection:
- UI: `chrome.runtime.sendMessage({ type: 'mcp/notion/enable', enabled: true })`

### Files to Add/Update

- Add `src/mcp/notionClient.ts` — SSE client wrapper.
- Update `src/background.ts` — OAuth, token store, SSE lifecycle, messaging.
- Update `src/components/McpServerCard.tsx` — buttons, status.
- Update `src/components/McpManager.tsx` — pass props or keep as-is if card self-manages.
- Add `src/styles/mcp.css` — minor status styles if missing.
- Update `src/constants.ts` — Notion config + endpoints.

### External Docs + Alignment

- Notion MCP: `developers.notion.com/docs/mcp`
- Notion MCP getting started: `developers.notion.com/docs/get-started-with-mcp`
- CopilotKit MCP guide (client-side patterns): `docs.copilotkit.ai/direct-to-llm/guides/model-context-protocol?cli=do-it-manually`

### Rollout & Safeguards

- Feature flag in storage: `mcp.features.notion`.
- Graceful fallback: if auth fails or SSE unavailable, UI remains disabled.
- Clear tokens button (dev only, hidden behind debug flag).

### To-dos

- [ ] Update manifest for identity + host permissions
- [ ] Add Notion OAuth/MCP constants in constants.ts
- [ ] Implement Notion OAuth with PKCE in background.ts
- [ ] Add secure token storage and refresh logic
- [ ] Create Notion MCP SSE client wrapper
- [ ] Wire background messaging + SSE lifecycle
- [ ] Update McpServerCard for connect/enable/status
- [ ] Add/update mcp.css for statuses
- [ ] Implement manual tests for auth, refresh, reconnect