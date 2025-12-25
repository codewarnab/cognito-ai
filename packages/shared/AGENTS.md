# @cognito/shared - AI Agent Guide

## Package Context
This package (`packages/shared`) is the **single source of truth** for types, constants, and utilities shared between the Chrome extension and the backend.

**Critical Rule**: Changes here affect BOTH the extension and the backend. Verify compatibility when modifying.

## Key Components

### Types (`src/types/`)
- **`logger.ts`**: Logging structures (`LogEntry`, `LogSeverity`)
- **`settings.ts`**: User configuration (`UserSettings`)
- **`featureFlags.ts`**: Feature toggles
- **`chat.ts`**: Core AI chat interfaces

### Storage (`src/storage/`)
- **`LoggerStorage`**: IndexedDB wrapper for persisting application logs
- **Usage**:
  ```typescript
  import { LoggerStorage } from '@cognito/shared/storage';
  await LoggerStorage.addLog(entry);
  ```

### Constants (`src/constants/`)
- **`prompts.ts`**: Shared system prompts (Tone, Platform instructions)
- **`logger.ts`**: Default logging configuration
- **`featureFlags.ts`**: Default flag values

## Development Workflow

1.  **Modify**: Make changes in `src/`
2.  **Build**: Run `pnpm build` (Essential! Other packages use the built output)
3.  **Verify**: Check consumer packages (`apps/extension`, `packages/backend-vercel`) for type errors
