# Git Staging and Commit Instructions

This document provides git commands for committing the monorepo restructuring changes.
**Designed for automated agent execution.**

---

## Pre-Commit Verification Checklist

Before committing, verify these conditions are met:

```bash
# 1. Check pnpm install works
pnpm install
# Expected: Completes without errors, shows workspace packages

# 2. Check extension builds
pnpm dev
# Expected: "Extension re-packaged in XXXXms! 🚀"
# Press Ctrl+C to stop after build succeeds

# 3. Verify build output exists
dir apps\extension\build\chrome-mv3-dev
# Expected: Directory exists with manifest.json, *.js files

# 4. Check git status shows expected changes
git status
# Expected: Shows staged renames (apps/extension/src/..., packages/...)
```

---

## Granular Commits (Recommended for Detailed History)

Execute these commits in order. Each commit is independent and can be verified.

### Commit 1: Move Extension Files

```bash
git add apps/extension/
git commit -m "refactor(extension): move Chrome extension to apps/extension/

- Moved src/, assets/, public/, scripts/ to apps/extension/
- Moved config files: tsconfig.json, tailwind.config.js, .prettierrc.mjs
- Created apps/extension/package.json with @cognito/extension name
- Updated postinstall scripts for monorepo root node_modules paths
- Preserved all Plasmo manifest configuration

This is part of the monorepo restructuring. The extension should now
be developed from apps/extension/ with pnpm workspace linking."
```

**Agent Verification:**
- Run `pnpm --filter @cognito/extension dev` - should start dev server
- Check `apps/extension/build/chrome-mv3-dev/manifest.json` exists

---

### Commit 2: Move Backend Packages

```bash
git add packages/
git commit -m "refactor(backend): move backend services to packages/

packages/backend-cloudflare:
- Moved from chrome-ai-backend/elevenlabs-proxy/
- Renamed package to @cognito/backend-cloudflare
- ElevenLabs TTS proxy for voice features (Cloudflare Workers)

packages/backend-vercel:
- Moved from youtube-transcript-generator/
- Renamed package to @cognito/backend-vercel
- YouTube transcript API with Upstash Redis caching (Express/Vercel)"
```

**Agent Verification:**
- Check `packages/backend-cloudflare/package.json` contains `"name": "@cognito/backend-cloudflare"`
- Check `packages/backend-vercel/package.json` contains `"name": "@cognito/backend-vercel"`

---

### Commit 3: Move Documentation

```bash
git add apps/docs/
git commit -m "refactor(docs): move documentation site to apps/docs/

- Moved from cognito-ai-docs/
- Renamed package to @cognito/docs
- Next.js 16 + Fumadocs documentation site"
```

**Agent Verification:**
- Check `apps/docs/package.json` contains `"name": "@cognito/docs"`
- Run `pnpm --filter @cognito/docs dev` - should start Next.js dev server on port 3000

---

### Commit 4: Update Root Configuration

```bash
git add package.json pnpm-workspace.yaml turbo.json .gitignore
git commit -m "chore: configure pnpm monorepo workspace

- Updated pnpm-workspace.yaml to include apps/* and packages/*
- Transformed root package.json to monorepo orchestrator
- Added workspace scripts: dev, build, deploy:cloudflare
- Created turbo.json for optional Turborepo integration
- Updated .gitignore for monorepo structure (added .turbo/, .wrangler/, .next/)"
```

**Agent Verification:**
- Run `pnpm install` from root - should complete without errors
- Run `pnpm -r build` - should build all packages

---

### Commit 5: Add Documentation

```bash
git add MONOREPO.md GEMINI.md
git commit -m "docs: add monorepo documentation and migration guides

MONOREPO.md includes:
- Architecture overview
- Development workflow (pnpm commands)
- Deployment guides for each package
- Migration guides:
  - Merge backends into one service
  - Move to Next.js API routes
  - Move from Cloudflare Workers
  - Add shared packages
  - Extract extension from monorepo

Updated GEMINI.md with new project structure."
```

**Agent Verification:**
- Check `MONOREPO.md` exists and has "Migration Guides" section
- Check `GEMINI.md` contains "Monorepo Structure" section

---

## Post-Commit Verification

After all commits are complete:

```bash
# 1. Verify git history shows file renames (not delete+create)
git log --follow --oneline -5 apps/extension/src/background.ts
# Expected: Shows commits from BEFORE the restructuring

# 2. Verify all packages are recognized
pnpm list -r
# Expected: Lists @cognito/extension, @cognito/docs, @cognito/backend-cloudflare, @cognito/backend-vercel

# 3. Full build test
pnpm build:extension
# Expected: Build succeeds, output in apps/extension/build/chrome-mv3-prod
```

---

## Push Changes

Only push after all verifications pass:

```bash
git push origin master
```

---

## Rollback (If Needed)

If any issues occur, rollback to before restructuring:

```bash
git log --oneline -10  # Find the commit before restructuring
git reset --hard <commit-hash>
pnpm install
```
