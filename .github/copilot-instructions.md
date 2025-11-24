# Cognito AI Browser Agent - Development Guide

## Project Overview
Cognito is a Chrome MV3 extension that provides an AI-powered browser agent with voice interaction, tool execution, MCP server integration, and automated workflows. Built with Plasmo, React, TypeScript, and AI SDK v5.

## Architecture

### Multi-Agent System
The extension uses a **two-tier agent architecture**:
1. **Gemini Live Voice Agent** (`src/ai/geminiLive/`) - User-facing conversational AI that handles voice interactions and delegates browser tasks
2. **Browser Action Agent** (`src/ai/agents/browser/`) - Backend AI that executes multi-step browser automation using registered tools

**Critical Flow**: User speaks → Voice Agent → executeBrowserAction tool → Browser Agent → Chrome APIs → Result → Voice Agent → User hears response

### Tool Registration Pattern
Tools are React hooks that register capabilities with the AI:
```typescript
// Tools live in src/actions/[category]/ (e.g., tabs, memory, bookmarks)
export function useMyTool() {
  useEffect(() => {
    registerTool({
      name: 'toolName',
      description: 'AI-readable description with USE/REQUIRES/BEHAVIOR/EXAMPLE',
      parameters: z.object({ /* Zod schema */ }),
      execute: async (args, abortSignal) => { /* implementation */ },
      validateContext: async () => ({ valid: true }) // optional
    });
  }, []);
}

// Register in src/actions/registerAll.ts
// All tools called in useRegisterAllActions() in sidepanel.tsx
```

**Tool UI**: Use `useToolUI()` hook + `CompactToolRenderer` for consistent display. Register UI in the same hook with `registerToolUI(name, renderer)`.

### Communication Layers
- **Sidepanel** (`src/sidepanel.tsx`) - Main React UI, initializes tools/workflows, manages chat state
- **Background Service Worker** (`src/background.ts`) - Orchestrates modules: MCP OAuth, omnibox, alarms, notifications, messaging router
- **Content Scripts** (`src/contents/`) - Injected page interaction (Ask AI button, DOM manipulation)
- **Offscreen Document** (`public/offscreen.js`) - Hosts Chrome Summarizer API for local model downloads

### Storage & State
- **Tool Registry** (`src/ai/tools/registryUtils.ts`) - Global `Map<string, ToolDefinition>`, accessed via `getAllTools()`, `getTool(name)`
- **Workflow Registry** (`src/workflows/registry.ts`) - Similar pattern for multi-step workflows
- **MCP Server State** (`src/mcp/state.ts`) - Centralized state management per server (tokens, credentials, connection status)
- **Memory System** (`src/memory/store.ts`) - Uses `@plasmohq/storage` with indexed key-value storage for AI memory persistence
- **Thread Management** - Messages persisted to IndexedDB/Dexie by thread ID for conversation history

### Model Execution Modes
- **Remote Mode**: Google Gemini API via `@ai-sdk/google` (requires API key)
- **Local Mode**: Gemini Nano via Chrome's built-in AI (`@built-in-ai/core`)
- Setup logic in `src/ai/core/modelSetup.ts`, streaming handled in `src/ai/core/aiLogic.ts`

## Development Workflow

### Setup & Build
```powershell
pnpm install                    # Install dependencies
pnpm dev                        # Development with hot reload → build/chrome-mv3-dev
pnpm build                      # Production build → build/chrome-mv3-prod
pnpm type:check                 # Run TypeScript checks (do this before commits)
```

**Post-install**: Scripts run automatically to patch dependencies (`scripts/patch-vfile.js`, `scripts/patch-math-intrinsics.js`)

**Load Extension**: Chrome → `chrome://extensions` → Developer mode → Load unpacked → `build/chrome-mv3-dev`

**Keyboard Shortcut**: `Ctrl+Shift+H` / `Cmd+Shift+H` opens sidepanel

### Path Aliases (Always Use These)
```typescript
import { createLogger } from '~logger';        // Logger utility
import { handleAPIError } from '@/utils/...';  // Anything in src/ (includes components)
import icon from '@assets/...';                 // Assets folder
```

**Never** use relative paths like `../../../utils/...`

### Logger Pattern (Required)
```typescript
import { createLogger } from '~logger';
const log = createLogger('FeatureName', 'OPTIONAL_CONTEXT');

log.debug('Verbose state');     // Development debugging
log.info('Normal operation');   // Important events
log.warn('Recoverable issue');  // Warnings
log.error('Failure', error);    // Errors with context
```

**Never log secrets, API keys, or PII**. Sanitize error objects before logging.

### Error Handling Standards
- Use `APIError` from `src/errors/` instead of generic `Error`
- Include: `statusCode`, `retryable`, `userMessage`, `technicalDetails`, `errorCode`
- Wrap all async operations in try-catch with context logging
- Check `chrome.runtime.lastError` in all Chrome API callbacks
- Validate API response structure before accessing properties (`response?.data?.field || defaultValue`)

```typescript
import { APIError, ErrorType } from '@/errors';

try {
  const response = await fetch(url);
  if (!response.ok) {
    throw new APIError('Fetch failed', ErrorType.API_ERROR, response.status, true);
  }
} catch (err) {
  log.error('Operation failed', { context: 'FeatureName', error: err?.message || 'Unknown' });
  throw err; // or handle gracefully
}
```

### React Hooks & Effects
- **Cleanup is critical**: Always remove event listeners, unregister tools, clear timers in `useEffect` cleanup
- **Dependency arrays**: Include all used variables except callback props only used in cleanup
- **Refs for closures**: Use refs for values that must stay current across event handler closures
- **AnimatePresence**: Keep mounted, put conditionals inside: `{isOpen && <motion.div key="unique">...</motion.div>}`

### Tool Development Checklist
1. Create hook in `src/actions/[category]/myTool.tsx`
2. Define Zod schema with `.describe()` for parameter docs
3. Write tool description: USE/REQUIRES/BEHAVIOR/RETURNS/LIMITS/EXAMPLE format
4. Implement execute function with abort signal support
5. Register UI renderer with `registerToolUI()` + `CompactToolRenderer`
6. Add to category's `index.tsx` registration function
7. Import and call in `src/actions/registerAll.ts`
8. Add description to `src/constants/toolDescriptions.ts` for settings UI

**Tool descriptions** must be actionable and explain **when** to use the tool, not just what it does. See `src/actions/tabs/getAllTabs.tsx` for reference.

### Workflow Development
Workflows are multi-step orchestrated operations:
1. Define in `src/workflows/definitions/[name]Workflow.ts` with `WorkflowDefinition` type
2. Specify steps array with tool calls, validation, error handling
3. Register in `src/workflows/registerAll.ts` via `registerWorkflow()`
4. Reference example: `src/workflows/definitions/researchWorkflow.ts`

### MCP Server Integration
MCP servers provide external tools via SSE transport:
- Server configs in `src/constants/mcpServers.tsx` (endpoints, OAuth config)
- State management in `src/mcp/state.ts` per-server (tokens, credentials, connection)
- OAuth flow handled in `src/background/mcp/auth.ts`
- Transport detection in `src/mcp/transportDetector.ts` (SSE vs stdio)
- UI in `src/components/features/mcp/`

**Adding new MCP server**: Add config to `MCP_SERVERS` array, implement OAuth endpoints if needed, test connection flow.

## Chrome Extension Specifics

### Permissions & APIs
- Uses `sidePanel`, `tabs`, `tabGroups`, `scripting`, `storage`, `offscreen`, `omnibox`, `alarms`, `notifications`
- Cannot access `chrome://` pages - handle `BrowserAPIError` gracefully
- Background service worker can be terminated anytime - use message passing, avoid long-lived state

### Message Passing
- Background router in `src/background/messaging/router.ts`
- Message types defined in types files
- Always wrap async handlers in try-catch to ensure sendResponse() is called
- Use `chrome.runtime.sendMessage()` for sidepanel → background communication

### Content Script Lifecycle
- Content scripts can reload independently - cleanup DOM elements, event listeners
- Use `(window as any).__globalFlag` for cross-reload state if needed
- Never leave canvas elements, style tags, or event listeners without cleanup strategy

## Testing & Validation

### Pre-Commit Checks
```powershell
pnpm type:check    # TypeScript validation
# Manually test tool execution in sidepanel
# Check Chrome DevTools console for errors
```

### Common Issues
- **Tool not executing**: Check registration in `registerAll.ts`, verify `registerTool()` was called
- **Hot reload not working**: Manually reload extension at `chrome://extensions`
- **Build errors**: Clear cache `rm -rf build/ .plasmo/`, reinstall `pnpm install`
- **Local model download stuck**: Check `chrome://components` for Optimization Guide update

## Key Files Reference
- `src/sidepanel.tsx` - Main UI entry, tool/workflow registration
- `src/background.ts` - Service worker orchestrator
- `src/ai/core/aiLogic.ts` - AI SDK v5 streaming logic
- `src/ai/core/modelSetup.ts` - Local vs remote model setup
- `src/ai/agents/browser/prompts.ts` - Agent system instructions (critical for tool usage)
- `src/ai/tools/registryUtils.ts` - Tool registration system
- `src/actions/registerAll.ts` - Centralized tool registration
- `src/workflows/registry.ts` - Workflow system
- `src/memory/store.ts` - Memory persistence layer
- `src/mcp/state.ts` - MCP server state management
- `docs/CODING_STANDARDS.md` - Comprehensive coding rules

## Domain-Specific Patterns

### YouTube Video Analysis
- Handled by dedicated agent in `src/ai/agents/browser/browserActionAgent.ts`
- Uses transcript API (Vercel deployment): `src/constants.ts` → `TRANSCRIPT_API_URL`
- Agent tool: `analyzeYouTubeVideo` - delegates to specialized logic

### Voice Interaction
- Gemini Live API in `src/ai/geminiLive/GeminiLiveClient.ts`
- Voice recording UI: `src/components/shared/inputs/VoiceRecordingPill.tsx`
- Audio transcription: `src/audio/` directory
- Voice settings: `src/components/features/settings/components/VoiceSettings.tsx`

### Tab Management
- TabManager singleton in `src/actions/tabs/TabManager.ts`
- Tools: `getAllTabs`, `switchTabs`, `navigateTo`, `organizeTabsByContext`
- Tab grouping by AI context classification

### Memory System
- CRUD operations in `src/memory/store.ts`
- Tools: `rememberThis`, `recallMemory`, `forgetMemory`, `listMemories`
- Indexed by key with confidence scoring
- Uses Chrome sync storage via `@plasmohq/storage`

## Anti-Patterns to Avoid
- ❌ Using `any` type - prefer `unknown` with type guards
- ❌ Empty catch blocks - always log errors with context
- ❌ Logging raw API responses - may contain secrets
- ❌ Mutation of props/state during render - use `useEffect`
- ❌ Event listeners without cleanup - causes memory leaks
- ❌ Inline JSX comments with `//` - use `{/* */}` instead
- ❌ Array indices as React keys - use stable IDs
- ❌ Missing units on CSS numeric values - always include `px`, `%`, etc.
- ❌ Accessing error properties without null check - use `error?.message || 'Unknown'`
- ❌ API keys in URL params - use headers (`X-Goog-Api-Key`)

## Useful Commands
```powershell
# Development
pnpm dev                               # Start dev server
pnpm dev:setup                         # Copy offscreen assets (first time)

# Build
pnpm build                             # Production build
pnpm package                           # Create ZIP for Chrome Web Store

# Type Checking
pnpm type:check                        # Check types without emit
pnpm type:watch                        # Watch mode type checking

# Debugging
# Sidepanel: Right-click extension → Inspect
# Background: chrome://extensions → Service worker "Inspect"
# Content script: F12 on page → Console shows injection logs
```

## Additional Resources
- See `docs/CODING_STANDARDS.md` for exhaustive coding rules and examples
- See `docs/TECHNICAL_DOCUMENTATION.md` for architecture deep dive
- See `SETUP.md` for detailed development setup
- See `plans/` directory for feature implementation plans
- AI SDK v5 docs: https://sdk.vercel.ai/docs
- Plasmo framework: https://docs.plasmo.com/
- Chrome Extension MV3: https://developer.chrome.com/docs/extensions/mv3/
