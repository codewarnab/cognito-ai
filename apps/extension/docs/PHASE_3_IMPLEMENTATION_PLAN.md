# Phase 3: Local Bridge Chat Streaming (ACP) - Implementation Plan

## Overview
Implement a local HTTP API (code-bridge) that accepts chat messages + context, runs a chosen local agent CLI in ACP mode, and streams the assistant response back to the extension.

## Current State Analysis
- **Phase 1 Done**: `ToolsMode` includes `'code'` in `types/settings.ts`
- **Phase 2 Done**: Element picker (`code-picker.content.ts`), `CodeModeElementContext` type in `@cognito/shared`, `codeModeStore` created
- **Missing**: Bridge package, bridge settings storage, bridge health check, pairing flow, code-mode chat streaming

---

## Implementation Tasks

### Part A: Create `@cognito/code-bridge` Package (Bridge Server)

#### A1. Package Setup
- [ ] Create `packages/code-bridge/` directory
- [ ] Create `package.json` with dependencies: `ai`, `zod`, `@mcpc-tech/acp-ai-provider`
- [ ] Create `tsconfig.json` (ESM, Node target)
- [ ] Add to root `package.json` scripts: `"dev:bridge": "pnpm --filter @cognito/code-bridge dev"`

#### A2. CLI Entry Point (`src/cli.ts`)
- [ ] Parse args: `--port` (default 8787), `--host` (default 127.0.0.1), `--cwd`
- [ ] Print pairing code on startup
- [ ] Start HTTP server

#### A3. HTTP Infrastructure
- [ ] `src/http/cors.ts` - Allow `chrome-extension://*` and `localhost`
- [ ] `src/http/json.ts` - JSON body parser
- [ ] `src/server.ts` - Main HTTP server with routing

#### A4. Pairing & Auth
- [ ] `src/pairing/tokenStore.ts` - Store tokens in `~/.cognito/bridge/tokens.json`
- [ ] `src/pairing/pairing.ts` - Generate pairing codes, confirm pairing
- [ ] `src/http/auth.ts` - Require `Authorization: Bearer <token>` on protected endpoints

#### A5. ACP Integration
- [ ] `src/acp/createProvider.ts` - Wrapper around `@mcpc-tech/acp-ai-provider`
- [ ] Handle agent spawn, session init, mode/model selection, cleanup

#### A6. API Endpoints
- [ ] `GET /health` - Returns `{ ok: true, version }`
- [ ] `POST /pair/start` - Returns `{ code, expiresAt }`
- [ ] `POST /pair/confirm` - Input: `{ code }`, Returns: `{ token }`
- [ ] `POST /code/chat` - Main streaming endpoint (ACP)
- [ ] `GET /agents` - List available agents with PATH detection

---

### Part B: Extension-Side Integration

#### B1. Bridge Settings Store
- [ ] Extend `codeModeStore` or create new store for bridge settings:
  - `bridgeBaseUrl: string` (default `http://127.0.0.1:8787`)
  - `bridgeToken: string | null`
  - `selectedAgentName: string`
  - `bridgeStatus: 'connected' | 'needs-pairing' | 'offline'`
- [ ] Persist to Chrome storage

#### B2. Bridge Health Check
- [ ] Create `src/services/codeBridge/healthCheck.ts`
- [ ] Poll `/health` every 3-5 seconds when in Code mode
- [ ] Update `bridgeStatus` in store

#### B3. Pairing Flow
- [ ] Create `src/services/codeBridge/pairing.ts`
- [ ] `pairWithBridge(baseUrl, code)` → calls `/pair/confirm`
- [ ] Store returned token

#### B4. Code Mode Chat Streaming
- [ ] Create `src/ai/codeMode/codeModeChat.ts`
- [ ] `streamCodeModeChat(params)` - POST to `/code/chat` with:
  - `messages`
  - `elementContext` (from codeModeStore)
  - `agent` selection
  - `Authorization: Bearer <token>`
- [ ] Return UI message stream compatible with existing chat UI

#### B5. AI Logic Integration
- [ ] Modify `streamAIResponse.ts` to detect Code mode
- [ ] Route to `streamCodeModeChat` when `toolsMode === 'code'`

#### B6. UI Components (Minimal for Phase 3)
- [ ] Bridge status indicator component
- [ ] Pairing modal/dialog
- [ ] Agent selector dropdown

---

## Questions / Clarifications Needed

### Q1: Agent Selection Persistence
Should the selected agent (Gemini CLI / Claude Code / Codex CLI) be persisted per-session or globally in settings?
ans:globally 

### Q2: Bridge URL Configuration
Should users be able to configure a custom bridge URL, or is `http://127.0.0.1:8787` always sufficient?
ans:always sufficient
### Q3: Error Handling for Missing Agent CLI
When the bridge detects that a selected agent CLI is not installed (e.g., `gemini` not on PATH), should we:
- a) Show an error in the chat stream?
- b) Show a toast notification?
- c) Disable that agent option in the selector?
c ) and show a tool tip or popover ocmpoennt  
### Q4: Session Management
Should we implement session IDs for multi-turn conversations with the same agent instance, or is each request independent?
yes : please check how the dev-inspected-mcp project does that which is already cloned in our directoyr for refrence 

### Q5: ACP Provider Library
The plan references `@mcpc-tech/acp-ai-provider`. Should I verify this package exists and is suitable, or is there an alternative ACP implementation you prefer?
use that and same again please checked hte rferenced project which is cloend 

### Q6: Pairing Code Display
Where should the pairing code be displayed to the user?
- a) Only in the bridge CLI terminal output?
- b) Also via a `/pair/start` endpoint the extension can call?

which ever will be the best user experience , please check the dev-inspected-mcp project for reference


### Q7: Code Mode UI Location
For Phase 3, where should the bridge status indicator and agent selector appear?
- a) In the existing mode selector popover?
- b) As a new "Code Mode strip" above the chat input?
- c) Both?
a ) in the existsing mode selector popover 
---

## File Structure (Proposed)

```
packages/code-bridge/
├── package.json
├── tsconfig.json
└── src/
    ├── cli.ts              # Entry point   
    ├── server.ts           # HTTP server
    ├── http/
    │   ├── cors.ts
    │   ├── json.ts
    │   └── auth.ts
    ├── pairing/
    │   ├── pairing.ts
    │   └── tokenStore.ts
    └── acp/
        └── createProvider.ts

apps/extension/src/
├── services/codeBridge/
│   ├── healthCheck.ts
│   ├── pairing.ts
│   └── types.ts
├── ai/codeMode/
│   └── codeModeChat.ts
└── stores/codeMode/
    └── codeModeStore.ts    # (extend existing)
```

---

## Dependencies to Add

### code-bridge package
```json
{
  "dependencies": {
    "ai": "catalog:",
    "zod": "catalog:",
    "@mcpc-tech/acp-ai-provider": "^0.2.2"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

---

## Execution Order

1. **A1-A3**: Package setup + HTTP infrastructure
2. **A4**: Pairing & auth (can test with curl)
3. **B1-B3**: Extension bridge settings + health check + pairing UI
4. **A5-A6**: ACP integration + `/code/chat` endpoint
5. **B4-B5**: Code mode chat streaming + AI logic integration
6. **B6**: Minimal UI components

---

## Status
- [x] Questions answered
- [x] Implementation started
- [x] Part A complete (Bridge package)
- [x] Part B complete (Extension integration)
- [x] Phase 3 complete

## Implementation Summary

### Part A: `@cognito/code-bridge` Package
Created at `packages/code-bridge/`:
- `src/cli.ts` - CLI entry point with --port, --host, --cwd args
- `src/server.ts` - HTTP server with all endpoints
- `src/http/cors.ts` - CORS handling for chrome-extension://
- `src/http/json.ts` - JSON body parser and response helpers
- `src/http/auth.ts` - Bearer token authentication
- `src/pairing/pairing.ts` - Pairing code generation and confirmation
- `src/pairing/tokenStore.ts` - Token storage in ~/.cognito/bridge/tokens.json
- `src/acp/acpProvider.ts` - ACP provider for spawning CLI agents
- `src/patch/patchStore.ts` - In-memory patch storage
- `src/patch/gitApply.ts` - Safe git apply with validation
- `src/handlers/chat.ts` - SSE streaming chat handler
- `src/handlers/patch.ts` - Patch apply handler
- `src/agents.ts` - Agent definitions (Gemini CLI, Claude Code, Codex CLI)
- `src/types.ts` - TypeScript types

### Part B: Extension Integration
- Extended `codeModeStore` with bridge settings, health check, pairing
- Created `services/codeBridge/` with client functions
- Created `ai/codeMode/codeModeChat.ts` for streaming
- Updated `streamAIResponse.ts` to route code mode to bridge
- Added `dev:bridge` script to root package.json

### Usage
```bash
# Start the bridge (from project root)
pnpm dev:bridge

# Or with options
pnpm dev:bridge -- --port 9000 --cwd /path/to/project
```
