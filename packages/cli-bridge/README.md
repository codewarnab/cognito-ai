# cognito-cli-bridge

Local bridge server that connects the **Cognito Chrome extension** to CLI coding agents — [Gemini CLI](https://github.com/google-gemini/gemini-cli), [Claude Code](https://docs.anthropic.com/en/docs/claude-code), and [Codex CLI](https://github.com/openai/codex). The bridge exposes extension tools (page reading, screenshots, navigation, etc.) to these agents via **MCP (Model Context Protocol)** and streams agent responses back to the extension in real time.

## Why?

Chrome extensions can't spawn local processes. This bridge runs on localhost and acts as the middleman:

1. **Extension → Bridge** — sends chat messages + registers browser tools
2. **Bridge → Agent** — invokes the CLI agent with the AI SDK, passing extension tools
3. **Agent → Bridge → Extension** — streams text, tool calls, and results back via SSE

```
┌──────────────┐       HTTP/SSE        ┌──────────────┐      AI SDK       ┌──────────────┐
│   Cognito    │ ──────────────────────▶│   CLI Bridge │ ────────────────▶│  Gemini CLI  │
│  Extension   │ ◀──────────────────── │  (localhost)  │ ◀──────────────── │  Claude Code │
│              │   tool registration   │              │   tool execution  │  Codex CLI   │
└──────────────┘   + chat streaming    └──────────────┘                   └──────────────┘
                                              │
                                              │ MCP (Streamable HTTP)
                                              ▼
                                       ┌──────────────┐
                                       │  MCP Clients │
                                       │ (any client) │
                                       └──────────────┘
```

## Quick Start

```bash
npx cognito-cli-bridge@latest
```

The bridge will:
- Start an HTTP server on `http://127.0.0.1:8787`
- Auto-detect installed CLI agents (Gemini CLI, Claude Code, Codex CLI)
- Auto-configure each agent's MCP settings to point at the bridge
- Wait for the Cognito extension to connect

## CLI Options

```
cognito-bridge [options]

Options:
  --port <number>        Port to listen on (default: 8787)
  --host <string>        Host to bind to (default: 127.0.0.1)
  --gemini-model <id>    Gemini model for local chat (default: gemini-2.5-flash)
  --no-auto-setup        Skip automatic CLI tool configuration
  --help, -h             Show help message

Environment Variables:
  COGNITO_BRIDGE_ALLOW_LOCAL_ACCESS=true   Disable sandbox isolation (NOT recommended)
  CODEX_APPROVAL_MODE=<mode>              Codex approval mode (default: on-failure)
  CODEX_SANDBOX_MODE=<mode>               Codex sandbox mode (default: read-only)
```

## Supported Agents

Each agent is invoked via its [AI SDK provider](https://sdk.vercel.ai/), enabling native tool calling and streaming:

| Agent | AI SDK Provider | Required Env |
|-------|----------------|--------------|
| Gemini CLI | `ai-sdk-provider-gemini-cli` | `GEMINI_API_KEY` |
| Claude Code | `ai-sdk-provider-claude-code` | `ANTHROPIC_API_KEY` |
| Codex CLI | `ai-sdk-provider-codex-cli` | `OPENAI_API_KEY` |

The bridge auto-detects which agents are installed and configures their MCP settings automatically.

## How It Works

### Tool Bridge

The extension registers its browser tools (e.g., `readPageContent`, `takeScreenshot`, `navigateTo`) with the bridge. When a CLI agent calls one of these tools, the bridge:

1. Forwards the tool call to the extension via SSE
2. The extension executes it in the browser
3. Returns the result back to the agent

This gives CLI agents real-time browser context they wouldn't otherwise have.

### MCP Server

The bridge also runs an **MCP server** at `/mcp` (Streamable HTTP transport). Any MCP-compatible client can connect to discover and call extension tools — not just the three built-in agents.

### Auto-Setup

On startup, the bridge automatically writes MCP configuration for detected CLIs:

| CLI | Config File |
|-----|------------|
| Gemini CLI | `~/.gemini/settings.json` |
| Claude Code | `~/.claude/mcp.json` |
| Codex CLI | `~/.codex/config.json` |

Use `--no-auto-setup` to skip this.

## API Endpoints

### Public (no auth)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check — returns `{ ok, version, cwd }` |
| `GET` | `/events` | SSE stream for real-time connection status |
| `GET` | `/agents` | List available agents with availability status |

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/connect` | Auto-connect handshake (Origin-validated) — returns auth token |
| `POST` | `/validate` | Validate an existing token |

### Chat (auth required)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/cli/chat` | Send messages to an agent — returns SSE stream with `text`, `tool_call`, `tool_result`, `error`, `done` events |

### Tool Bridge (auth required)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/bridge/tools/register` | Register extension tools |
| `GET` | `/bridge/tools` | List registered tools |
| `POST` | `/bridge/tools/call` | Execute a tool on the extension |
| `POST` | `/bridge/tools/result` | Receive tool execution result |
| `GET` | `/bridge/tools/events` | SSE stream for tool execution requests |

### MCP

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/mcp` | MCP Streamable HTTP transport |
| `DELETE` | `/mcp` | Cleanup MCP session |

## Security

- **Localhost only** — binds to `127.0.0.1`, not accessible from the network
- **Origin validation** — `POST /connect` validates the Chrome extension Origin header
- **Token auth** — all sensitive endpoints require `Authorization: Bearer <token>`
- **Sandbox isolation** — agents run in an isolated temp directory by default, preventing access to local project files
- **Read-only sandbox** — Codex CLI defaults to `read-only` sandbox mode

## Development

```bash
# From monorepo root
pnpm dev:bridge

# With options
pnpm dev:bridge -- --port 9000 --gemini-model gemini-2.5-pro
```

## License

MIT
