# Option B Plan: Gemini (AI SDK Provider) + Extension Tools via Code Bridge

## Summary

Implement **Option B**: keep the extension chat UI, but change the local bridge (`@cognito/code-bridge`) to run the chat loop using **Vercel AI SDK v6** with **`ai-sdk-provider-gemini-cli`** (Gemini “CLI quota” via local OAuth creds), and execute **browser tools inside the extension** using the already-built **Tool Bridge** (SSE + `/bridge/tools/*` endpoints).

This avoids ACP+MCP complexity for the first milestone and gives us a clean path to later support **Claude** and **Codex** with the same architecture.

---

## Context (Current State)

### What already works today

- **Extension ⇄ Bridge pairing**
  - Bridge runs on `http://127.0.0.1:8787`
  - Extension pairs with OTP and stores a `bridgeToken`
  - The bridge enforces token auth on sensitive endpoints

- **Extension tools already exposed to the bridge**
  - Extension registers tool schemas with the bridge:
    - `POST /bridge/tools/register` (authenticated)
  - Extension subscribes to tool execution requests:
    - `GET /bridge/tools/events` (authenticated SSE)
  - Extension executes tools locally (in browser context) and returns results:
    - `POST /bridge/tools/result` (authenticated)
  - Bridge can also call tools synchronously:
    - `POST /bridge/tools/call` (currently not authenticated, but is local-only)

- **Extension chat UI already streams responses from the bridge**
  - `apps/extension/src/ai/cliMode/cliModeChat.ts`
  - Calls `POST /cli/chat` and consumes SSE events:
    - `status`, `text`, `tool_call`, `tool_result`, `error`, `done`

### What’s problematic with “Option A” (ACP + MCP) for now

- ACP agents get tools via **MCP** (`newSession.mcpServers`) and tool updates must be surfaced properly.
- Our `/mcp` server exists but requires additional wiring and schema reconciliation.
- We want a faster, simpler, reliable first delivery: **AI SDK tool calling + existing tool bridge**.

---

## Goal (Option B – Gemini first)

### Primary user experience goal

From inside the extension chat UI, user can:

- Chat normally
- The assistant can autonomously:
  - Navigate tabs
  - Read page content
  - Use WebMCP tools
  - Use MCP tools that the extension already knows about (optional)
  - Use any extension-approved browser automation tool

And all “agentic” actions are powered by **Gemini via the Gemini CLI credentials/quota**, without the user needing to copy API keys into the extension.

### Technical goal

In `@cognito/code-bridge`:

- Use `ai-sdk-provider-gemini-cli` as the model provider (Node runtime).
- Expose an HTTP endpoint that the extension uses (reuse `/cli/chat` if desired).
- Convert extension tool schemas into AI SDK tools and execute tool calls by proxying to the extension.
- Stream output back to the extension in the existing SSE event format.

---

## Non-Goals (for the first milestone)

- No ACP spawning (no `gemini --experimental-acp`).
- No MCP server registration required for Gemini CLI (that was Option A).
- No multi-agent orchestration.
- No remote backend mode changes.

---

## Key Decision: Where Gemini runs

Gemini must run in **Node.js** (the bridge), not inside the extension:

- `ai-sdk-provider-gemini-cli` requires Node (>= 20) and local credential access.
- The extension remains the **tool execution runtime** (browser).

So the execution split is:

- **Reasoning / planning / tool selection**: Bridge (Gemini)
- **Tool execution**: Extension (browser)

---

## Architecture Overview

```text
┌─────────────────────────┐
│ Chrome Extension (UI)   │
│  - chat panel           │
│  - tool execution       │
└─────────┬───────────────┘
          │ HTTP (paired token)
          ▼
┌─────────────────────────┐
│ @cognito/code-bridge    │
│  - AI SDK chat loop     │
│  - Gemini provider      │
│  - tool proxy to ext    │
│  - SSE streaming        │
└─────────┬───────────────┘
          │ SSE tool:execute + POST result
          ▼
┌─────────────────────────┐
│ Chrome Extension (bg)   │
│  - executes tools       │
│  - returns results      │
└─────────────────────────┘
```

---

## Data Flow (End-to-End)

### 1) Pairing + tool registration (already implemented)

1. User runs bridge (`pnpm --filter @cognito/code-bridge dev` or `cognito-bridge`)
2. User enters pairing code in extension → extension receives `bridgeToken`
3. Extension registers its tool schemas with bridge (`/bridge/tools/register`)
4. Extension connects to `/bridge/tools/events` and starts listening for tool exec requests

### 2) Chat request

1. Extension posts to bridge (existing):
   - `POST /cli/chat` (auth required)
2. Bridge starts AI SDK streaming response to extension via SSE:
   - `status` events for progress
   - `text` events for assistant output
   - `tool_call` when Gemini asks to invoke a tool
3. For each tool call, bridge executes via tool-bridge:
   - broadcast `tool:execute` to extension
   - await `/bridge/tools/result`
4. Bridge feeds tool result back into the AI SDK tool-calling loop
5. When complete: `done`

---

## Implementation Plan (Step-by-step)

### Phase 0 — Decide minimal interface stability (recommended)

Keep the existing extension-side integration stable by:

- **Reusing the `/cli/chat` endpoint** and event types
- Avoiding any changes in `apps/extension/src/ai/cliMode/cliModeChat.ts`

So the work is mostly inside `packages/code-bridge`.

### Phase 1 — Add Gemini AI SDK provider to code-bridge

- Add dependency (workspace/local):
  - `ai-sdk-provider-gemini-cli`
  - Ensure Node version requirement is satisfied by local environment (>= 20)

Bridge responsibilities:

- Create a Gemini provider instance:
  - `createGeminiProvider({ authType: 'oauth-personal' })` as default
  - Later allow `api-key` fallback for users who want it
- Choose initial model default (configurable):
  - e.g. `gemini-3-flash-preview` or `gemini-3-pro-preview`

### Phase 2 — Convert extension tool schemas → AI SDK tools

Inputs:

- Extension tool registry stored in bridge after `/bridge/tools/register`:
  - name
  - description
  - parameters (JSON schema-ish object)

Desired output:

- AI SDK “function tools” with:
  - `name`
  - `description`
  - `parameters` / schema
  - `execute(args)` -> calls `executeToolOnExtension(toolName, args)`

Key considerations:

- **Schema format**
  - Extension provides JSON schema; AI SDK can accept JSON schema-like shapes (or Zod).
  - Keep it simple: pass JSON schema directly if compatible; otherwise normalize to a minimal object schema.

- **Tool names**
  - Must be stable and unique.
  - If MCP tools or WebMCP tools are included, ensure naming collisions are avoided (prefixing if needed).

- **User tool enable/disable settings**
  - The extension currently filters tools on its side when it sends schemas.
  - That’s fine; bridge should trust the “registered tools set” as the allowed set.

### Phase 3 — Implement the AI SDK streaming + tool loop in the bridge

Implement a new handler (or replace the internals of existing `/cli/chat`) that:

- Validates auth token (same as today)
- Converts incoming messages to AI SDK format
- Supplies tools built from the registered extension tools
- Streams text deltas to the extension via SSE
- On tool call:
  - emit `tool_call` SSE event
  - execute via tool-bridge
  - emit `tool_result` SSE event
  - return the tool result back to AI SDK so it continues

Event mapping to preserve current UI behavior:

- `status`: bridge lifecycle updates (initializing model, running tool, waiting for extension, etc.)
- `text`: assistant streaming output
- `tool_call`: `{ toolName, toolCallId, args }`
- `tool_result`: `{ toolCallId, result }`
- `error`: `{ error }`
- `done`: end of stream

### Phase 4 — Minimal UX: “Gemini only” agent selection

In the extension, “CLI mode agent dropdown” currently lists:
- Gemini CLI, Claude Code, Codex CLI (ACP)

For Option B, we have two choices:

1) **Temporary**: Keep dropdown but treat it as “provider selection”, where only Gemini is enabled.
2) **Clean**: Add a new “Local Gemini (AI SDK)” entry and hide/disable others until later.

The plan recommends (2) so later we can add:
- “Local Claude (AI SDK)” using Anthropic provider
- “Local Codex (AI SDK)” using OpenAI provider

### Phase 5 — Configuration surface

Bridge configuration (CLI flags and/or env):

- Model ID: `--gemini-model <id>`
- Auth:
  - default: oauth personal via Gemini CLI creds
  - optional: api key override (env var)
- Verbose logs flag

Extension configuration:

- none required for first milestone (reuse existing pairing + chat)

### Phase 6 — Security + trust

Keep current constraints:

- Bind to `127.0.0.1`
- Require pairing token for:
  - `/cli/chat`
  - `/bridge/tools/register`
  - `/bridge/tools/events`
  - `/bridge/tools/result`

Recommended hardening:

- Also require auth for `/bridge/tools/call` (currently unauthenticated).
- Add origin allowlist for the extension id only (optional).

### Phase 7 — Observability + debugging

Add clear logs and status messages:

- When tools are registered:
  - tool count
  - connected tool execution client count
- For each tool call:
  - tool name
  - args size
  - duration
  - success/failure

---

## API/Contract Details

### `/cli/chat` request (extension → bridge)

Keep existing:

- `messages: [{ role, content: [{type:'text'|'image'|'audio'|'resource', ...}] }]`
- `agent: { name, command, args }` (can be repurposed; for Option B only `name` matters)

Bridge internal mapping:

- Build AI SDK prompt from latest user message + optional conversation history

### SSE response (bridge → extension)

Keep existing event types:

- `event: status` → `{ message: string }`
- `event: text` → `{ content: string }`
- `event: tool_call` → `{ toolName: string, toolCallId: string, args: object }`
- `event: tool_result` → `{ toolCallId: string, result: unknown }`
- `event: error` → `{ error: string }`
- `event: done` → `{}`

---

## Testing / Verification Plan

### Local manual test (happy path)

1. Start bridge
2. Pair extension
3. Confirm tools registered (log shows count)
4. In extension chat:
   - “Navigate to https://example.com then read the page title”
5. Expect:
   - tool_call events
   - extension performs navigation
   - tool_result events
   - assistant responds with title

### Failure modes

- **No extension connected for tool execution**
  - Bridge should return tool error immediately with helpful message
- **Tool execution times out**
  - Bridge returns tool error + continues/aborts depending on AI SDK behavior
- **Gemini OAuth missing**
  - Bridge returns error telling user to run `gemini` once and complete login (or show path to creds)

---

## Future Expansion (Claude + Codex)

Once Option B is stable for Gemini:

- Add additional AI SDK providers inside the bridge:
  - Anthropic (Claude)
  - OpenAI (Codex / GPT)
- Reuse the exact same tool wrapper layer:
  - The tools remain extension-executed
  - Only provider/model selection changes
- Add per-provider auth configuration:
  - env vars / local credentials
  - optionally secure storage instructions

---

## Open Questions (to answer during implementation)

1. **Conversation memory**: should the bridge pass full history, or only last user message + summarized context?
2. **Tool approval UI**: should the extension still run its tool approval flows the same way for locally-triggered tool calls?
3. **WebMCP/MCP tools**: do we include them in the tool set for Gemini immediately, or start with “built-in extension tools only”?
4. **Model choice**: default to `gemini-3-flash-preview` (speed) or `gemini-3-pro-preview` (reasoning)?

