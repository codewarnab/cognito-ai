# Coding Standards

## Core Principles
- Use TypeScript with strict type checking enabled (`tsconfig.json:33-61`).
- Prefer `const` over `let`; avoid `var` (see contributing guidelines).
- Keep modules small and single-responsibility; co-locate related hooks/components.
- Do not log secrets, API keys, or personally identifiable information.

## TypeScript Configuration
- Strictness: `strict`, `noImplicitAny`, `strictNullChecks`, `noImplicitReturns`, `noUncheckedIndexedAccess` (`/c:/Users/User/code/hackathons/chrome-ai/tsconfig.json:33-50`).
- Module resolution: `moduleResolution: bundler`, `resolveJsonModule: true` (`/c:/Users/User/code/hackathons/chrome-ai/tsconfig.json:52-54`).
- Path aliases (use these for imports):
  - `~*` → `./src/*`
  - `@/*` → `./src/*`
  - `@assets/*` → `./assets/*`
  - `~logger` → `./src/logger` (`/c:/Users/User/code/hackathons/chrome-ai/tsconfig.json:18-31`)

## Imports and Modules
- Always use path aliases instead of deep relative paths:
  - Logger: `import { createLogger } from '~logger';` (`src/sidepanel.tsx:44`).
  - Utils: `import { handleAPIError } from '@/utils/apiErrorHandler';` (`src/sidepanel.tsx:74`).
  - Assets: `import icon from '@assets/...';`
- Group and sort imports consistently; rely on the Prettier sort-imports plugin.
- Prefer named exports; avoid default exports for shared utilities.

## Logger Usage
- Initialize a module-scoped logger and reuse it:
  - `const log = createLogger('FeatureName');` or with context `createLogger('FeatureName', 'CONTEXT')` (`src/ai/core/modelSetup.ts:36`).
- Levels: use `debug` for verbose state, `info` for normal operation, `warn` for recoverable issues, `error` for failures.
- Do not include API keys or secrets in logs; sanitize error objects.

## Error Handling
- Use standardized error types and helpers:
  - API/Gemini errors: `src/ai/errors/handlers.ts:92`, `src/ai/errors/handlers.ts:257`.
  - Browser/Chrome API errors: `src/errors/errorTypes.ts:535`.
  - Stream write helpers: `src/ai/core/aiLogic.ts:422`.
- Provide user-facing messages via `apiErrorHandler` toast mapping (`src/utils/apiErrorHandler.ts:113`).

## React and Hooks
- Use functional components with hooks.
- Derive UI state via hooks; avoid global mutable state.
- Keep side effects inside `useEffect` with correct dependencies; guard async flows.
- Expose callbacks with clear names (`onSendMessage`, `onError`, `onFinish`).

## Browser Tools and Workflows
- Register tools through provided hooks/components; follow existing patterns for parameters and execution.
- Keep tool descriptions actionable and include preconditions/limitations (`src/actions/memory/deleteMemory.tsx:18`, `src/actions/memory/getMemory.tsx:18`).

## Storage and Data
- Use `@plasmohq/storage` for extension storage; avoid direct `localStorage` (`src/memory/store.ts:12`).
- Maintain indices for efficient queries; update index on CRUD (`src/memory/store.ts:37`, `src/memory/store.ts:68`).

## Performance and UX
- Avoid heavy operations on the UI thread; use offscreen where applicable (`public/offscreen.js:1`).
- Throttle/batch UI updates during streaming and downloads (`public/offscreen.js:46`).

## Security
- Never embed secrets in code or logs.
- Validate user inputs and tool parameters.
- Respect Chrome MV3 permissions and protected pages; handle injection failures gracefully (`src/errors/errorTypes.ts:535`).

## Formatting and Checks
- Use Prettier for formatting and the sort-imports plugin.
- Run type checks before pushing: `pnpm type:check` (`package.json:13`).

## Examples
- Logger import:
  ```ts
  import { createLogger } from '~logger';
  const log = createLogger('SettingsPage');
  log.info('Loaded');
  ```
- Utils import:
  ```ts
  import { handleAPIError } from '@/utils/apiErrorHandler';
  try { /* ... */ } catch (err) { const toast = handleAPIError(err as Error); }
  ```