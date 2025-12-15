# Cognito AI Monorepo

This is a **pnpm monorepo** containing the Cognito AI Chrome extension, documentation site, and backend services.

## Workspace Structure

```text
cognito-ai/
├── apps/
│   ├── extension/          # @cognito/extension - Chrome Extension (WXT)
│   └── docs/               # @cognito/docs - Documentation (Next.js + Fumadocs)
├── packages/
│   ├── backend-cloudflare/ # @cognito/backend-cloudflare - ElevenLabs proxy
│   └── backend-vercel/     # @cognito/backend-vercel - YouTube transcript API
└── [root config files]
```

## Package Reference

| Package | Path | GEMINI.md |
|---------|------|-----------|
| Extension | `apps/extension/` | [GEMINI.md](file:///c:/Users/User/code/hackathons/chrome-ai/apps/extension/GEMINI.md) |
| Backend Cloudflare | `packages/backend-cloudflare/` | [GEMINI.md](file:///c:/Users/User/code/hackathons/chrome-ai/packages/backend-cloudflare/GEMINI.md) |
| Backend Vercel | `packages/backend-vercel/` | [GEMINI.md](file:///c:/Users/User/code/hackathons/chrome-ai/packages/backend-vercel/GEMINI.md) |

## Commands

```bash
# Install all dependencies
pnpm install

# Development
pnpm dev                    # Extension dev server
pnpm dev:docs               # Docs dev server
pnpm dev:all                # All packages in parallel

# Building
pnpm build                  # Build all packages
pnpm build:extension        # Build extension only

# Package-specific
pnpm --filter @cognito/extension dev
pnpm --filter @cognito/backend-cloudflare deploy
```

## Git Commits

Use Conventional Commits with package scope:
```bash
feat(extension): add new feature
fix(backend-cloudflare): resolve issue
chore: monorepo-wide changes
```

## Key Documentation

| File | Purpose |
|------|---------|
| `MONOREPO.md` | Architecture, deployment, migration guides |
| `AGENTS.md` | AI agent navigation |
| `apps/extension/GEMINI.md` | Extension-specific Gemini context |
| `packages/*/GEMINI.md` | Package-specific Gemini context |
