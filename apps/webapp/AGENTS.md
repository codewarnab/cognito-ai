# Cognito Webapp - AI Agents Guide

This document helps AI coding assistants understand and navigate the Cognito webapp.

## Webapp Overview

The Cognito webapp (`@cognito/webapp`) is a **Next.js 16** application providing UI pages for the Chrome extension:

- **Settings**: User preferences and configuration
- **Onboarding**: First-time user setup flow  
- **Reminders**: Reminder management UI
- **Providers**: AI provider configuration
- **Features**: Feature showcase pages
- **Troubleshooting**: Help and debugging tools
- **Changelog**: Version history and updates
- **Dev Routes**: Development-only tools (logger panel)

## Technology Stack

| Technology | Purpose |
|------------|---------|
| Next.js 16 | React framework (App Router) |
| React 19 | UI library |
| Tailwind CSS | Styling |
| shadcn/ui | UI components |
| Lucide | Icons |

## Project Structure

```text
apps/webapp/
├── src/
│   ├── app/                    # Next.js App Router pages
│   ├── components/
│   │   ├── ui/                 # shadcn/ui primitives
│   │   ├── shared/             # Reusable components
│   │   ├── settings/           # Settings components
│   │   └── [feature]/          # Feature-specific components
│   └── lib/                    # Utilities
├── public/                     # Static assets
└── docs/                       # Implementation docs
```

## Commands

```bash
# Development
pnpm dev:webapp                 # Start webapp dev server
pnpm --filter @cognito/webapp dev

# Building  
pnpm --filter @cognito/webapp build

# All packages
pnpm dev:all
```

## Key Patterns

### Extension Communication

The webapp receives data from the extension via URL parameters:

```typescript
const searchParams = useSearchParams();
const extensionId = searchParams.get('extensionId');
```

### Shared Package

```typescript
import type { WriteTone } from '@cognito/shared';
import { TONE_INSTRUCTIONS } from '@cognito/shared';
```

### Dev-Only Routes

Routes in `src/app/dev/` are protected by the `DevOnly` component and only accessible in development.

## Git Commits

Use Conventional Commits with webapp scope:
```bash
feat(webapp): add new feature
fix(webapp): resolve issue
```

## Related Files

| File | Purpose |
|------|---------|
| Root `MONOREPO.md` | Architecture guides |
| Root `AGENTS.md` | Monorepo navigation |
| `docs/*.md` | Implementation docs |
