# Coding Standards

## Core Principles
- Use TypeScript with strict type checking enabled (`tsconfig.json:33-61`).
- Prefer `const` over `let`; avoid `var` (see contributing guidelines).
- Keep modules small and single-responsibility; co-locate related hooks/components.
- Do not log secrets, API keys, or personally identifiable information.

## TypeScript Configuration
- Strictness: `strict`, `noImplicitAny`, `strictNullChecks`, `noImplicitReturns`, `noUncheckedIndexedAccess` (`tsconfig.json:46-61`).
- Module resolution: `moduleResolution: bundler`, `resolveJsonModule: true` (`tsconfig.json:64-65`).
- **CRITICAL**: Always use path aliases instead of relative paths; see canonical source at `.cursor/rules/coding-standards.mdc` for the complete import guide.
- Path aliases (configured in `tsconfig.json`):
  - `~*` → `./src/*` (e.g., `import { something } from '~/utils/helper';`)
  - `@/*` → `./src/*` (e.g., `import { handleAPIError } from '@/utils/apiErrorHandler';` or `import { Button } from '@/components/ui/Button';`)
  - `@assets/*` → `./assets/*` (e.g., `import icon from '@assets/icon.png';`)
  - `~logger` → `./src/logger` (e.g., `import { createLogger } from '~logger';`)

## Imports and Modules
- **CRITICAL**: Always use path aliases instead of deep relative paths; never use `../../` or `../../../` patterns.
- **CRITICAL**: Reference the canonical import guide at `.cursor/rules/coding-standards.mdc` for complete import patterns.
- Always use path aliases configured in `tsconfig.json`:
  - Logger: `import { createLogger } from '~logger';` (not `import { createLogger } from '../../logger';`)
  - Utils: `import { handleAPIError } from '@/utils/apiErrorHandler';` (not `import { handleAPIError } from '../utils/apiErrorHandler';`)
  - Components: `import { Button } from '@/components/ui/Button';` (not `import { Button } from '../../components/ui/Button';`)
  - Constants: `import { API_ENDPOINTS } from '@/constants/api';` (not `import { API_ENDPOINTS } from '../constants/api';`)
  - AI: `import { ModelSetup } from '@/ai/core/modelSetup';` (not `import { ModelSetup } from '../../ai/core/modelSetup';`)
  - Assets: `import icon from '@assets/icon.png';` (not `import icon from '../../assets/icon.png';`)
- Group and sort imports consistently; rely on the Prettier sort-imports plugin.
- Prefer named exports; avoid default exports for shared utilities.
- **CRITICAL**: All import statements must be grouped at the top of the file; never define functions or constants between import blocks.
- **CRITICAL**: Remove duplicate imports of the same identifier; consolidate into single import statement.

## Environment Variables
- **CRITICAL**: Always use the centralized `ENV` module from `@/utils/env` instead of directly accessing `import.meta.env` or `process.env`.
- The `ENV` module provides typed access to all WXT environment variables with sensible defaults.
- Examples:
  ```typescript
  // ✅ CORRECT - Use centralized ENV module
  import { ENV } from '@/utils/env';
  const workerUrl = ENV.ELEVENLABS_WORKER_URL;
  const backendUrl = ENV.BACKEND_API_URL;
  
  // ❌ WRONG - Never access directly
  const workerUrl = import.meta.env.WXT_ELEVENLABS_WORKER_URL;
  const backendUrl = process.env.WXT_BACKEND_API_URL;
  ```
- See `src/utils/env.ts` for all available environment variables with their default values.

## Logger Usage
- Initialize a module-scoped logger and reuse it:
  - `const log = createLogger('FeatureName', 'CATEGORY');` (`src/ai/core/modelSetup.ts:36`).
- Levels: use `debug` for verbose state, `info` for normal operation, `warn` for recoverable issues, `error` for failures.
- Do not include API keys or secrets in logs; sanitize error objects.

## Logger Categories
All `createLogger` calls MUST include a category as the second argument:

```typescript
import { createLogger } from '~logger';
const log = createLogger('FeatureName', 'CATEGORY');
```

**Available Categories:**
- **MCP**: `MCP_CLIENT`, `MCP_TOOLS`, `MCP_EXECUTION`, `MCP_AUTH`, `MCP_SSE`, `WEBMCP`
- **Tools**: `TOOLS_REGISTRY`, `TOOLS_EXECUTION`, `TOOLS_VALIDATION`, `TOOLS_INTEGRATION`
- **AI**: `AI_CHAT`, `AI_PROMPTS`, `AI_VOICE`, `AI_WEBSITE_DETECTION`
- **Voice**: `VOICE_RECORDING`, `VOICE_CLIENT`, `VOICE_UI`, `VOICE_AUDIO`
- **Memory**: `MEMORY_OPERATIONS`, `MEMORY_SUGGESTIONS`
- **UI**: `UI_CHAT`, `UI_VOICE`, `UI_SETTINGS`, `UI_THREADS`, `UI_SIDEPANEL`, `UI_REMINDERS`
- **System**: `BACKGROUND`, `STORAGE`, `UTILS`, `NOTIFICATIONS`, `CREDENTIALS`, `SEARCH`, `SETTINGS`, `WORKFLOW`, `BROWSER`, `ATTACHMENTS`, `CONTENT_SCRIPTS`

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
- **CRITICAL (Zustand)**: Always use **selective subscriptions** when accessing Zustand stores in components. Never subscribe to the entire store with `useStore()` as it causes re-renders on ANY state change, leading to infinite update loops. Always use selectors: `useStore((s) => s.specificValue)` for each piece of state needed.
- **CRITICAL**: Always include dependency arrays in `useImperativeHandle` (e.g., `[controls]`) to prevent unnecessary re-renders and stale closures.
- For controlled/uncontrolled components: set control flags inside imperative methods, not in hook initialization, to preserve default behavior.
- **CRITICAL**: Always call prop event handlers (onMouseEnter/onMouseLeave/etc.) unconditionally, even when internal control logic branches; only conditionally trigger internal animations to maintain React's prop contract.
- Ensure animation variant names match defined states in variants objects.
- Add accessibility attributes to SVG icons: use `aria-label` and `role="img"` for meaningful icons, or `aria-hidden="true"` for decorative ones.
- **CRITICAL**: Tool UI renderers (renderInput/renderOutput) must handle both success and error responses; check for `error` property before accessing success-only fields like `url` or `result` to prevent invalid rendering.
- **CRITICAL**: Observer pattern (subscribe/publish) should send real current state to new subscribers, not synthetic dummy triggers; if no current state exists, don't call callback immediately or document that it's notification-only.
- **CRITICAL**: Use refs for values that need to stay current across closure boundaries in event handlers; closures capture variable values at creation time, causing stale state bugs when accessing state variables directly in callbacks registered during component initialization.

## React 19 Patterns
This extension uses **React 19** with the following important patterns:

### `ref` as a Prop (Preferred)
In React 19, `ref` is passed as a regular prop instead of using `forwardRef`:

```typescript
// ✅ React 19 - ref as a regular prop
interface MyComponentProps {
  ref?: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

function MyComponent({ ref, className }: MyComponentProps) {
  return <div ref={ref} className={className} />;
}

// ❌ Old React 18 pattern (still works but not preferred for new code)
const MyComponent = forwardRef<HTMLDivElement, Props>((props, ref) => {
  return <div ref={ref} {...props} />;
});
```

### `useRef` Null Handling
`useRef<T>(null)` now returns `RefObject<T | null>` instead of `RefObject<T>`. Always include `| null` in the type:

```typescript
// ✅ React 19 - explicit null in type
const inputRef = useRef<HTMLInputElement | null>(null);
const containerRef = useRef<HTMLDivElement | null>(null);

// ❌ Old pattern - no longer compatible
const inputRef = useRef<HTMLInputElement>(null);
```

### Component Props Accepting Refs
When defining component props that accept refs, always include `| null` in the RefObject type:

```typescript
// ✅ Correct - includes null for React 19 compatibility
interface ComposerProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  submitButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

// ❌ Incorrect - will cause type errors in React 19
interface ComposerProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}
```

## State Management (Zustand Stores)

The extension uses Zustand for centralized state management with Chrome storage sync.

**CRITICAL: Selective Subscriptions Required**

Never subscribe to the entire store. Always use selectors to subscribe to specific state slices:

```typescript
// ❌ BAD - Causes infinite re-render loops
const store = useToolsStore();

// ✅ GOOD - Selective subscriptions
const showModal = useToolsStore((s) => s.showModal);
const setShowModal = useToolsStore((s) => s.setShowModal);
const itemCount = useToolsStore((s) => s.itemCount);
```

| Store | Purpose |
|-------|---------|
| `useSettingsStore` | API keys, preferences, feature flags |
| `useUINavigationStore` | Panel navigation, overlays, chat mode |
| `useModelStore` | AI mode and model selection |
| `useChatStore` | Messages, threads, usage tracking |
| `useAttachmentsStore` | File, tab, PDF, YouTube attachments |
| `useToolsStore` | Tool enabled states and counts |
| `useVoiceModeStore` | Voice recording and ElevenLabs state |
| `useMcpStore` | MCP server connections and status |

**Usage Pattern:**
```typescript
import { useChatStore, type ChatState } from '@/stores';

// Always type the state parameter in selectors
const messages = useChatStore((state: ChatState) => state.messages);
```

See `src/stores/README.md` for detailed documentation.

## Mode Architecture

The extension uses 4 distinct "mode" concepts. Don't confuse them:

| Type | Values | Purpose | Store |
|------|--------|---------|-------|
| `AIProviderMode` | `local`/`remote` | WHERE AI runs | `useModelStore.mode` |
| `ToolsMode` | `chat`/`agent`/`adaptive`/`custom` | WHICH TOOLS available | `useToolsStore.currentMode` |
| `ChatMode` | `text`/`voice` | User INPUT METHOD | `useUINavigationStore.chatMode` |
| Backend Mode | `boolean` | HOW remote API is called | `useSettingsStore.useBackendMode` |

### How Modes Interact

```
AIProviderMode = 'local'  → Chrome built-in AI (Gemini Nano)
AIProviderMode = 'remote' → Check Backend Mode:
  └─ useBackendMode = true  → Vercel backend (no key)
  └─ useBackendMode = false → BYOK (direct Google AI API)
```

### Type Imports

```typescript
// AIProviderMode / AIMode
import type { AIProviderMode, AIMode } from '@/stores/chat/types';

// ToolsMode / ToolMode
import type { ToolsMode } from '@/types/settings';
import type { ToolMode } from '@/stores/tools/types';

// ChatMode
import type { ChatMode } from '@/stores/ui/types';
```

## Component Best Practices
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
- Use Chrome storage APIs (`chrome.storage.local`, `chrome.storage.sync`) for user settings and preferences.
- Use Dexie (IndexedDB wrapper) for structured data like messages, threads, and usage tracking (`src/db/`).
- Avoid direct `localStorage` in extension code; prefer Chrome storage APIs or Dexie for the data type.
- Maintain indices for efficient queries; define Dexie schemas with appropriate indices (`src/db/database.ts`).
- The extension is built with [WXT](https://wxt.dev/), not Plasmo; use WXT conventions for entrypoints and configuration.

## Database Directory Structure (`src/db/`)
- `database.ts` - Core Dexie database setup, schema definitions, and database instance
- `index.ts` - Barrel export file for all database operations
- `management.ts` - Database management utilities (clear, reset, migrations)
- `messages.ts` - Message CRUD operations and queries
- `threads.ts` - Thread management (create, update, delete, list)
- `settings.ts` - Persistent settings storage via IndexedDB
- `usage.ts` - Token usage tracking and aggregation
- `types.ts` - TypeScript interfaces for database entities
- `reportSections.ts` - Report section storage for research features
- `researchSources.ts` - Research source tracking and management

## AI SDK v6

This extension uses **Vercel AI SDK v6** for all AI interactions.

### Human-in-the-Loop Tool Approval

For sensitive browser actions, the extension implements human-in-the-loop approval:

| Component | Location | Purpose |
|-----------|----------|---------|
| `TOOLS_REQUIRING_APPROVAL` | `src/ai/setup/remoteMode.ts` | List of tools needing approval |
| `TOOL_APPROVAL_CONFIG` | `src/ai/tools/approvalConfig.ts` | Per-tool domain extraction |
| `approvalStore` | `src/stores/approval/` | Approval preferences (Zustand) |
| `CompactToolRenderer` | `src/ai/tools/components/` | Approval UI rendering |

**CRITICAL**: When registering custom tool UI, always pass `addToolOutput` for approval flow:
```typescript
registerToolUI('toolName', (state: ToolUIState, options) => {
    return <CompactToolRenderer state={state} addToolOutput={options?.addToolOutput} />;
});
```

See `docs/TOOL_APPROVAL_SYSTEM.md` for full architecture and diagrams.

## AI Modes
The extension supports multiple AI operational modes configured via `ToolsMode` (`src/types/settings.ts`):

| Mode | Description | Prompt Used |
|------|-------------|-------------|
| `chat` | Conversational mode without tool execution | `chatModeSystemPrompt` |
| `agent` | Full agentic mode with all tools pre-loaded | `agentModeSystemPrompt` |
| `adaptive` | On-demand tool discovery mode for context efficiency | `adaptiveSystemPrompt` |
| `custom` | User-defined tool selection | Varies |

### Adaptive Mode
Adaptive mode (`src/ai/prompts/templates/adaptivePrompt.ts`) enables efficient tool usage by:
1. Loading only a lightweight **tool index** (name + description) instead of full tool definitions
2. Using `discoverTools("keyword")` to search and retrieve full details for specific tools
3. Using `executeTools` to orchestrate tool execution via JavaScript code
4. Pre-loading common tools (readPageContent, takeScreenshot, getActiveTab) for direct access

**Key Rules:**
- Tools CANNOT be called directly by name in adaptive mode (except pre-loaded tools)
- Always use `discoverTools` → `executeTools` workflow for non-pre-loaded tools
- Verify task completion by reading page state after actions

## Backend Integration

The extension supports two modes for AI processing configured via `useSettingsStore.useBackendMode`:

| Mode | Description | API Key Required |
|------|-------------|------------------|
| **Backend Mode** | Routes AI through hosted Vercel backend | No |
| **BYOK Mode** | Direct calls to Google AI from extension | Yes |

### Backend Module (`src/ai/backend/`)
- `backendChat.ts` - Simple backend chat (no tools)
- `backendChatWithTools.ts` - Full tool execution loop with frontend tools pattern
- `frontendToolExecutor.ts` - Execute tools locally from backend `tool_call` events
- `gracefulDegradation.ts` - Auto-fallback to BYOK when rate limited

### Frontend Tools Pattern
When using backend mode with tools:
1. Extension sends tool schemas to backend
2. Backend streams `tool_call` events back
3. Extension executes tools locally via `frontendToolExecutor`
4. Results are sent back to backend to continue generation

### Mode Toggling
```typescript
import { useSettingsStore } from '@/stores';

// Check current mode
const useBackendMode = useSettingsStore.getState().useBackendMode;

// Switch modes
useSettingsStore.getState().setUseBackendMode(true);  // Backend mode
useSettingsStore.getState().setUseBackendMode(false); // BYOK mode
```

### Graceful Degradation
When backend rate limits are exceeded, the extension automatically falls back to BYOK mode if the user has an API key configured. See `src/ai/backend/gracefulDegradation.ts`.

## Performance and UX
- Avoid heavy operations on the UI thread; use offscreen where applicable (`public/offscreen.js:1`).
- Throttle/batch UI updates during streaming and downloads (`public/offscreen.js:46`).
- **CRITICAL**: Always use `Math.floor()` for numeric calculations that should produce integer values (durations, counts, indices) to avoid fractional output.
- Extract duplicate constants (regex patterns, enums, magic values) to single source of truth; follow DRY principle to improve maintainability.

## Security
- Never embed secrets in code or logs.
- Validate user inputs and tool parameters.
- Respect Chrome MV3 permissions and protected pages; handle injection failures gracefully (`src/errors/errorTypes.ts:535`).
- **CRITICAL**: Escape regex metacharacters in user-provided strings before using them in `RegExp` constructors; use `.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')` to prevent regex injection and runtime errors.
- **CRITICAL**: Never pass API keys in URL query parameters; always use request headers (e.g., `X-Goog-Api-Key`) to prevent exposure in logs, browser history, and proxy servers.

## DOM Data Extraction Security (CRITICAL)

When extracting data from the DOM that will be sent to AI or any backend, **NEVER capture sensitive input values**:

### Sensitive Input Detection
- **CRITICAL**: Always check if an input is sensitive before capturing `input.value`
- Sensitive input types: `password`
- Sensitive autocomplete values: `cc-number`, `cc-exp`, `cc-exp-month`, `cc-exp-year`, `cc-csc`, `cc-type`, `current-password`, `new-password`, `one-time-code`
- Sensitive name/id patterns: `/password|passwd|card|cvv|cvc|csc|ssn|social.?security|secret|pin|security.?code|tax.?id|routing.?number|account.?number/i`

### Implementation Pattern
```typescript
// SECURITY: Check if input is sensitive before capturing value
function isSensitiveInput(input: HTMLInputElement): boolean {
    const type = (input.type || '').toLowerCase();
    const name = (input.name || '').toLowerCase();
    const autocomplete = (input.autocomplete || '').toLowerCase();
    
    // SECURITY: Input types that are inherently sensitive
    if (type === 'password') return true;
    
    // SECURITY: Autocomplete values indicating sensitive data
    const sensitiveAutocomplete = ['cc-number', 'cc-exp', 'cc-csc', 'current-password', 'new-password'];
    if (sensitiveAutocomplete.some(s => autocomplete.includes(s))) return true;
    
    // SECURITY: Patterns in name/id that indicate sensitive fields
    if (/password|card|cvv|cvc|csc|ssn|secret|pin/i.test(name)) return true;
    
    return false;
}

// Usage:
const data = {
    type: input.type,
    name: input.name,
    // SECURITY: Stripping value from sensitive fields to prevent PII leakage to AI
    value: isSensitiveInput(input) ? undefined : (input.value || undefined),
};
```

### Security Comments
- **CRITICAL**: Always add `// SECURITY:` comments when stripping sensitive data
- Comments must explain why the data is being stripped
- Example: `// SECURITY: Stripping value from sensitive fields to prevent PII leakage to AI`

### Defense-in-Depth
Apply security checks at multiple layers:
1. **Extraction layer**: Strip values when reading from DOM (`extractInputs()`, `detectSearchBars()`)
2. **Formatting layer**: Re-check before formatting data for AI (`formatPageContextForAI()`)
3. **Transport layer**: Validate before sending to backend

### Files Requiring Security Checks
- `src/utils/tabs/pageContextExtractor.ts` - Main page context extraction
- `src/actions/interactions/text-extraction.tsx` - Search bar detection
- Any new code that reads `input.value` or form data from the DOM

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
- **CRITICAL**: All clickable buttons must include `cursor-pointer` class; browsers don't always default to pointer cursor on styled buttons.
- **CRITICAL**: Scrollbars must be modern and minimal; use `mcp-scrollable` class for scrollable containers to apply thin, rounded, semi-transparent scrollbar styling.
- Use consistent class naming; avoid copy-paste artifacts like `copy-message-button` on download components.

## CSS Scoping (CRITICAL)
- **CRITICAL**: Never write broad CSS selectors like `.group:hover span` or `.container div` that can match elements across unrelated components; these cause unpredictable side effects throughout the UI.
- Always use unique, specific class names for CSS targeting (e.g., `.my-feature-btn:hover span` instead of `.group:hover span`).
- Inline `<style>` blocks are especially dangerous—their selectors apply globally and can break other components.
- Avoid selector names that collide with Tailwind utilities (like `group`, `container`, `flex`) in custom CSS rules.

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
  const log = createLogger('SettingsPage', 'UI_SETTINGS');
  log.info('Loaded');
  ```
- Utils import:
  ```ts
  import { handleAPIError } from '@/utils/apiErrorHandler';
  try { /* ... */ } catch (err) { const toast = handleAPIError(err as Error); }
  ```