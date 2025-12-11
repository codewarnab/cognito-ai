# Cognito AI Monorepo - Development Guide

## Project Overview

Cognito AI is a **pnpm monorepo** containing a privacy-first, AI-powered Chrome extension, documentation site, and backend services.

## Monorepo Structure

```text
cognito-ai/
├── apps/
│   ├── extension/          # @cognito/extension - Chrome Extension (Plasmo)
│   └── docs/               # @cognito/docs - Documentation site (Next.js + Fumadocs)
├── packages/
│   ├── backend-cloudflare/ # @cognito/backend-cloudflare - ElevenLabs proxy
│   └── backend-vercel/     # @cognito/backend-vercel - YouTube transcript API
└── [root config files]
```

## Package Reference

| Package | Path | Tech Stack | Purpose |
|---------|------|------------|---------|
| `@cognito/extension` | `apps/extension/` | Plasmo, React, TypeScript | Chrome Extension |
| `@cognito/docs` | `apps/docs/` | Next.js, Fumadocs | Documentation |
| `@cognito/backend-cloudflare` | `packages/backend-cloudflare/` | Cloudflare Workers | ElevenLabs proxy |
| `@cognito/backend-vercel` | `packages/backend-vercel/` | Express.js, Node.js | YouTube transcripts |

## Development Commands

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

Follow [Conventional Commits](https://www.conventionalcommits.org/) with package scope:

```bash
# Extension changes
git commit -m "feat(extension): add new browser tool"
git commit -m "fix(extension): resolve MCP connection issue"

# Backend changes
git commit -m "feat(backend-cloudflare): add new TTS endpoint"
git commit -m "fix(backend-vercel): handle transcript edge case"

# Monorepo-wide changes
git commit -m "chore: update pnpm dependencies"
git commit -m "docs: update AGENTS.md files"
```

## Environment Variables

### Extension (`apps/extension/.env`)
```env
PLASMO_PUBLIC_GOOGLE_AI_API_KEY=your_gemini_api_key
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
SUPADATA_API_KEY=your_key
JINA_API_KEY=your_key
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
```

## Package-Specific Guides

For detailed development guides, see each package's `.github/copilot-instructions.md`:

- **Extension**: `apps/extension/.github/copilot-instructions.md` - Full extension development guide with tool patterns, error handling, React conventions
- **Backend Cloudflare**: `packages/backend-cloudflare/.github/copilot-instructions.md` - Cloudflare Workers development
- **Backend Vercel**: `packages/backend-vercel/.github/copilot-instructions.md` - Express.js API development

## Key Documentation

| File | Purpose |
|------|---------|
| `MONOREPO.md` | Architecture, deployment guides, migration guides |
| `AGENTS.md` | AI agent navigation guide |
| `apps/extension/docs/` | Extension technical documentation |
| `packages/*/README.md` | Package-specific documentation |

## Common Issues

### "Cannot find module" after changes
```bash
pnpm install --force
```

### Plasmo not finding files
Check `apps/extension/tsconfig.json` path mappings.

### Vercel build failing
Ensure "Root Directory" is set correctly in Vercel project settings.

## Additional Resources

- See package-specific `copilot-instructions.md` for detailed development guides
- AI SDK v5 docs: https://sdk.vercel.ai/docs
- Plasmo framework: https://docs.plasmo.com/
- Chrome Extension MV3: https://developer.chrome.com/docs/extensions/mv3/
