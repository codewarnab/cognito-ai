---
description: Mode architecture - AIProviderMode, ToolsMode, ChatMode, Backend Mode
---

# Mode Architecture

The extension uses 4 distinct "mode" concepts that can be confusing:

## Mode Types

| Type | Values | Purpose | Store |
|------|--------|---------|-------|
| `AIProviderMode` | `local`/`remote` | Where AI inference runs | `useModelStore.mode` |
| `ToolsMode` | `chat`/`agent`/`adaptive`/`custom` | Which tools available | `useToolsStore.currentMode` |
| `ChatMode` | `text`/`voice` | User input method | `useUINavigationStore.chatMode` |
| Backend Mode | `true`/`false` | Use hosted Vercel API | `useSettingsStore.useBackendMode` |

## AIProviderMode (local/remote)

WHERE the AI inference runs.

- `local`: Chrome's built-in AI (Gemini Nano)
- `remote`: Cloud API (Gemini Pro/Flash)

When `remote`, the **Backend Mode** determines routing:
- `useBackendMode = true`: Vercel backend (no API key)
- `useBackendMode = false`: BYOK - direct Google AI API

## ToolsMode (chat/agent/adaptive/custom)

WHICH TOOLS are available to the AI.

- `chat`: Minimal tools (readPageContent, takeScreenshot, etc.)
- `agent`: Full browser automation (navigateTo, typeInField, clickByText, etc.)
- `adaptive`: Meta-tools only (discoverTools, executeTools) + basics
- `custom`: User-customized selection

**Related files:**
- `@/types/settings.ts` - ToolsMode definition
- `@/stores/tools/types.ts` - ToolMode alias
- `@/components/.../ToolPopover/constants.ts` - tool lists

## ChatMode (text/voice)

User INPUT METHOD.

- `text`: User types messages
- `voice`: ElevenLabs voice mode

## Backend Mode (boolean)

HOW the remote AI API is called.

- `true`: Hosted Vercel backend (rate limited, no key needed)
- `false`: BYOK - direct API calls (requires Google API key)

**Features:**
- Graceful degradation (auto-fallback to BYOK)
- Frontend tools pattern (backend streams, extension executes)

## Type Locations

```typescript
// AIProviderMode / AIMode
import type { AIProviderMode, AIMode } from '@/stores/chat/types';
import type { AIProviderMode, AIMode } from '@/ai/types/types';
import type { AIMode } from '@/components/features/chat/types';

// ToolsMode / ToolMode
import type { ToolsMode } from '@/types/settings';
import type { ToolMode } from '@/stores/tools/types';

// ChatMode
import type { ChatMode } from '@/stores/ui/types';

// Backend Mode
const useBackendMode = useSettingsStore((s) => s.useBackendMode);
```
