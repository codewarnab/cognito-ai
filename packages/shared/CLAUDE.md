# @cognito/shared - Claude Guide

## Package Purpose
Shared types, constants, and storage utilities for the Cognito AI monorepo. This package ensures consistency between the frontend (Chrome Extension) and backend services.

## Architecture

### Directory Structure
- `src/types/`: TypeScript definitions (Zod schemas where applicable)
- `src/constants/`: Static values, prompts, and configuration defaults
- `src/models/`: AI model definitions and registry
- `src/storage/`: Shared storage logic (e.g., IndexedDB wrappers)

### Critical Modules
- **Logger**: `types/logger.ts`, `constants/logger/`, `storage/loggerStorage.ts`
- **Settings**: `types/settings.ts` (User preferences structure)
- **AI Context**: `types/chat.ts`, `constants/prompts.ts`
- **Models**: `models/registry.ts` (AI Provider registry)
- **MCP**: `types/mcp.ts` (Model Context Protocol)

## Coding Standards

### Type Definitions
- Export interfaces/types directly from their modules.
- Re-export in `src/types/index.ts`.
- Prefer interfaces for object shapes.

### Constants
- Use `UPPER_CASE` for constant values.
- Group related constants in separate files.

## Build Process
This package compiles to `dist/`. **Always run `pnpm build` after making changes** to ensure other workspaces can see the updates.

## Common Operations

### Adding a New Setting
1. Update `UserSettings` interface in `src/types/settings.ts`.
2. Update `DEFAULT_SETTINGS` in `src/constants/settings.ts` (if exists) or relevant location.
3. Run `pnpm build`.

### Adding a Feature Flag
1. Add flag to `src/constants/featureFlags.ts`.
2. Run `pnpm build`.
