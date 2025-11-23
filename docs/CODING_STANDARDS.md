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
- **CRITICAL**: All import statements must be grouped at the top of the file; never define functions or constants between import blocks.
- **CRITICAL**: Remove duplicate imports of the same identifier; consolidate into single import statement.

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
- **CRITICAL**: Never use empty catch blocks; always log errors with context for debugging. Use logger's `warn()` or `error()` methods with descriptive messages.
- Prefer `unknown` over `any` for function parameters that will be validated; type `any` bypasses compile-time safety.
- **CRITICAL**: Validate API response structure before accessing properties; check for `null` or non-object responses to prevent runtime errors.
- **CRITICAL**: Always use `APIError` instead of generic `Error` for consistency across the codebase; include statusCode, retryable flag, userMessage, technicalDetails, and errorCode from ErrorType enum.
- **CRITICAL**: Wrap initialization logic in try-catch blocks; ensure all async initialization functions handle errors gracefully and provide meaningful error context.

## React and Hooks
- Use functional components with hooks.
- Derive UI state via hooks; avoid global mutable state.
- Keep side effects inside `useEffect` with correct dependencies; guard async flows.
- Expose callbacks with clear names (`onSendMessage`, `onError`, `onFinish`).
- **CRITICAL**: Always include dependency arrays in `useImperativeHandle` (e.g., `[controls]`) to prevent unnecessary re-renders and stale closures.
- For controlled/uncontrolled components: set control flags inside imperative methods, not in hook initialization, to preserve default behavior.
- **CRITICAL**: Always call prop event handlers (onMouseEnter/onMouseLeave/etc.) unconditionally, even when internal control logic branches; only conditionally trigger internal animations to maintain React's prop contract.
- Ensure animation variant names match defined states in variants objects.
- Add accessibility attributes to SVG icons: use `aria-label` and `role="img"` for meaningful icons, or `aria-hidden="true"` for decorative ones.
- **CRITICAL**: Tool UI renderers (renderInput/renderOutput) must handle both success and error responses; check for `error` property before accessing success-only fields like `url` or `result` to prevent invalid rendering.
- **CRITICAL**: Observer pattern (subscribe/publish) should send real current state to new subscribers, not synthetic dummy triggers; if no current state exists, don't call callback immediately or document that it's notification-only.

## Component Best Practices (from Batch 2 Review)
- Always define TypeScript interfaces for component props, even for simple components with single props like `size?: number`.
- Never use inline `//` comments inside JSX attributes; use `{/* */}` JSX comments or move comments outside tags.
- Export names must follow consistent naming conventions: use `Icon` suffix for all icon exports (e.g., `XMLIcon`, not `XML`).
- Remove unused state variables to avoid dead code and potential confusion.
- Interactive elements (cursor: pointer) must include keyboard support: add `role="button"`, `tabIndex={0}`, and `onKeyDown`/`onKeyUp` handlers for Enter and Space keys.
- Always call parent event handlers in controlled/uncontrolled components; never skip them based on control state to maintain React's prop contract.
- **CRITICAL**: Use stable unique identifiers (e.g., `item.id`) as React keys, never array indices; unstable keys cause rendering issues when lists are reordered or mutated.

## Browser Tools and Workflows
- Register tools through provided hooks/components; follow existing patterns for parameters and execution.
- Keep tool descriptions actionable and include preconditions/limitations (`src/actions/memory/deleteMemory.tsx:18`, `src/actions/memory/getMemory.tsx:18`).
- Remove unimplemented features from tool schemas; don't expose parameters that always return errors. Either implement the feature or remove the parameter entirely.
- Use Zod's built-in validators (`.min()`, `.max()`, `.int()`) for parameter validation instead of manual runtime checks when possible.
- **CRITICAL**: Test assertions must throw errors or use assertion libraries when expectations fail; logging-only "tests" provide false confidence and don't catch regressions.

## Storage and Data
- Use `@plasmohq/storage` for extension storage; avoid direct `localStorage` (`src/memory/store.ts:12`).
- Maintain indices for efficient queries; update index on CRUD (`src/memory/store.ts:37`, `src/memory/store.ts:68`).

## Performance and UX
- Avoid heavy operations on the UI thread; use offscreen where applicable (`public/offscreen.js:1`).
- Throttle/batch UI updates during streaming and downloads (`public/offscreen.js:46`).
- **CRITICAL**: Always use `Math.floor()` for numeric calculations that should produce integer values (durations, counts, indices) to avoid fractional output.
- Extract duplicate constants (regex patterns, enums, magic values) to single source of truth; follow DRY principle to improve maintainability.

## Security
- Never embed secrets in code or logs.
- Validate user inputs and tool parameters.
- Respect Chrome MV3 permissions and protected pages; handle injection failures gracefully (`src/errors/errorTypes.ts:535`).
- **CRITICAL**: Escape regex metacharacters in user-provided strings before using them in `RegExp` constructors; use `.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` to prevent regex injection and runtime errors.
- **CRITICAL**: Never pass API keys in URL query parameters; always use request headers (e.g., `X-Goog-Api-Key`) to prevent exposure in logs, browser history, and proxy servers.

## Build Scripts and Node.js Utilities
- Always validate array bounds before accessing elements; add defensive checks with clear warning messages.
- Wrap file I/O operations (`fs.copyFileSync`, `fs.writeFileSync`, etc.) in try-catch blocks; log errors with full context and exit with non-zero status code on failure.
- Use `String.replaceAll()` or global regex when replacing all occurrences; `String.replace()` only replaces the first match.
- Implement concurrency guards for async operations that shouldn't run simultaneously; check flags before starting and clear them in finally blocks.
- Calculate progress percentages correctly: use `(loaded / total) * 100`, not raw byte manipulation; provide fallbacks when totals are unavailable.
- Remove commented-out code from source files; rely on git history for recovery if needed.

## Canvas and DOM Element Lifecycle
- **CRITICAL**: Always clean up injected DOM elements (canvas, style tags) when tools unregister or components unmount.
- Track active animations with counters or flags; implement cleanup when animation count reaches zero.
- Schedule idle cleanup (e.g., 3 seconds after last animation) to remove canvas elements and event listeners.
- Store references to event listeners for proper removal; use named functions instead of anonymous functions.
- Never let DOM elements persist indefinitely without a cleanup strategy.

## Event Listener Management
- **CRITICAL**: Always remove event listeners in cleanup functions; memory leaks accumulate across content script reloads.
- Store named handler references to enable proper removal: `window.removeEventListener('resize', handler)` requires the same function reference used in `addEventListener`.
- Guard against duplicate listener registration: check if handler already exists before adding.
- For content scripts: use `(window as any).__handlerName` to persist handler references across function calls.
- Remove listeners when: component unmounts, tool unregisters, canvas is destroyed, or page unloads.

## Animation and Resource Tracking
- Implement animation counters to track active animations: increment on start, decrement on completion.
- Schedule cleanup after idle timeout (e.g., 3 seconds) when animation count reaches zero.
- Clean up: canvas elements, style tags, event listeners, timers, and animation frame requests.
- Use global flags for shared resources accessed by multiple tool executions (e.g., `(window as any).__aiClickAnimations`).
- Ensure cleanup runs even if animation fails; use try-catch with counter decrement in catch block.

## Async Return Values and Promises
- **CRITICAL**: Never use `setTimeout` with a return statement expecting the outer function to receive the delayed value.
- Return values inside `setTimeout` callbacks are discarded; the outer function returns immediately.
- Use Promises for async operations: wrap `setTimeout` in `new Promise((resolve) => ...)` and `await` or return the Promise.
- For delayed computations, always resolve/reject the Promise with the computed value.
- **CRITICAL**: Add timeout guards to all Promises that interact with external systems (DOM, APIs, user input); use `Promise.race()` with timeout to prevent indefinite hangs; always ensure every Promise branch calls resolve/reject.

## Third-Party DOM Selector Robustness
- For DOM queries dependent on third-party page structure (SERP extraction, site-specific scraping), implement fallback selector arrays.
- Try selectors in order of reliability: specific class names → generic containers → ARIA attributes → broad fallbacks.
- Log warnings when primary selectors fail and fallbacks are used: `console.warn('[Context] Selector X failed, trying fallback Y')`.
- Log when extraction yields fewer results than expected to aid debugging.
- Wrap selector queries in try-catch to handle malformed selectors or DOM exceptions gracefully.
- **CRITICAL**: Use relative/child selectors (e.g., `element.querySelector('#child')`) instead of nested absolute selectors that redundantly repeat parent IDs; nested absolute selectors are logically impossible and will always fail.

## API Integration Best Practices
- Validate enum/union types against official API documentation before hardcoding values; invalid values cause runtime errors.
- When APIs support multiple valid values (voice names, model IDs, etc.), maintain complete lists in type definitions.
- Monitor API deprecation notices and update hardcoded identifiers before deprecation dates; add comments with expiration dates for preview/beta endpoints.

## Formatting and Checks
- Use Prettier for formatting and the sort-imports plugin.
- Run type checks before pushing: `pnpm type:check` (`package.json:13`).
- **CRITICAL**: Keep comments and documentation in sync with code; update comments immediately when implementation changes to prevent confusion and maintenance issues.

## TypeScript Type Safety
- **CRITICAL**: Maintain type consistency across related interfaces; if external APIs return a type (e.g., `string`), use that type consistently throughout the codebase rather than converting arbitrarily.
- Prefer `unknown` over `any` for generic parameters, callbacks, and unvalidated data; `unknown` forces type checking before use.
- When defining configuration interfaces, ensure all properties used in default/constant objects are declared in the interface.
- Validate external data types (API responses, user input) and use type guards before accessing properties.

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