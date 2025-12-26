# Cognito Webapp - Claude Guide

This document helps Claude understand and navigate the Cognito webapp.

## Webapp Overview

The Cognito webapp is a **Next.js 16** application that provides UI pages for the Chrome extension, including settings, onboarding, reminders, and troubleshooting pages.

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
│   │   ├── settings/           # Settings page
│   │   ├── onboarding/         # Onboarding flow
│   │   ├── reminders/          # Reminder management
│   │   ├── providers/          # AI provider setup
│   │   ├── features/           # Feature showcase
│   │   ├── troubleshooting/    # Help/debug tools
│   │   ├── changelog/          # Version history
│   │   ├── uninstalled/        # Uninstall feedback
│   │   └── dev/                # Dev-only routes (logger panel)
│   ├── components/
│   │   ├── ui/                 # shadcn/ui primitives
│   │   ├── shared/             # Reusable components
│   │   ├── settings/           # Settings-specific components
│   │   ├── onboarding/         # Onboarding components
│   │   └── providers/          # Provider setup components
│   └── lib/                    # Utilities
├── public/                     # Static assets
└── docs/                       # Implementation documentation
```

## Common Commands

```bash
# Development
pnpm dev:webapp                 # Start webapp dev server (from root)
pnpm --filter @cognito/webapp dev  # Alternative

# Building
pnpm --filter @cognito/webapp build

# Type checking
pnpm --filter @cognito/webapp type:check
```

## Key Patterns

### Extension Communication

The webapp communicates with the extension via URL parameters and Chrome messaging:

```typescript
// Reading extension data from URL params
const searchParams = useSearchParams();
const extensionId = searchParams.get('extensionId');

// Sending data back to extension
window.postMessage({ type: 'SETTINGS_UPDATE', data }, '*');
```

### Shared Package

```typescript
import type { WriteTone, RewritePreset } from '@cognito/shared';
import { TONE_INSTRUCTIONS, PRESET_PROMPTS } from '@cognito/shared';
```

## Environment Variables

```env
# apps/webapp/.env
WXT_BACKEND_API_URL=https://your-backend.vercel.app
```

## Git Commits

```bash
feat(webapp): add new settings section
fix(webapp): resolve onboarding flow issue
```


## Web MCP Integration

The webapp includes an MCP (Model Context Protocol) client that allows AI agents to interact with webapp features.

- **Location**: `src/mcp/`
- **Capabilities**: Navigation, Settings Management, AI Provider Configuration
- **Registry**: `src/mcp/registry.ts` registers available tools.

## Related Documentation

| File | Purpose |
|------|---------|
| Root `MONOREPO.md` | Monorepo architecture |
| Root `AGENTS.md` | AI agent navigation |
| `docs/LOGGER_PANEL_IMPLEMENTATION.md` | Logger panel docs |
