# Cognito Extension - Claude Guide

This document helps Claude understand the Chrome extension codebase.

## Overview

**Cognito** is a privacy-first, AI-powered Chrome extension built with [WXT](https://wxt.dev/) and **React 19**. It provides an AI side panel interface for interacting with web pages, automating browser tasks, and managing local memory.

## Key Features

- **AI Side Panel**: Chat interface accessible via `Ctrl+Shift+H`
- **Model Context Protocol (MCP)**: Connects to external MCP servers for extended capabilities (see `docs/MCP_STDIO_ARCHITECTURE.md` for stdio, `docs/REMOTE_MCP_INTEGRATION.md` for SSE/HTTP)
- **Privacy-First Memory**: Local storage with Dexie (IndexedDB)
- **Voice Mode**: ElevenLabs integration for conversational AI
- **Browser Automation**: Smart Actions and workflows
- **YouTube Integration**: Video transcript extraction
- **Backend Mode**: Server-side AI processing (no API key required)

## Webapp (`apps/webapp/`)

Several UI pages have been moved from the extension to a separate Next.js webapp:
- **Settings**: User preferences and configuration
- **Onboarding**: First-time user setup flow
- **Reminders**: Reminder management UI
- **Features**: Feature showcase pages
- **Troubleshooting**: Help and debugging tools
- **Changelog**: Version history and updates

The extension opens these pages in new tabs via `chrome.tabs.create()`. See `apps/webapp/` for the webapp codebase.

## Architecture

```text
apps/extension/
├── src/
│   ├── entrypoints/        # WXT entrypoints
│   │   ├── sidepanel/      # Main side panel React app
│   │   └── background.ts   # Background Service Worker entry
│   ├── background/         # Background service worker logic
│   ├── contents/           # Content scripts
│   ├── stores/             # Zustand state management (see below)
│   ├── actions/            # Browser automation actions
│   ├── ai/                 # AI model integration & prompts
│   │   ├── core/           # Core AI logic (modelSetup, aiLogic)
│   │   ├── prompts/        # System and tool prompts
│   │   ├── backend/        # Backend integration (chat, tools, fallback)
│   │   └── errors/         # Error handlers
│   ├── components/         # React UI components
│   │   ├── features/       # Feature-specific components
│   │   ├── shell/          # App shell components
│   │   └── ui/             # Reusable UI primitives
│   ├── mcp/                # MCP client implementation
│   ├── db/                 # Dexie database (local storage)
│   ├── search/             # Web search implementation
│   ├── services/           # Service layer integrations
│   ├── workflows/          # Automation workflows
│   ├── hooks/              # React hooks
│   ├── utils/              # Utilities
│   └── types/              # TypeScript types
├── docs/                   # Technical documentation
├── assets/                 # Icons, images
├── public/                 # Static files (offscreen.js, etc.)
└── wxt.config.ts           # WXT configuration
```

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

**CRITICAL**: Always guard URLs before using them in `fetch()` or other network calls. Environment variables may be undefined:

```typescript
// ✅ CORRECT - Guard before using
if (!ENV.TRANSCRIPT_API_URL) {
    return createErrorEntry(videoUrl, "Transcript API URL is not configured");
}
const res = await fetch(ENV.TRANSCRIPT_API_URL, { ... });

// ❌ WRONG - fetch() will fail if URL is undefined
const res = await fetch(ENV.TRANSCRIPT_API_URL, { ... }); // TypeScript error: string | undefined
```

See `src/utils/env.ts` for all available environment variables with defaults.

```env
# apps/extension/.env
WXT_ELEVENLABS_WORKER_URL=https://your-worker.workers.dev
```

## Key Files

| File | Purpose |
|------|---------|
| `src/entrypoints/sidepanel/` | Main React entry point |
| `src/entrypoints/background/` | Service worker, MCP, message handling |
| `wxt.config.ts` | WXT and manifest config (permissions, commands) |
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

### Available Aliases

| Alias | Maps To |
|-------|---------|
| `~*` | `src/*` |
| `@/*` | `src/*` |
| `@assets/*` | `assets/*` |
| `~logger` | `src/logger` |

## Coding Standards

### React 19 Patterns

This extension uses **React 19** with the following key patterns:

#### `ref` as a Prop
In React 19, `ref` is passed as a regular prop:

```typescript
// ✅ React 19 - ref as prop
interface Props {
  ref?: React.RefObject<HTMLDivElement | null>;
}

function MyComponent({ ref, ...props }: Props) {
  return <div ref={ref} {...props} />;
}
```

#### `useRef` Null Handling
`useRef<T>(null)` returns `RefObject<T | null>`:

```typescript
// ✅ React 19 - explicit null in type
const inputRef = useRef<HTMLInputElement | null>(null);

// Component props accepting refs
interface Props {
  inputRef?: React.RefObject<HTMLInputElement | null>;
}
```

### React Components

- Use functional components with hooks
- Prefer named exports for components
- Use TypeScript interfaces for props (include `| null` for ref types)
- Keep components focused and single-purpose

```typescript
// ✅ Good
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function Button({ label, onClick, disabled = false }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}
```

### Error Handling

- Always wrap async operations in try-catch
- Use the logger for consistent error reporting
- Provide meaningful error messages to users

```typescript
import { createLogger } from '~logger';

// Always include category as second argument (see Logger Categories below)
const logger = createLogger('MyComponent', 'UI_CHAT');

try {
  await someAsyncOperation();
} catch (error) {
  logger.error('Operation failed:', error);
  // Handle error appropriately
}
```

### State Management (Zustand Stores)

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

## Testing the Extension

1. Build: `pnpm build:extension`
2. Load `dist` as unpacked extension in Chrome
3. Open side panel with `Ctrl+Shift+H`

## External Dependencies

The extension relies on backend services:
- **ElevenLabs Proxy**: `packages/backend-cloudflare/` for voice mode
- **AI Chat Backend**: `packages/backend-vercel/` for AI chat when in backend mode
- **YouTube API**: `packages/backend-vercel/` for video transcripts

### Backend Integration

The extension supports two modes for AI processing:

| Mode | Description | Requirements |
|------|-------------|-------------|
| **Backend Mode** | Uses hosted Vercel backend | No API key needed |
| **BYOK Mode** | Direct API calls with user's key | Google API Key |

> **Note**: BYOK Mode is model-agnostic (supports any model). Backend Mode uses fixed `gemini-2.5-flash`.

Toggle modes via `useSettingsStore.setUseBackendMode()`.

**Backend Module** (`src/ai/backend/`):
- `backendChat.ts` - Simple backend chat (no tools)
- `backendChatWithTools.ts` - Full tool execution loop
- `frontendToolExecutor.ts` - Execute tools locally from backend requests
- `gracefulDegradation.ts` - Auto-fallback to BYOK when rate limited
- `streamingOptimizations.ts` - Fetch optimizations for streaming
- `webmcpIntegration.ts` - WebMCP tool integration

See those packages' `CLAUDE.md` files for their documentation.

## Data Stream Protocol

When using `writer.write()` for streaming responses, always use the complete message lifecycle:

**CRITICAL**: Text content must be framed with `text-start` and `text-end` types:

```typescript
// ✅ CORRECT - Complete text lifecycle
writer.write({ type: 'text-start' });
writer.write({ type: 'text-delta', textDelta: 'Your response text...' });
writer.write({ type: 'text-end' });

// ❌ WRONG - Missing start/end causes stream errors
writer.write({ type: 'text-delta', textDelta: 'Your response text...' });
```

The same pattern applies to other chunk types (e.g., `reasoning-start`, `reasoning-delta`, `reasoning-end`).

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

## Important Documentation

| File | Purpose |
|------|---------|
| `docs/CODING_STANDARDS.md` | Detailed coding standards |
| `docs/TECHNICAL_DOCUMENTATION.md` | Technical architecture |
| `docs/MCP_STDIO_ARCHITECTURE.md` | MCP stdio transport |
| `docs/REMOTE_MCP_INTEGRATION.md` | MCP SSE/HTTP transport |
| `docs/WEBMCP_INTEGRATION.md` | WebMCP integration details |

## Git Commits

```bash
git commit -m "feat(extension): add new browser tool"
git commit -m "fix(extension): resolve MCP connection issue"
git commit -m "refactor(extension): improve component structure"
```
