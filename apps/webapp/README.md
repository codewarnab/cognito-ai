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

## Getting Started

```bash
# Development
pnpm dev:webapp
# or
pnpm --filter @cognito/webapp dev

# Build
pnpm --filter @cognito/webapp build
```

Open [http://localhost:3002](http://localhost:3002) with your browser.

## Project Structure

```text
apps/webapp/
├── src/
│   ├── app/               # Next.js App Router pages
│   ├── components/
│   │   ├── ui/            # shadcn/ui primitives
│   │   ├── shared/        # Reusable components
│   │   └── [feature]/     # Feature-specific components
│   └── lib/               # Utilities
├── public/                # Static assets
└── docs/                  # Implementation docs
```

## Shared Package

```typescript
import type { WriteTone } from '@cognito/shared';
import { TONE_INSTRUCTIONS } from '@cognito/shared';
```

## Environment Variables

```env
WXT_BACKEND_API_URL=https://your-backend.vercel.app
```

## Related Documentation

- [Monorepo Guide](../../MONOREPO.md)
- [Contributing Guide](../../CONTRIBUTING.md)
- [AI Agents Guide](./AGENTS.md)

## Deploy on Vercel

The webapp is deployed on Vercel. See [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for details.
