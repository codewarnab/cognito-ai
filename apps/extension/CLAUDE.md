# Cognito Extension - Claude Guide

This document helps Claude understand the Chrome extension codebase.

## Overview

**Cognito** is a privacy-first, AI-powered Chrome extension built with [WXT](https://wxt.dev/). It provides an AI side panel interface for interacting with web pages, automating browser tasks, and managing local memory.

## Key Features

- **AI Side Panel**: Chat interface accessible via `Ctrl+Shift+H`
- **Model Context Protocol (MCP)**: Connects to external MCP servers for extended capabilities
- **Privacy-First Memory**: Local storage with Dexie (IndexedDB)
- **Voice Mode**: ElevenLabs integration for conversational AI
- **Browser Automation**: Smart Actions and workflows
- **YouTube Integration**: Video transcript extraction

## Architecture

```text
apps/extension/
├── src/
│   ├── entrypoints/        # WXT entrypoints
│   │   ├── sidepanel/      # Main UI entry point (React)
│   │   ├── background/     # Background Service Worker
│   │   └── contents/       # Content scripts
│   ├── actions/            # Browser automation actions
│   ├── ai/                 # AI model integration & prompts
│   │   ├── core/           # Core AI logic (modelSetup, aiLogic)
│   │   ├── prompts/        # System and tool prompts
│   │   └── errors/         # Error handlers
│   ├── components/         # React UI components
│   │   ├── features/       # Feature-specific components
│   │   ├── shell/          # App shell components
│   │   └── ui/             # Reusable UI primitives
│   ├── mcp/                # MCP client implementation
│   ├── memory/             # Dexie database (local memory)
│   ├── workflows/          # Automation workflows
│   ├── hooks/              # React hooks
│   ├── utils/              # Utilities
│   └── types/              # TypeScript types
├── docs/                   # Technical documentation
├── assets/                 # Icons, images
├── public/                 # Static files (offscreen.js, etc.)
└── wxt.config.ts           # WXT configuration
```

## Development

```bash
# From monorepo root
pnpm dev                    # Start dev server (hot reload)
pnpm build:extension        # Build for production

# From extension directory
cd apps/extension
pnpm dev
pnpm build
```

## Environment Variables

```env
# apps/extension/.env
WXT_ELEVENLABS_WORKER_URL=https://your-worker.workers.dev
```

## Key Files

| File | Purpose |
|------|---------|
| `src/entrypoints/sidepanel/` | Main React entry point |
| `src/entrypoints/background/` | Service worker, MCP, message handling |
| `wxt.config.ts` | WXT and manifest config (permissions, commands) |
| `tsconfig.json` | TypeScript config with path aliases |

## Path Aliases

Always use path aliases instead of relative imports:

```typescript
// ✅ Correct
import { createLogger } from '~logger';
import { Button } from '@/components/ui/Button';
import { handleAPIError } from '@/utils/apiErrorHandler';
import icon from '@assets/icon.png';

// ❌ Wrong - never use deep relative imports
import { createLogger } from '../../logger';
import { Button } from '../../../components/ui/Button';
```

### Available Aliases

| Alias | Maps To |
|-------|---------|
| `~*` | `src/*` |
| `@/*` | `src/*` |
| `@assets/*` | `assets/*` |
| `@/components/*` | `src/components/*` |
| `@/utils/*` | `src/utils/*` |

## Coding Standards

### React Components

- Use functional components with hooks
- Prefer named exports for components
- Use TypeScript interfaces for props
- Keep components focused and single-purpose

```typescript
// ✅ Good
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function Button({ label, onClick, disabled = false }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}
```

### Error Handling

- Always wrap async operations in try-catch
- Use the logger for consistent error reporting
- Provide meaningful error messages to users

```typescript
import { createLogger } from '~logger';

const logger = createLogger('MyComponent');

try {
  await someAsyncOperation();
} catch (error) {
  logger.error('Operation failed:', error);
  // Handle error appropriately
}
```

### State Management

- Use React hooks for local state
- Use Zustand stores for global state (see `src/stores/`)
- Prefer derived state over redundant state

## Testing the Extension

1. Build: `pnpm build:extension`
2. Load `.output/chrome-mv3` as unpacked extension in Chrome
3. Open side panel with `Ctrl+Shift+H`

## External Dependencies

The extension relies on backend services:
- **ElevenLabs Proxy**: `packages/backend-cloudflare/` for voice mode
- **YouTube API**: `packages/backend-vercel/` for video transcripts

See those packages' `CLAUDE.md` files for their documentation.

## Important Documentation

| File | Purpose |
|------|---------|
| `docs/CODING_STANDARDS.md` | Detailed coding standards |
| `docs/TECHNICAL_DOCUMENTATION.md` | Technical architecture |
| `docs/TOOL_POPOVER_ARCHITECTURE.md` | Tool popover system |
| `docs/WEBMCP_INTEGRATION.md` | MCP integration details |

## Git Commits

```bash
git commit -m "feat(extension): add new browser tool"
git commit -m "fix(extension): resolve MCP connection issue"
git commit -m "refactor(extension): improve component structure"
```
