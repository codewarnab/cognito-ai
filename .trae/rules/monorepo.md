# Cognito AI Monorepo - Project Rules

## Workspace Structure

This is a **pnpm monorepo** containing multiple packages:

| Package | Path | Purpose |
|---------|------|---------|
| `@cognito/extension` | `apps/extension/` | Chrome Extension (Plasmo, React) |
| `@cognito/docs` | `apps/docs/` | Documentation (Next.js, Fumadocs) |
| `@cognito/backend-cloudflare` | `packages/backend-cloudflare/` | ElevenLabs proxy |
| `@cognito/backend-vercel` | `packages/backend-vercel/` | YouTube transcript API |

## Package-Specific Rules

When working in a specific package, prioritize that package's rules:
- **Extension**: See `apps/extension/.trae/rules/project_rules.md`
- **Backend packages**: See individual package documentation

## General Conventions

### Package Manager
- **Always use pnpm** (never npm or yarn)
- Use `--filter` for package-specific commands

### Commands
```bash
pnpm install                              # Install all deps
pnpm --filter @cognito/extension dev      # Run specific package
pnpm --filter @cognito/extension add pkg  # Add dependency
```

### Git Commits
Follow Conventional Commits with scope:
```
feat(extension): add new feature
fix(backend-vercel): resolve API issue
chore: update dependencies
```

## Key Documentation

- `MONOREPO.md` - Architecture and migration guides
- `AGENTS.md` - AI agent navigation
- `apps/extension/docs/` - Extension technical docs
