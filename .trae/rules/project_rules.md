# Coding Standards

## Core Principles
- Use TypeScript with strict type checking enabled (`tsconfig.json:33-61`).
- Prefer `const` over `let`; avoid `var` (see contributing guidelines).
- Keep modules small and single-responsibility; co-locate related hooks/components.
- Do not log secrets, API keys, or personally identifiable information.

## TypeScript Configuration
- Strictness: `strict`, `noImplicitAny`, `strictNullChecks`, `noImplicitReturns`, `noUncheckedIndexedAccess` (`/c:/Users/User/code/hackathons/chrome-ai/tsconfig.json:46-61`).
- Module resolution: `moduleResolution: bundler`, `resolveJsonModule: true` (`/c:/Users/User/code/hackathons/chrome-ai/tsconfig.json:64-65`).
- **CRITICAL**: Always use path aliases instead of relative paths; see canonical source at `.cursor/rules/coding-standards.mdc` for the complete import guide.
- Path aliases (configured in `tsconfig.json:18-48`):
  - `~*` → `./src/*` (e.g., `import { something } from '~/utils/helper';`)
  - `@/*` → `./src/*` (e.g., `import { handleAPIError } from '@/utils/apiErrorHandler';`)
  - `@assets/*` → `./assets/*` (e.g., `import icon from '@assets/icon.png';`)
  - `~logger` → `./src/logger` (e.g., `import { createLogger } from '~logger';`)
  - `@components` → `./src/components` (e.g., `import { Button } from '@components';`)
  - `@components/*` → `./src/components/*` (e.g., `import { Button } from '@components/ui/Button';`)
  - `@ai` → `./src/ai` (e.g., `import { ModelSetup } from '@ai';`)
  - `@ai/*` → `./src/ai/*` (e.g., `import { ModelSetup } from '@ai/core/modelSetup';`)

## Imports and Modules
- **CRITICAL**: Always use path aliases instead of deep relative paths; never use `../../` or `../../../` patterns.
- **CRITICAL**: Reference the canonical import guide at `.cursor/rules/coding-standards.mdc` for complete import patterns.
- Always use path aliases configured in `tsconfig.json`:
  - Logger: `import { createLogger } from '~logger';` (not `import { createLogger } from '../../logger';`)
  - Utils: `import { handleAPIError } from '@/utils/apiErrorHandler';` (not `import { handleAPIError } from '../utils/apiErrorHandler';`)
  - Components: `import { Button } from '@components/ui/Button';` (not `import { Button } from '../../components/ui/Button';`)
  - Constants: `import { API_ENDPOINTS } from '@/constants/api';` (not `import { API_ENDPOINTS } from '../constants/api';`)
  - AI: `import { ModelSetup } from '@ai/core/modelSetup';` (not `import { ModelSetup } from '../../ai/core/modelSetup';`)
  - Assets: `import icon from '@assets/icon.png';` (not `import icon from '../../assets/icon.png';`)
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
- **CRITICAL**: Define proper TypeScript interfaces for callback parameters instead of `any`; validate objects have required methods before calling them to prevent runtime errors.
- **CRITICAL**: Wrap all external I/O operations (writer.write, API calls) in try-catch blocks; log failures with context but continue execution where possible.
- **CRITICAL**: Always null-check error objects before accessing properties (use `error?.message || 'Unknown error'`) to avoid secondary crashes in error handlers.
- **CRITICAL**: Remove debug logging statements that output raw error objects; these may contain sensitive information (tokens, credentials, stack traces); log only sanitized error messages or specific safe properties.

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
- **CRITICAL**: Use refs for values that need to stay current across closure boundaries in event handlers; closures capture variable values at creation time, causing stale state bugs when accessing state variables directly in callbacks registered during component initialization.

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
- **CRITICAL**: Tool counting functions must apply the same filtering logic as tool selection functions; count only enabled tools and exclude disabled/workflow-only tools to ensure accurate counts match actual available tools.

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
- **CRITICAL**: When modifying HTTP headers in fetch operations, create new Headers objects to avoid mutating the original RequestInit; use `new Headers()` constructor which handles both Headers instances and plain objects correctly.

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
- **CRITICAL**: Event listeners on success paths must be cleaned up; always remove abort/signal listeners before returning from async functions, even when operations succeed, to prevent accumulation across multiple calls.

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
- Maintain consistent trailing commas in object literals and arrays; follow established codebase patterns for readability.
- Avoid double semicolons and other syntax redundancies; use single semicolon at statement ends.
- **CRITICAL**: All CSS numeric values with units must include the unit identifier (px, %, em, etc.); unitless values are invalid except for specific properties like line-height, z-index, or opacity.

## TypeScript Type Safety
- **CRITICAL**: Maintain type consistency across related interfaces; if external APIs return a type (e.g., `string`), use that type consistently throughout the codebase rather than converting arbitrarily.
- Prefer `unknown` over `any` for generic parameters, callbacks, and unvalidated data; `unknown` forces type checking before use.
- When defining configuration interfaces, ensure all properties used in default/constant objects are declared in the interface.
- Validate external data types (API responses, user input) and use type guards before accessing properties.
- **CRITICAL**: Never use `& any` in type definitions; it defeats all type checking and allows arbitrary properties; define explicit interfaces with all required and optional properties declared.
- **CRITICAL**: All destructured variables must be declared in the function's type signature; never extract properties that aren't part of the defined parameter type.

## UI Components and Accessibility
- **CRITICAL**: Extract duplicate component configurations (buttons, list items) into reusable arrays with interfaces; avoid repeating identical styles, event handlers, and disabled logic.
- **CRITICAL**: Use `type="button"` on all buttons that shouldn't submit forms; omitting this defaults to `type="submit"` and triggers unintended form submissions.
- **CRITICAL**: Add keyboard accessibility to clickable non-button elements; include `role="button"`, `tabIndex={0}`, and `onKeyDown` handlers for Enter/Space keys.
- **CRITICAL**: Always append units to numeric displays (%, px, ms) for clarity; "75" should be "75%" for percentages.
- Use consistent class naming; avoid copy-paste artifacts like `copy-message-button` on download components.

## Async Message Handling
- **CRITICAL**: Wrap async switch/case statements in try-catch blocks to ensure response callbacks always execute; unhandled throws leave callers hanging indefinitely.
- **CRITICAL**: Define typed interfaces for message payloads with type guards; avoid `any` parameters that bypass TypeScript safety.
- Use spread operator `...array` instead of `.apply(null, Array.from())` for better TypeScript compatibility and readability.
- **CRITICAL**: Check `chrome.runtime.lastError` in all Chrome API callbacks (storage, notifications); silent failures cause state inconsistencies.
- Use utility functions consistently across similar operations (e.g., `clearNotification()` instead of direct `chrome.notifications.clear()`).

## Animation and Exit Behavior
- **CRITICAL**: AnimatePresence must remain mounted to coordinate exit animations; move conditional rendering inside AnimatePresence rather than returning null before it.
- **CRITICAL**: Always wrap AnimatePresence children in conditionals (e.g., `{isOpen && <motion.div>...</motion.div>}`); add stable `key` props to motion elements for proper tracking.

## DOM Reference Lifecycle
- **CRITICAL**: Re-query DOM elements in cleanup functions instead of capturing references once; elements can be recreated/replaced during component lifecycle causing stale references.
- Use `document.querySelector()` both in effect setup and cleanup to operate on current DOM state.

## Type Safety and Message Structures
- **CRITICAL**: Define specific interfaces for complex data structures (e.g., MessagePart) instead of using `any[]`; use `unknown[]` with type guards if structure varies.
- For message/event handlers, define typed interfaces with required properties instead of `any` parameters.

## useEffect Dependencies
- **CRITICAL**: Exclude callback props from useEffect dependency arrays when they're only used in cleanup; including them causes effects to re-run when parent re-defines callbacks, triggering premature cleanup.
- Parent components should memoize callbacks with `useCallback` if stable references are needed.

## Aggregate Calculations
- **CRITICAL**: When logging or tracking totals from nested collections (Map<K, Set<V>>), calculate actual sum of all nested sizes; don't use outer collection size as proxy for total items.
- Use `Array.from(map.values()).reduce((sum, set) => sum + set.size, 0)` pattern.

## State Updates During Render
- **CRITICAL**: Never call state setters during render phase; move conditional state updates into `useEffect` with appropriate dependencies.
- React render functions must be pure; side effects belong in useEffect, event handlers, or callbacks.

## UI State Management
- **CRITICAL**: Always provide loading states during async operations; show spinners or skeletons while fetching data to avoid empty-state confusion.
- **CRITICAL**: Display error states with retry functionality; never fail silently—show users what went wrong and provide recovery options.
- **CRITICAL**: Polling intervals should be 5+ seconds minimum; sub-second polling causes excessive resource usage and battery drain.

## Type Safety with Third-Party APIs
- **CRITICAL**: Define proper TypeScript interfaces for third-party object properties instead of using `as any`; create interface definitions for external libraries' internal objects when accessing undocumented properties.
- **CRITICAL**: When accessing internal/private properties of library objects, document the dependency and create typed interfaces to maintain type safety across casts.

## Accessibility
- **CRITICAL**: All icon-only buttons must have `aria-label` attributes; relying solely on `title` attributes is insufficient for screen readers.
- **CRITICAL**: Always add `aria-label` to close buttons (×) and help buttons (?); visual symbols don't convey meaning to assistive technologies.

## Event Listener Lifecycle
- **CRITICAL**: Store event listener function references in outer scope for proper cleanup in both success and error paths; creating new functions in cleanup prevents removeEventListener from working.
- **CRITICAL**: Use named function variables (not inline arrows) for event listeners that need removal; same reference must be passed to both addEventListener and removeEventListener.

## Async Storage Error Handling
- **CRITICAL**: Wrap all storage persistence calls (setItem, setVoiceName, etc.) in try-catch blocks; on failure, revert UI state and notify user to prevent silent data loss.
- Always store previous state before async updates; use it to rollback on persistence failure.

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