---
inclusion: fileMatch
fileMatchPattern: "**/*.{ts,tsx}"
---

# Zustand Store Standards

## Available Stores

Import from `@/stores`:
- `useSettingsStore` - API keys, preferences, feature flags
- `useUINavigationStore` - Panel navigation, overlays, chat mode
- `useModelStore` - AI mode and model selection
- `useChatStore` - Messages, threads, usage tracking
- `useAttachmentsStore` - File, tab, PDF, YouTube attachments
- `useToolsStore` - Tool enabled states and counts
- `useVoiceModeStore` - Voice recording and ElevenLabs state
- `useMcpStore` - MCP server connections and status
- `useCodeModeStore` - Code mode state and bridge status
- `useApprovalStore` - Tool approval preferences and requests

## Selective Subscriptions (CRITICAL - PREVENTS INFINITE LOOPS)

**NEVER subscribe to the entire store.** This causes re-renders on ANY state change, leading to maximum update depth exceeded errors and app crashes.

```typescript
// ❌ BAD - CAUSES INFINITE RE-RENDER LOOPS
const store = useToolsStore();
const { showModal, setShowModal, items } = store;

// ✅ GOOD - Selective subscriptions for each piece of state
const showModal = useToolsStore((s: ToolsState) => s.showModal);
const setShowModal = useToolsStore((s: ToolsState) => s.setShowModal);
const items = useToolsStore((s: ToolsState) => s.items);
const loadItems = useToolsStore((s: ToolsState) => s.loadItems);
```

When creating new stores, ensure consumers use selective subscriptions.

## TypeScript Selector Pattern (CRITICAL)

Always type the `state` parameter in selectors:

```typescript
// ❌ BAD - TypeScript error
const messages = useChatStore((state) => state.messages);

// ✅ GOOD - Typed selector
import { useChatStore, type ChatState } from '@/stores';
const messages = useChatStore((state: ChatState) => state.messages);
```

## Import Pattern

Always import both the store hook AND its state type:

```typescript
import { useSettingsStore, type SettingsState } from '@/stores';
import { useUINavigationStore, type UINavigationState } from '@/stores';
import { useChatStore, type ChatState } from '@/stores';
import { useAttachmentsStore, type AttachmentsState } from '@/stores';
import { useToolsStore, type ToolsState } from '@/stores';
import { useVoiceModeStore, type VoiceModeState } from '@/stores';
import { useMcpStore, type McpState } from '@/stores';
import { useCodeModeStore, type CodeModeState } from '@/stores';
import { useApprovalStore, type ApprovalState } from '@/stores';
```

## Usage Patterns

### Single Value (Recommended)
```typescript
const messages = useChatStore((state: ChatState) => state.messages);
```

### Multiple Values
```typescript
const { messages, setMessages, clearChat } = useChatStore();
```

### Non-Reactive Access (Event Handlers)
```typescript
const handleClear = () => {
  useChatStore.getState().clearChat();
};
```

### Pre-built Selectors
```typescript
import { useChatStore, selectIsLoading, selectMessages } from '@/stores';
const isLoading = useChatStore(selectIsLoading);
```

## Best Practices

- Use selectors for single values (better performance)
- Use `getState()` for non-reactive access in callbacks
- Prefer stores over prop drilling for global state
- See `src/stores/README.md` for detailed documentation
