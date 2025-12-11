# Cognito Extension - AI Agents Guide

This document helps AI coding assistants understand the Chrome extension.

## Overview

**Cognito** is a privacy-first, AI-powered Chrome extension built with [Plasmo](https://docs.plasmo.com/). It provides an AI side panel interface for interacting with web pages, automating browser tasks, and managing local memory.

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
│   ├── sidepanel.tsx       # Main UI entry point (React)
│   ├── background.ts       # Background Service Worker
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
└── scripts/                # Build scripts
```

## AI Editor Configs

This extension has detailed coding standards in:
- `.cursor/rules/coding-standards.mdc` - Comprehensive coding standards
- `.kiro/steering/` - Topic-specific Kiro steering files
- `.trae/rules/project_rules.md` - Trae project rules

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
PLASMO_PUBLIC_GOOGLE_AI_API_KEY=your_gemini_api_key
```

## Key Files

| File | Purpose |
|------|---------|
| `sidepanel.tsx` | Main React entry point |
| `background.ts` | Service worker, MCP, message handling |
| `package.json` | Manifest config (permissions, commands) |
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

## Testing the Extension

1. Build: `pnpm build:extension`
2. Load `apps/extension/build/chrome-mv3-dev` as unpacked extension in Chrome
3. Open side panel with `Ctrl+Shift+H`

## External Dependencies

The extension relies on backend services:
- **ElevenLabs Proxy**: `packages/backend-cloudflare/` for voice mode
- **YouTube API**: `packages/backend-vercel/` for video transcripts

See those packages' `AGENTS.md` files for their documentation.
