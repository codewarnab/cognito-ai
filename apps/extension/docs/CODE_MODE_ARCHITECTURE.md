# Code Mode - Complete Architecture & Implementation Guide

Code Mode enables the Cognito Chrome extension to communicate with a **local coding agent CLI** (Gemini CLI, Claude Code, Codex CLI) via a **local bridge server** to edit source files on the user's machine.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER'S MACHINE                                  │
│                                                                         │
│  ┌──────────────────┐        ┌──────────────────┐                      │
│  │  Chrome Browser  │        │   Local Bridge   │                      │
│  │                  │  HTTP  │   (Port 8787)    │                      │
│  │  ┌────────────┐  │◄──────►│                  │                      │
│  │  │ Side Panel │  │        │  ┌────────────┐  │     ┌─────────────┐  │
│  │  │ (Extension)│  │        │  │ ACP Client │──┼────►│ Agent CLI   │  │
│  │  └────────────┘  │        │  └────────────┘  │     │ (Gemini/    │  │
│  │        │         │        │        │         │     │  Claude/    │  │
│  │        ▼         │        │        ▼         │     │  Codex)     │  │
│  │  ┌────────────┐  │        │  ┌────────────┐  │     └─────────────┘  │
│  │  │  Content   │  │        │  │   Local    │  │                      │
│  │  │  Script    │  │        │  │   Files    │  │                      │
│  │  │ (Picker)   │  │        │  │   (Repo)   │  │                      │
│  │  └────────────┘  │        │  └────────────┘  │                      │
│  └──────────────────┘        └──────────────────┘                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. Extension (Side Panel)
- **Mode Selector**: `ToolsMode = 'code'` switches to Code Mode
- **Bridge Pairing Drawer**: 6-digit OTP input to pair with local bridge
- **Element Picker Button**: Triggers DOM element selection
- **Patch Proposal Card**: Displays diffs with Apply/Deny controls
- **Editor Buttons**: Open files in VSCode/Cursor

### 2. Content Script (`code-picker.content.ts`)
- Injects picker overlay on page
- Captures element context (selector, classes, text, bounding box)
- Returns context to side panel via messaging

### 3. Local Bridge (`@cognito/code-bridge`)
- HTTP server on `http://127.0.0.1:8787`
- Handles pairing with extension
- Spawns agent CLI via ACP protocol
- Stores and applies patches
- **SSE `/events` endpoint** for real-time connection status:
  - Sends `connected` event on connection
  - Sends `bridge:closing` event immediately on shutdown (SIGINT/SIGTERM)
  - Periodic heartbeat to keep connection alive
- **Status streaming** during agent lifecycle (shown in LoadingIndicator):
  - `status` events sent: "Starting agent...", "Process spawned...", "Initializing protocol...", "Connected to agent...", "Creating session...", "Session ready", "Sending message..."

### 4. Agent CLI
- Gemini CLI, Claude Code, or Codex CLI
- Runs via ACP (Agent Control Protocol)
- Proposes patches via `propose_patch` tool

---

## Data Flow Sequences

### Sequence 1: Pairing

```
┌──────────────┐                    ┌──────────────┐
│   Extension  │                    │    Bridge    │
└──────┬───────┘                    └──────┬───────┘
       │                                   │
       │  1. Bridge starts, prints code    │
       │     "123-456" to terminal         │
       │                                   │
       │  2. User enters code in extension │
       │                                   │
       │  POST /pair/confirm {code}        │
       │──────────────────────────────────►│
       │                                   │
       │  {token: "abc123..."}             │
       │◄──────────────────────────────────│
       │                                   │
       │  3. Extension stores token        │
       │                                   │
```

### Sequence 2: Element Picking

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Side Panel  │     │  Background  │     │Content Script│
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │ 1. User clicks     │                    │
       │    "Pick Element"  │                    │
       │                    │                    │
       │ code/picker/start  │ code/picker/start  │
       │───────────────────►│───────────────────►│
       │                    │                    │
       │                    │         2. Shows picker overlay
       │                    │            User clicks element
       │                    │                    │
       │   {ok, context}    │   {ok, context}    │
       │◄───────────────────│◄───────────────────│
       │                    │                    │
       │ 3. Shows element   │                    │
       │    chip in UI      │                    │
       │                    │                    │
```

### Sequence 3: Chat & Patch Proposal

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Side Panel  │     │    Bridge    │     │  Agent CLI   │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │ 1. User sends      │                    │
       │    "Fix this btn"  │                    │
       │                    │                    │
       │ POST /code/chat    │                    │
       │ {messages, agent,  │                    │
       │  elementContext}   │                    │
       │───────────────────►│                    │
       │                    │                    │
       │                    │ 2. Spawns agent    │
       │                    │    via ACP         │
       │                    │───────────────────►│
       │                    │                    │
       │                    │ 3. Agent analyzes, │
       │                    │    proposes patch  │
       │                    │◄───────────────────│
       │                    │                    │
       │ 4. Stream response │                    │
       │    + propose_patch │                    │
       │    tool call       │                    │
       │◄───────────────────│                    │
       │                    │                    │
       │ 5. Renders diff    │                    │
       │    in Patch Card   │                    │
       │                    │                    │
```

### Sequence 4: Apply Patch

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Side Panel  │     │    Bridge    │     │  Local Files │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │ 1. User clicks     │                    │
       │    "Apply" button  │                    │
       │                    │                    │
       │ POST /code/patch/  │                    │
       │ apply {patchId}    │                    │
       │───────────────────►│                    │
       │                    │                    │
       │                    │ 2. git apply       │
       │                    │    --check         │
       │                    │───────────────────►│
       │                    │                    │
       │                    │ 3. git apply       │
       │                    │───────────────────►│
       │                    │                    │
       │ {applied: true,    │                    │
       │  filesChanged}     │                    │
       │◄───────────────────│                    │
       │                    │                    │
       │ 4. Shows success   │                    │
       │    + reload hint   │                    │
       │                    │                    │
```

### Sequence 5: Open in Editor

```
┌──────────────┐     ┌──────────────┐
│  Side Panel  │     │    Editor    │
└──────┬───────┘     └──────┬───────┘
       │                    │
       │ 1. User hovers     │
       │    file in patch   │
       │                    │
       │ 2. Clicks VSCode   │
       │    icon            │
       │                    │
       │ window.open(       │
       │ "vscode://file/    │
       │  /path/to/file")   │
       │───────────────────►│
       │                    │
       │              3. Editor opens file
       │                    │
```

---

## File Structure

### Extension Files

```
apps/extension/src/
├── entrypoints/contents/
│   └── code-picker.content.ts     # Element picker overlay
├── stores/codeMode/
│   ├── codeModeStore.ts           # Zustand store
│   └── types.ts                   # State types
├── components/
│   ├── features/codeMode/
│   │   ├── ElementPickerButton.tsx    # Picker trigger
│   │   ├── ElementContextChip.tsx     # Selected element display
│   │   ├── BridgePairingDrawer.tsx    # 6-digit pairing code entry
│   │   ├── PatchProposalCard.tsx      # Diff viewer + Apply/Deny
│   │   ├── DiffViewer.tsx             # Unified diff renderer
│   │   └── diffUtils.ts               # Diff parsing utilities
│   └── ui/primitives/input-otp/
│       └── input-otp.tsx              # Animated OTP input components
├── services/
│   └── codeBridge.ts              # Bridge API client
├── ai/codeMode/
│   ├── codeModeChat.ts            # Code mode chat handler
│   └── usePatchProposalTool.tsx   # Patch proposal tool hook

```


### Bridge Files

```
packages/code-bridge/src/
├── cli.ts                         # CLI entrypoint
├── server.ts                      # HTTP server
├── agents.ts                      # Agent definitions
├── types.ts                       # Type definitions
├── http/
│   ├── cors.ts                    # CORS middleware
│   ├── json.ts                    # JSON body parser
│   └── auth.ts                    # Token auth middleware
├── pairing/
│   ├── pairing.ts                 # Pairing flow
│   └── tokenStore.ts              # Token persistence
├── patch/
│   ├── patchStore.ts              # In-memory patch storage
│   └── gitApply.ts                # git apply wrapper
├── handlers/
│   ├── chat.ts                    # /code/chat handler
│   └── patch.ts                   # /code/patch/apply handler
└── acp/
    └── createProvider.ts          # ACP adapter
```

---

## API Reference

### Bridge Endpoints

| Method | Path              | Auth | Description                    |
|--------|-------------------|------|--------------------------------|
| GET    | /health           | No   | Health check, returns `cwd`    |
| GET    | /events           | No   | SSE stream for real-time status |
| POST   | /pair/start       | No   | Generate pairing code          |
| POST   | /pair/confirm     | No   | Exchange code for token        |
| GET    | /agents           | No   | List available agents          |
| POST   | /code/chat        | Yes  | Stream chat with agent         |
| POST   | /code/patch/apply | Yes  | Apply stored patch             |

### Chat SSE Event Types

| Event | Payload | Description |
|-------|---------|-------------|
| `status` | `{message: string}` | Agent lifecycle status for LoadingIndicator |
| `text` | `{content: string}` | Streamed text response from agent |
| `tool_call` | `{toolName, toolCallId, args}` | Tool invocation |
| `patch_proposal` | `{patchId, unifiedDiff, summary}` | Code patch proposal |
| `error` | `{error: string}` | Error message |
| `done` | `{}` | Stream complete |

### Extension Store State

```typescript
interface CodeModeState {
  // Element picker
  elementContext: CodeModeElementContext | null;
  isPicking: boolean;

  // Bridge connection
  bridgeBaseUrl: string;
  bridgeToken: string | null;
  bridgeStatus: 'connected' | 'needs-pairing' | 'offline';
  isCheckingBridge: boolean;
  repoCwd: string | null;

  // Agent selection
  selectedAgentName: string;
  availableAgents: AgentInfo[];

  // Agent status (for LoadingIndicator)
  agentStatus: string | null;

  // Patches
  patches: Record<string, PatchState>;
}
```

---

## Implementation Phases

| Phase | Status | Description                                      |
|-------|--------|--------------------------------------------------|
| 1     | ✅     | Add `code` to ToolsMode, UI selector             |
| 2     | ✅     | Element picker content script + messaging        |
| 3     | ✅     | Bridge package, pairing, chat streaming          |
| 4     | ✅     | PatchProposalCard, DiffViewer, apply/deny flow   |
| 5     | ✅     | VSCode/Cursor editor buttons, repoCwd tracking   |

---

## Security Considerations

1. **Localhost Only**: Bridge binds to `127.0.0.1`, never `0.0.0.0`
2. **Pairing Token**: Required for all `/code/*` endpoints
3. **CORS Allowlist**: Only `chrome-extension://*` and `localhost`
4. **Sensitive Input Protection**: Picker rejects password/CC fields
5. **Safe Diff Validation**: Paths checked for traversal attacks
6. **git apply --check**: Dry run before actual apply

---

## Running Code Mode

### 1. Start the Bridge

```bash
cd packages/code-bridge
pnpm dev
# Or from monorepo root:
pnpm --filter @cognito/code-bridge dev
```

### 2. Pair with Extension

1. Copy the pairing code from bridge terminal
2. Switch to Code mode in extension
3. Enter code when prompted
4. Status should show "Connected"

### 3. Use Code Mode

1. Click "Pick Element" to select a DOM element
2. Type instruction (e.g., "Change this button to red")
3. Agent proposes changes as a diff
4. Review diff, click Apply or Deny
5. Reload page to see changes

---

## Troubleshooting

| Issue                    | Solution                                      |
|--------------------------|-----------------------------------------------|
| Bridge offline           | Run `pnpm dev` in code-bridge package         |
| Pairing fails            | Check code expiry, restart bridge             |
| Agent not found          | Install agent CLI, check PATH                 |
| Patch apply fails        | Check git status, resolve conflicts           |
| Editor link doesn't work | Install VSCode/Cursor, enable URL handler     |
