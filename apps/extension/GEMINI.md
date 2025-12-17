# Cognito AI Extension

**Cognito** is a privacy-first, AI-powered Chrome extension built with [WXT](https://wxt.dev/). This is part of a **pnpm monorepo** containing the Chrome extension, documentation site, and backend services.

## Key Features

- **AI Side Panel:** Interactive chat interface accessible via `Ctrl+Shift+H` (or `Cmd+Shift+H`), built with React and Tailwind CSS.    
- **Model Context Protocol (MCP):** Implements an MCP client to dynamically discover and connect to "MCP servers," extending the agent's capabilities.
- **Privacy-First Memory:** Uses `Dexie` (IndexedDB) to store user data locally within the browser.
- **Workflow Automation:** Supports "Smart Actions" and workflows to automate browser tasks.
- **Voice Mode:** ElevenLabs integration for conversational AI.
- **YouTube Integration:** Dedicated API for fetching video transcripts.

## Extension Structure

```text
apps/extension/
├── src/
│   ├── entrypoints/            # WXT entrypoints
│   │   ├── sidepanel/          # Main UI entry point (React)
│   │   ├── background/         # Background Service Worker (MCP, messaging)
│   │   └── contents/           # Content scripts
│   ├── actions/                # Browser automation actions
│   ├── ai/                     # AI model integration & prompts
│   ├── components/             # Reusable React UI components
│   ├── mcp/                    # Model Context Protocol client
│   ├── memory/                 # Local database (Dexie)
│   └── workflows/              # Automation workflows
├── wxt.config.ts               # WXT configuration
└── package.json
```

## Development Workflow

```bash
# Install all dependencies
pnpm install

# Start extension development
pnpm dev

# Start docs development  
pnpm dev:docs

# Build extension for production
pnpm build:extension

# Deploy Cloudflare Worker
pnpm deploy:cloudflare
```

### Package-Specific Commands

```bash
# Run command in specific package
pnpm --filter @cognito/extension dev
pnpm --filter @cognito/docs build
```

## Key Commands

- `pnpm dev`: Start extension dev server with hot reload
- `pnpm build`: Build all packages
- `pnpm build:extension`: Build Chrome extension for production
- `pnpm dev:docs`: Start documentation site
- `pnpm deploy:cloudflare`: Deploy ElevenLabs proxy

## Important Notes

- **Monorepo Docs:** See `MONOREPO.md` for architecture details, deployment guides, and migration guides.
- **MCP Implementation:** Check `apps/extension/src/entrypoints/background/` and `apps/extension/src/mcp/` to understand MCP connections.
- **Permissions:** The manifest configuration in `wxt.config.ts` lists Chrome extension permissions.
- **Load Extension:** Load `.output/chrome-mv3` as unpacked extension in Chrome.

## Configuration

The extension supports configuration via Environment Variables. Copy `apps/extension/.env.example` to `apps/extension/.env` to customize:

| Variable | Description | Default |
|----------|-------------|---------|
| `WXT_TRANSCRIPT_API_URL` | YouTube Transcript API Endpoint | Vercel Prod |
| `WXT_RETRIEVE_API_URL` | URL Retrieval API Endpoint | Vercel Prod |
| `WXT_HIDE_LOCAL_MODE` | Hide Local LLM features | `true` |
| `WXT_YOUTUBE_BADGE_PREFETCH` | Auto-prefetch transcripts | `true` |
| `WXT_LOG_PRESET` | Logging Level | `DEVELOPMENT` |

## Logger Categories

All `createLogger` calls MUST include a category as the second argument:

```typescript
import { createLogger } from '~logger';
const log = createLogger('FeatureName', 'CATEGORY');
```

**Available Categories:**
- **MCP**: `MCP_CLIENT`, `MCP_TOOLS`, `MCP_EXECUTION`, `MCP_AUTH`, `MCP_SSE`, `WEBMCP`
- **Tools**: `TOOLS_REGISTRY`, `TOOLS_EXECUTION`, `TOOLS_VALIDATION`, `TOOLS_INTEGRATION`
- **AI**: `AI_CHAT`, `AI_PROMPTS`, `AI_VOICE`, `AI_WEBSITE_DETECTION`
- **Voice**: `VOICE_RECORDING`, `VOICE_CLIENT`, `VOICE_UI`, `VOICE_AUDIO`
- **Memory**: `MEMORY_OPERATIONS`, `MEMORY_SUGGESTIONS`
- **UI**: `UI_CHAT`, `UI_VOICE`, `UI_SETTINGS`, `UI_THREADS`, `UI_SIDEPANEL`, `UI_REMINDERS`
- **System**: `BACKGROUND`, `STORAGE`, `UTILS`, `NOTIFICATIONS`, `CREDENTIALS`, `SEARCH`, `SETTINGS`, `WORKFLOW`, `BROWSER`, `ATTACHMENTS`, `CONTENT_SCRIPTS`
