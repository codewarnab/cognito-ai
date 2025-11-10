<!-- 6b7daeef-b0fa-4e0d-80b5-75a9e3b09dcd 00648770-5575-4f40-9b85-084acf95544a -->
# Background.ts Decomposition (Multi‑Phase Plan)

## Scope & Constraints

- Keep all function signatures unchanged; no call sites altered.
- Add JSDoc for every moved function.
- Avoid circular imports by extracting shared MCP state first.
- Leave Chrome event registrations (listeners) in `src/background.ts`; only call helpers from there.

## Phase 1 — Centralize Shared MCP State (prevent cycles)

Create `src/mcp/state.ts`:

- Move: `interface ServerState`, `serverStates` map, `getServerState(serverId)`, `getServerConfig(serverId)`.
- Export these for reuse by helpers.
- Add JSDoc for each export.
- Update `src/background.ts` imports to use `mcp/state`.

## Phase 2 — Keep‑Alive Helpers

Create `src/background/keepAlive.ts`:

- Move: `startMCPKeepAlive`, `stopMCPKeepAlive`, `hasEnabledMCPServers`, `updateKeepAliveState`.
- Replace local loggers with a module‑scoped logger via `createLogger('Background-KeepAlive', 'KEEP_ALIVE')`.
- Import `serverStates` or `getServerState` from `mcp/state` as needed.
- JSDoc all functions.

## Phase 3 — Tools Config & Events

- Create `src/mcp/toolsConfig.ts`: move `getDisabledTools`, `setDisabledTools` (JSDoc + keep signatures).
- Create `src/mcp/events.ts`: move `broadcastStatusUpdate` (JSDoc, no behavior change).

## Phase 4 — Offscreen/Summarizer Utilities

- Create `src/offscreen/ensure.ts`: move `ensureOffscreenDocument` (JSDoc). Import and call from `background.ts` where needed.

## Phase 5 — Token Refresh Helpers (contained auth utilities)

Create `src/mcp/authHelpers.ts`:

- Move: `scheduleTokenRefresh`, `handleTokenRefreshAlarm`, `ensureTokenValidity`, `ensureValidToken`.
- Keep signatures; import `MCP_OAUTH_CONFIG`, `discoverOAuthEndpoints`, storage functions, and `mcp/state` exports.
- Use a module logger `createLogger('Background-AuthHelpers', 'AUTH_HELPERS')`.

## Phase 6 — Connection & Error‑Handling Utilities (optional next step)

Create `src/mcp/connection.ts` (can be a follow‑up PR if desired):

- Move: `connectMcpServer`, `disconnectMcpServer`, `handleTokenExpiry`, `handleInvalidToken`, `enableMcpServer`, `disableMcpServer`, `disconnectServerAuth`, `performHealthCheck`, `getServerStatus`, `getServerTools`, `getAllMCPTools`, `getMCPServerConfigs`, `initializeServerStatus`, `initializeAllServers`.
- Keep signatures unchanged; import from `mcp/state`, `events`, `authHelpers`.
- Add JSDoc to all moved functions.

## Wiring Changes in background.ts

- Replace inlined implementations with named imports from the new modules.
- Keep all listeners and message routing intact; call the imported helpers.
- Ensure any logger variables used only within moved functions are replaced by module‑local loggers inside the new files.

## Notes / Traps Avoided

- Circular imports: mitigated by Phase 1 (`mcp/state.ts`).
- MV3 service worker lifetime: keep‑alive functions preserved; listeners remain in `background.ts`.
- Storage keys, alarms, and message types remain unchanged.
- No change to exported types or message contracts.

## Deliverables

- New files with JSDoc for every moved function.
- Updated imports in `src/background.ts` only; no runtime behavior changes.
- Build passes with no TypeScript/linter errors.

### To-dos

- [ ] Create src/mcp/state.ts and move ServerState, serverStates, getServerState, getServerConfig
- [ ] Create src/background/keepAlive.ts and move keep-alive helpers
- [ ] Create src/mcp/toolsConfig.ts and move get/set disabled tools
- [ ] Create src/mcp/events.ts and move broadcastStatusUpdate
- [ ] Create src/offscreen/ensure.ts and move ensureOffscreenDocument
- [ ] Create src/mcp/authHelpers.ts and move token refresh helpers
- [ ] Update src/background.ts to import and use moved helpers
- [ ] Add/verify JSDoc for all moved functions
- [ ] Run build, resolve TS/lint issues if any
- [ ] (Optional) Create src/mcp/connection.ts and move remaining connection helpers