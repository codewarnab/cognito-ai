# Cognito Webapp - Navigation

## Overview

Next.js 16 webapp providing UI pages for the Chrome extension. Includes Web MCP integration for agentic control.

## Pages

- `/settings` - User preferences
- `/onboarding` - First-time setup
- `/reminders` - Reminder management
- `/providers` - AI provider config
- `/dev/logger` - Dev-only logger panel

## Key Commands

```bash
pnpm dev:webapp
pnpm --filter @cognito/webapp dev
pnpm --filter @cognito/webapp build
```

## Git Workflow

Use conventional commits with scope:
- `feat(webapp): add feature`
- `fix(webapp): fix bug`

## Component Guidelines

- Never modify `src/components/ui/` primitives directly
- Use `cursor-pointer` on all clickable buttons
- Use `mcp-scrollable` class for scrollable containers
