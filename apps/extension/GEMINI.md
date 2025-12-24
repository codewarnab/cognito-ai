# Cognito AI Extension

**Cognito** is a privacy-first, AI-powered Chrome extension built with [WXT](https://wxt.dev/) and **React 19**. This is part of a **pnpm monorepo** containing the Chrome extension, documentation site, and backend services.

## Key Features

- **AI Side Panel:** Interactive chat interface accessible via `Ctrl+Shift+H` (or `Cmd+Shift+H`), built with React 19 and Tailwind CSS.    
- **Model Context Protocol (MCP):** Implements an MCP client to dynamically discover and connect to "MCP servers," extending the agent's capabilities.
- **Privacy-First Memory:** Uses `Dexie` (IndexedDB) to store user data locally within the browser.
- **Workflow Automation:** Supports "Smart Actions" and workflows to automate browser tasks.
- **Voice Mode:** ElevenLabs integration for conversational AI.
- **YouTube Integration:** Dedicated API for fetching video transcripts.
- **Backend Mode:** Optional server-side AI processing without requiring user API keys.

## Extension Structure

```text
apps/extension/
├── src/
│   ├── entrypoints/            # WXT entrypoints
│   │   ├── sidepanel/          # Main UI entry point (React)
│   │   ├── background/         # Background Service Worker (MCP, messaging)
│   │   └── contents/           # Content scripts
│   ├── stores/                 # Zustand state management
│   ├── actions/                # Browser automation actions
│   ├── ai/                     # AI model integration & prompts
│   ├── components/             # Reusable React UI components
│   ├── mcp/                    # Model Context Protocol client
│   ├── memory/                 # Local database (Dexie)
│   └── workflows/              # Automation workflows
├── wxt.config.ts               # WXT configuration
└── package.json
```

## React 19

This extension uses **React 19** with important changes from React 18:

### `ref` as a Prop
In React 19, `ref` is passed as a regular prop instead of using `forwardRef`:

```typescript
// ✅ React 19 - ref as prop
interface Props {
  ref?: React.RefObject<HTMLDivElement | null>;
}

function MyComponent({ ref, ...props }: Props) {
  return <div ref={ref} {...props} />;
}

// ❌ Old React 18 pattern (still works but not preferred)
const MyComponent = forwardRef<HTMLDivElement, Props>((props, ref) => {
  return <div ref={ref} {...props} />;
});
```

### `useRef` Null Handling
`useRef<T>(null)` now returns `RefObject<T | null>` instead of `RefObject<T>`:

```typescript
// ✅ React 19 - explicit null in type
const inputRef = useRef<HTMLInputElement | null>(null);

// Component props accepting refs
interface Props {
  inputRef?: React.RefObject<HTMLInputElement | null>;
}
```

### Component Props with Refs
When accepting refs in component props, include `| null` in the type:

```typescript
interface ComposerProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}
```

## State Management

Uses Zustand stores with Chrome storage sync. Always type selectors:

```typescript
import { useChatStore, type ChatState } from '@/stores';
const messages = useChatStore((state: ChatState) => state.messages);
```

**CRITICAL: Selective Subscriptions Required**

Never subscribe to the entire store with `useStore()`. Always use individual selectors:

```typescript
// ❌ BAD - Causes infinite re-render loops
const store = useToolsStore();

// ✅ GOOD - Selective subscriptions for each value
const showModal = useToolsStore((s) => s.showModal);
const setShowModal = useToolsStore((s) => s.setShowModal);
```

Available stores: `useSettingsStore`, `useUINavigationStore`, `useModelStore`, `useChatStore`, `useAttachmentsStore`, `useToolsStore`, `useVoiceModeStore`, `useMcpStore`.

## Development Workflow

```bash
# Install all dependencies
pnpm install

# Start extension development
pnpm dev

# Start docs development  
pnpm dev:docs

# Build extension for production
pnpm build:extension

# Deploy Cloudflare Worker
pnpm deploy:cloudflare
```

### Package-Specific Commands

```bash
# Run command in specific package
pnpm --filter @cognito/extension dev
pnpm --filter @cognito/docs build
```

## Key Commands

- `pnpm dev`: Start extension dev server with hot reload
- `pnpm build`: Build all packages
- `pnpm build:extension`: Build Chrome extension for production
- `pnpm dev:docs`: Start documentation site
- `pnpm deploy:cloudflare`: Deploy ElevenLabs proxy

## Important Notes

- **Monorepo Docs:** See `MONOREPO.md` for architecture details, deployment guides, and migration guides.
- **MCP Implementation:** Check `apps/extension/src/entrypoints/background/` and `apps/extension/src/mcp/` to understand MCP connections.
- **Permissions:** The manifest configuration in `wxt.config.ts` lists Chrome extension permissions.
- **Load Extension:** Load `.output/chrome-mv3` as unpacked extension in Chrome.

## Shared Package (`@cognito/shared`)

The extension uses `@cognito/shared` for shared types and constants with the backend:

```typescript
// Import types
import type { WriteTone, RewritePreset, SummaryType } from '@cognito/shared';

// Import constants
import { TONE_INSTRUCTIONS, PRESET_PROMPTS, SUMMARY_TYPE_INSTRUCTIONS } from '@cognito/shared';
```

This ensures consistency between the extension and backend for AI content features.

## Configuration

The extension supports configuration via Environment Variables. Copy `apps/extension/.env.example` to `apps/extension/.env` to customize.

**CRITICAL**: Always use the centralized `ENV` module instead of directly accessing `import.meta.env` or `process.env`:

```typescript
// ✅ CORRECT - Use centralized ENV module
import { ENV } from '@/utils/env';

const workerUrl = ENV.ELEVENLABS_WORKER_URL;
const backendUrl = ENV.BACKEND_API_URL;

// ❌ WRONG - Never access directly
const workerUrl = import.meta.env.WXT_ELEVENLABS_WORKER_URL;
const backendUrl = process.env.WXT_BACKEND_API_URL;
```

See `src/utils/env.ts` for all available environment variables with defaults.

| Variable | Description | Default |
|----------|-------------|---------|
| `WXT_ELEVENLABS_WORKER_URL` | ElevenLabs Worker URL | Cloudflare Prod |
| `WXT_BACKEND_API_URL` | Backend API Endpoint | Vercel Prod |
| `WXT_METADATA_API_URL` | Metadata API URL | Vercel Prod |

## Backend Integration

The extension supports two modes for AI processing:

| Mode | Description | Requirements |
|------|-------------|-------------|
| **Backend Mode** | Uses hosted Vercel backend | No API key needed |
| **BYOK Mode** | Direct API calls with user's key | Google API Key |

### Backend Module (`src/ai/backend/`)

```text
src/ai/backend/
├── index.ts                   # Module exports
├── backendChat.ts             # Simple backend chat
├── backendChatWithTools.ts    # Chat with frontend tool execution
├── frontendToolExecutor.ts    # Local tool execution  
├── gracefulDegradation.ts     # Auto-fallback to BYOK
├── streamingOptimizations.ts  # Fetch optimizations
└── webmcpIntegration.ts       # WebMCP tool integration
```

### Switching Modes

```typescript
import { useSettingsStore } from '@/stores';

// Toggle backend mode
const setUseBackendMode = useSettingsStore((s) => s.setUseBackendMode);
setUseBackendMode(true);  // Use backend
setUseBackendMode(false); // Use BYOK
```

### Graceful Degradation

When backend rate limits are exceeded, the extension automatically falls back to BYOK mode if the user has an API key configured.

## Mode Architecture

The extension uses 4 distinct "mode" concepts. Don't confuse them:

| Type | Values | Purpose | Store |
|------|--------|---------|-------|
| `AIProviderMode` | `local`/`remote` | WHERE AI runs | `useModelStore.mode` |
| `ToolsMode` | `chat`/`agent`/`adaptive`/`custom` | WHICH TOOLS available | `useToolsStore.currentMode` |
| `ChatMode` | `text`/`voice` | User INPUT METHOD | `useUINavigationStore.chatMode` |
| Backend Mode | `boolean` | HOW remote API is called | `useSettingsStore.useBackendMode` |

### AIProviderMode (local/remote)

```
AIProviderMode = 'local'  → Chrome built-in AI (Gemini Nano)
AIProviderMode = 'remote' → Cloud API, check Backend Mode:
  └─ useBackendMode = true  → Vercel backend (no key)
  └─ useBackendMode = false → BYOK (direct Google AI API)
```

### ToolsMode (chat/agent/adaptive/custom)

- `chat`: Minimal tools (readPageContent, takeScreenshot, etc.)
- `agent`: Full browser automation (navigateTo, clickByText, typeInField, etc.)
- `adaptive`: Meta-tools (`discoverTools`, `executeTools`) for on-demand discovery
- `custom`: User-customized selection

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

## UI Standards

- All clickable buttons must include `cursor-pointer` class for proper UX
- Scrollbars must be modern and minimal; use `mcp-scrollable` class for scrollable containers
- **Never modify primitive UI components** (`src/components/ui/primitives/`) directly; always add props for customization and pass them from consuming components

## CSS Scoping (CRITICAL)

**NEVER write broad CSS selectors** that can match elements across unrelated components:

```css
/* ❌ BAD - Too broad, affects all spans inside any .group element */
.group:hover span {
    max-width: 50px;
}

/* ✅ GOOD - Scoped to specific component */
.my-feature-btn:hover span {
    max-width: 50px;
}
```

- Inline `<style>` blocks are especially dangerous—their selectors apply globally
- Always use unique, specific class names that won't collide with Tailwind utilities (like `group`, `container`)

## DOM Data Extraction Security (CRITICAL)

When reading data from the DOM that will be sent to AI or backend:

- **NEVER capture sensitive input values** (passwords, credit cards, SSN, etc.)
- Always check if an input is sensitive before reading `input.value`:
  - Sensitive types: `password`
  - Sensitive autocomplete: `cc-number`, `cc-exp`, `cc-csc`, `current-password`, `new-password`
  - Sensitive name/id patterns: `/password|card|cvv|csc|ssn|secret|pin/i`

```typescript
// SECURITY: Stripping value from sensitive fields to prevent PII leakage to AI
const value = isSensitiveInput(input) ? undefined : input.value;
```

- **ALWAYS** add `// SECURITY:` comments when stripping sensitive data
- Apply defense-in-depth: check at extraction, formatting, AND transport layers
- See `.kiro/steering/security.md` and `docs/CODING_STANDARDS.md` for full patterns

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
