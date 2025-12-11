# Cognito AI Monorepo - Navigation

## Workspace Structure

This is a pnpm monorepo containing:
- `apps/extension/` - Chrome Extension (Plasmo)
- `apps/docs/` - Documentation (Next.js)
- `packages/backend-cloudflare/` - ElevenLabs proxy (Cloudflare Workers)
- `packages/backend-vercel/` - YouTube transcript API (Express)

## Package-Specific Steering

For package-specific standards, refer to:
- Extension: `apps/extension/.kiro/steering/`
- Backend packages: See individual package `AGENTS.md` files

## Key Commands

```bash
# Development
pnpm dev                    # Extension dev server
pnpm dev:docs               # Docs dev server

# Package-specific
pnpm --filter @cognito/extension dev
pnpm --filter @cognito/backend-cloudflare deploy
```

## Git Workflow

Use conventional commits with scope:
- `feat(extension): add feature`
- `fix(backend-cloudflare): fix bug`
- `docs: update documentation`
