# @cognito/code-bridge

Local bridge server for Code Mode in the Cognito Chrome extension. This server enables the extension to communicate with local CLI coding agents (Gemini CLI, Claude Code, Codex CLI) via ACP (Agent Communication Protocol).

## Overview

Chrome extensions cannot spawn local processes directly. This bridge server runs on localhost and:
- Spawns local agent CLIs via ACP
- Streams responses back to the extension via SSE
- Manages patch proposals and applies them via `git apply`
- Handles secure pairing with the extension

## Usage

### Development

```bash
# From monorepo root
pnpm dev:bridge

# With options
pnpm dev:bridge -- --port 9000 --cwd /path/to/project
```

### CLI Options

```
--port <number>   Port to listen on (default: 8787)
--host <string>   Host to bind to (default: 127.0.0.1)
--cwd <path>      Working directory for file operations (default: current directory)
--help, -h        Show help message
```

## API Endpoints

### Health Check
```
GET /health
Response: { ok: true, version: "0.0.1", cwd: "/path/to/project" }
```

### Pairing
```
POST /pair/start
Response: { code: "123-456", expiresAt: 1234567890 }

POST /pair/confirm
Body: { code: "123-456" }
Response: { token: "..." }
```

### Agents
```
GET /agents
Response: { agents: [{ name, command, args, available, envHints }] }
```

### Chat (requires auth)
```
POST /code/chat
Headers: Authorization: Bearer <token>
Body: { messages, elementContext?, agent, sessionId? }
Response: SSE stream with events: text, patch_proposal, tool_call, tool_result, error, done
```

### Apply Patch (requires auth)
```
POST /code/patch/apply
Headers: Authorization: Bearer <token>
Body: { patchId: "..." }
Response: { applied: true, filesChanged: ["file1.ts", "file2.ts"] }
```

## Security

- Binds to `127.0.0.1` only (localhost)
- Requires pairing code exchange before use
- All authenticated endpoints require Bearer token
- Tokens stored hashed in `~/.cognito/bridge/tokens.json`
- Patches validated for path traversal before apply

## Supported Agents

| Agent | Command | Required Env |
|-------|---------|--------------|
| Gemini CLI | `gemini --experimental-acp` | `GEMINI_API_KEY` |
| Claude Code | `claude --acp` | `ANTHROPIC_API_KEY` |
| Codex CLI | `codex --acp` | `OPENAI_API_KEY` |
