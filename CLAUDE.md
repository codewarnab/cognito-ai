# Cognito AI Monorepo - Claude Guide

This document helps Claude understand and navigate the Cognito AI monorepo.

## Monorepo Overview

Cognito AI is a **pnpm monorepo** containing a privacy-first, AI-powered Chrome extension, documentation site, and backend services.

```text
cognito-ai/
├── apps/
│   ├── extension/          # @cognito/extension - Chrome Extension (WXT)
│   └── docs/               # @cognito/docs - Documentation site (Next.js + Fumadocs)
├── packages/
│   ├── backend-cloudflare/ # @cognito/backend-cloudflare - ElevenLabs proxy (CF Workers)
│   └── backend-vercel/     # @cognito/backend-vercel - AI Chat Backend + YouTube transcripts (Express)
└── [root config files]
```

## Package Reference

| Package | Path | Purpose | CLAUDE.md |
|---------|------|---------|-----------|
| Extension | `apps/extension/` | Chrome Extension | [CLAUDE.md](apps/extension/CLAUDE.md) |
| Cloudflare Backend | `packages/backend-cloudflare/` | ElevenLabs proxy | [CLAUDE.md](packages/backend-cloudflare/CLAUDE.md) |
| Vercel Backend | `packages/backend-vercel/` | AI Chat + YouTube | [CLAUDE.md](packages/backend-vercel/CLAUDE.md) |
| Docs | `apps/docs/` | Documentation site | N/A |

## Common Commands

```bash
# Install all dependencies
pnpm install

# Development
pnpm dev                    # Start extension dev server
pnpm dev:docs               # Start docs dev server
pnpm dev:all                # Start all packages in parallel

# Building
pnpm build                  # Build all packages
pnpm build:extension        # Build extension only

# Package-specific commands
pnpm --filter @cognito/extension dev
pnpm --filter @cognito/backend-cloudflare deploy

# Add dependencies
pnpm --filter @cognito/extension add react-query    # To specific package
pnpm add -D -w typescript-eslint                    # To root (dev tools)

# Type checking
pnpm type:check             # Check all packages
```

## Git Workflow

### Commit Conventions

All commits should follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Format: <type>(<scope>): <description>

# Extension changes
git commit -m "feat(extension): add new browser tool"
git commit -m "fix(extension): resolve MCP connection issue"

# Backend changes
git commit -m "feat(backend-cloudflare): add new TTS endpoint"
git commit -m "fix(backend-vercel): handle transcript edge case"

# Monorepo-wide changes
git commit -m "chore: update pnpm dependencies"
git commit -m "docs: update documentation files"
```

### Branch Strategy

```bash
# Feature branches
git checkout -b feat/extension-voice-mode
git checkout -b fix/cloudflare-cors

# Work on specific package
git checkout -b feat/backend-vercel-caching
```

## Environment Variables

### Extension (`apps/extension/.env`)
```env
# Environment variables are now prefixed with WXT_ (see apps/extension/.env.example)
```

### Backend Cloudflare
```bash
# Set via Wrangler CLI (secrets)
wrangler secret put ELEVENLABS_API_KEY

# Configured in wrangler.toml (non-secrets)
ELEVENLABS_AGENT_ID=agent_xxx
```

### Backend Vercel (`packages/backend-vercel/.env`)
```env
GOOGLE_AI_API_KEY=your_key         # For AI chat endpoints
SUPADATA_API_KEY=your_key          # For YouTube transcripts
JINA_API_KEY=your_key              # For URL retrieval (optional)
TAVILY_API_KEY=your_key            # For web search (optional)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
```

## Creating Shared Code

To share types/utilities between packages:

1. **Create shared package**:
   ```bash
   mkdir packages/shared
   cd packages/shared
   pnpm init
   ```

2. **Configure `package.json`**:
   ```json
   {
     "name": "@cognito/shared",
     "main": "./dist/index.js",
     "types": "./dist/index.d.ts"
   }
   ```

3. **Add as dependency**:
   ```bash
   pnpm --filter @cognito/extension add @cognito/shared
   ```

4. **pnpm auto-links workspace packages** - no manual linking needed.

## Key Documentation Files

| File | Purpose |
|------|---------|
| `MONOREPO.md` | Architecture, deployment guides, migration guides |
| `AGENTS.md` | AI agent navigation guide |
| `CLAUDE.md` | Claude-specific context (this file) |
| `GEMINI.md` | Gemini-specific context |
| `apps/extension/docs/` | Extension technical documentation |
| `packages/*/README.md` | Package-specific documentation |

## Troubleshooting

### "Cannot find module" after changes
```bash
pnpm install --force
```

### WXT not finding files
Check `apps/extension/tsconfig.json` path mappings.

### Vercel build failing
Ensure "Root Directory" is set correctly in Vercel project settings.

## Working with This Monorepo

When working in a specific package, prioritize that package's documentation over root-level docs. Each package has its own:
- `CLAUDE.md` - Claude-specific guidance
- `AGENTS.md` - General AI agent guidance
- `GEMINI.md` - Gemini-specific context
- `README.md` - Package documentation
