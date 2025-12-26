# Cognito Webapp

**@cognito/webapp** is a Next.js 16 application providing UI pages for the Cognito Chrome extension.

## Pages

| Route | Purpose |
|-------|---------|
| `/settings` | User preferences and configuration |
| `/onboarding` | First-time user setup flow |
| `/reminders` | Reminder management |
| `/providers` | AI provider setup |
| `/features` | Feature showcase |
| `/troubleshooting` | Help and debugging |
| `/changelog` | Version history |
| `/uninstalled` | Uninstall feedback |
| `/dev/logger` | Dev-only logger panel |

## Technology Stack

- **Next.js 16** with App Router
- **React 19** 
- **Tailwind CSS** for styling
- **shadcn/ui** components
- **Lucide** icons

## Structure

```text
apps/webapp/
├── src/
│   ├── app/               # Next.js pages
│   ├── components/
│   │   ├── ui/            # Primitives
│   │   ├── shared/        # Reusable
│   │   └── [feature]/     # Feature-specific
│   └── lib/               # Utilities
├── public/                # Static assets
└── docs/                  # Implementation docs
```

## Commands

```bash
# Development
pnpm dev:webapp
pnpm --filter @cognito/webapp dev

# Build
pnpm --filter @cognito/webapp build
```

## Shared Package

```typescript
import type { WriteTone } from '@cognito/shared';
import { TONE_INSTRUCTIONS } from '@cognito/shared';
```


## Web MCP Integration

The webapp integrates **Web MCP** to expose internal tools to AI agents.

- **Path**: `src/mcp/`
- **Tools**: Navigation, Settings, Providers

## Environment Variables

```env
WXT_BACKEND_API_URL=https://your-backend.vercel.app
```

## Related Docs

| File | Purpose |
|------|---------|
| Root `GEMINI.md` | Monorepo context |
| `docs/*.md` | Implementation docs |
