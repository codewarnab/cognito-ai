# CLI Mode - Architecture & Implementation Guide

CLI Mode enables the Cognito Chrome extension to communicate with a **local agent CLI** (Gemini CLI, Claude Code, Codex CLI) via a **local bridge server**.

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
│  │                  │        │        │         │     │  Claude/    │  │
│  │                  │        │        ▼         │     │  Codex)     │  │
│  │                  │        │  ┌────────────┐  │     └─────────────┘  │
│  │                  │        │  │   Local    │  │                      │
│  │                  │        │  │   Files    │  │                      │
│  │                  │        │  │   (Repo)   │  │                      │
│  │                  │        │  └────────────┘  │                      │
│  └──────────────────┘        └──────────────────┘                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. Extension (Side Panel)
- **Mode Selector**: `ToolsMode = 'cli'` switches to CLI Mode
- **Bridge Pairing Drawer**: 6-digit OTP input to pair with local bridge
- **Coding Agent Selector**: Select which local CLI agent to use

### 2. Local Bridge (`@cognito/code-bridge`)
- HTTP server on `http://127.0.0.1:8787`
- Handles pairing with extension
- Spawns agent CLI via ACP protocol
- **SSE `/events` endpoint** for real-time connection status:
  - Sends `connected` event on connection
  - Sends `bridge:closing` event immediately on shutdown (SIGINT/SIGTERM)
  - Periodic heartbeat to keep connection alive
- **Status streaming** during agent lifecycle (shown in LoadingIndicator):
  - `status` events sent: "Starting agent...", "Process spawned...", "Initializing protocol...", "Connected to agent...", "Creating session...", "Session ready", "Sending message..."

### 3. Agent CLI
- Gemini CLI, Claude Code, or Codex CLI
- Runs via ACP (Agent Control Protocol)

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

### Sequence 2: Chat

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Side Panel  │     │    Bridge    │     │  Agent CLI   │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │ 1. User sends      │                    │
       │    "Hello agent"   │                    │
       │                    │                    │
       │ POST /code/chat    │                    │
       │ {messages, agent}  │                    │
       │───────────────────►│                    │
       │                    │                    │
       │                    │ 2. Spawns agent    │
       │                    │    via ACP         │
       │                    │───────────────────►│
       │                    │                    │
       │                    │ 3. Agent replies   │
       │                    │◄───────────────────│
       │                    │                    │
       │ 4. Stream response │                    │
       │◄───────────────────│                    │
       │                    │                    │
```

---

## File Structure

### Extension Files

```
apps/extension/src/
├── stores/cliMode/
│   ├── cliModeStore.ts            # Zustand store
│   └── types.ts                   # State types
├── components/
│   ├── features/cliMode/
│   │   ├── CodingAgentSelector.tsx    # Agent selection UI
│   │   └── BridgePairingDrawer.tsx    # 6-digit pairing code entry
│   └── ui/primitives/input-otp/
│       └── input-otp.tsx              # Animated OTP input components
├── services/
│   └── codeBridge.ts              # Bridge API client
├── ai/cliMode/
│   └── cliModeChat.ts             # CLI mode chat handler
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
├── handlers/
│   └── chat.ts                    # /code/chat handler
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

### Chat SSE Event Types

| Event | Payload | Description |
|-------|---------|-------------|
| `status` | `{message: string}` | Agent lifecycle status for LoadingIndicator |
| `text` | `{content: string}` | Streamed text response from agent |
| `tool_call` | `{toolName, toolCallId, args}` | Tool invocation |
| `error` | `{error: string}` | Error message |
| `done` | `{}` | Stream complete |

### Extension Store State

```typescript
interface CliModeState {
  // Bridge connection
  bridgeBaseUrl: string;
  bridgeToken: string | null;
  bridgeStatus: 'connected' | 'needs-pairing' | 'offline';
  isCheckingBridge: boolean;

  // Agent selection
  selectedAgentName: string;
  availableAgents: AgentInfo[];

  // Agent status (for LoadingIndicator)
  agentStatus: string | null;
}
```

---

## Security Considerations

1. **Localhost Only**: Bridge binds to `127.0.0.1`, never `0.0.0.0`
2. **Pairing Token**: Required for all `/code/*` endpoints
3. **CORS Allowlist**: Only `chrome-extension://*` and `localhost`
