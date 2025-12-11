# Cognito AI Monorepo

**Cognito** is a privacy-first, AI-powered Chrome extension built with the [Plasmo](https://docs.plasmo.com/) framework. This is a **pnpm monorepo** containing the Chrome extension, documentation site, and backend services.

## Key Features

- **AI Side Panel:** Interactive chat interface accessible via `Ctrl+Shift+H` (or `Cmd+Shift+H`), built with React and Tailwind CSS.    
- **Model Context Protocol (MCP):** Implements an MCP client to dynamically discover and connect to "MCP servers," extending the agent's capabilities.
- **Privacy-First Memory:** Uses `Dexie` (IndexedDB) to store user data locally within the browser.
- **Workflow Automation:** Supports "Smart Actions" and workflows to automate browser tasks.
- **Voice Mode:** ElevenLabs integration for conversational AI.
- **YouTube Integration:** Dedicated API for fetching video transcripts.

## Monorepo Structure

```text
cognito-ai/
├── apps/
│   ├── extension/              # @cognito/extension - Chrome Extension (Plasmo)
│   │   ├── src/
│   │   │   ├── sidepanel.tsx   # Main UI entry point (React)
│   │   │   ├── background.ts   # Background Service Worker (MCP, messaging)
│   │   │   ├── actions/        # Browser automation actions
│   │   │   ├── ai/             # AI model integration & prompts
│   │   │   ├── components/     # Reusable React UI components
│   │   │   ├── mcp/            # Model Context Protocol client
│   │   │   ├── memory/         # Local database (Dexie)
│   │   │   └── workflows/      # Automation workflows
│   │   └── package.json
│   └── docs/                   # @cognito/docs - Documentation (Next.js + Fumadocs)
├── packages/
│   ├── backend-cloudflare/     # @cognito/backend-cloudflare - ElevenLabs proxy (CF Workers)
│   └── backend-vercel/         # @cognito/backend-vercel - YouTube transcripts (Express)
├── pnpm-workspace.yaml         # Workspace definitions
├── package.json                # Root monorepo scripts
├── MONOREPO.md                 # Migration guides & architecture docs
└── turbo.json                  # Optional Turborepo config
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
- **MCP Implementation:** Check `apps/extension/src/background.ts` and `apps/extension/src/mcp/` to understand MCP connections.
- **Permissions:** The `manifest` in `apps/extension/package.json` lists Chrome extension permissions.
- **Load Extension:** Load `apps/extension/build/chrome-mv3-dev` as unpacked extension in Chrome.
