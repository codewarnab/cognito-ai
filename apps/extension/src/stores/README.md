# Zustand Stores

Centralized state management using Zustand stores with Chrome storage synchronization.

## Architecture

```
stores/
├── index.ts                    # Re-export all stores and types
├── README.md                   # This file
├── middleware/
│   ├── chromeStorageSync.ts    # Chrome storage sync middleware
│   └── logger.ts               # Debug logging middleware
├── settings/
│   ├── settingsStore.ts        # App settings with Chrome storage sync
│   └── types.ts
├── ui/
│   ├── navigationStore.ts      # Panel/view visibility toggles
│   └── types.ts
├── chat/
│   ├── chatStore.ts            # Messages, threads, usage tracking
│   ├── modelStore.ts           # AI model configuration
│   └── types.ts
├── attachments/
│   ├── attachmentsStore.ts     # File/tab/PDF/YouTube attachments
│   └── types.ts
├── tools/
│   ├── toolsStore.ts           # Tool configuration and counts
│   └── types.ts
├── voice/
│   ├── voiceModeStore.ts       # Voice recording and ElevenLabs state
│   └── types.ts
└── mcp/
    ├── mcpStore.ts             # MCP server connections
    └── types.ts
```

## Available Stores

| Store | Purpose | Uses Immer |
|-------|---------|------------|
| `useSettingsStore` | API keys, preferences, feature flags | No |
| `useUINavigationStore` | Panel navigation, overlays, chat mode | No |
| `useModelStore` | AI mode and model selection | No |
| `useChatStore` | Messages, threads, usage tracking | Yes |
| `useAttachmentsStore` | File, tab, PDF, YouTube attachments | Yes |
| `useToolsStore` | Tool enabled states, counts, modal | Yes |
| `useVoiceModeStore` | Recording state, ElevenLabs connection | No |
| `useMcpStore` | MCP server status, custom servers | Yes |

## TypeScript Selector Pattern (CRITICAL)

**Always type the `state` parameter in selectors to avoid TypeScript errors:**

```typescript
// ❌ BAD - Will cause "Parameter 'state' implicitly has an 'any' type" error
const messages = useChatStore((state) => state.messages);

// ✅ GOOD - Explicitly typed selector
import { useChatStore, type ChatState } from '@/stores';
const messages = useChatStore((state: ChatState) => state.messages);
```

**Always import both the store hook AND its state type:**

```typescript
// Settings store
import { useSettingsStore, type SettingsState } from '@/stores';
const apiKey = useSettingsStore((state: SettingsState) => state.googleApiKey);

// UI Navigation store
import { useUINavigationStore, type UINavigationState } from '@/stores';
const activePanel = useUINavigationStore((state: UINavigationState) => state.activePanel);

// Chat store
import { useChatStore, type ChatState } from '@/stores';
const messages = useChatStore((state: ChatState) => state.messages);

// Attachments store
import { useAttachmentsStore, type AttachmentsState } from '@/stores';
const files = useAttachmentsStore((state: AttachmentsState) => state.fileAttachments);
```

**For multiple selectors, consider destructuring:**

```typescript
// When you need multiple values, destructure from the store
const { activePanel, navigateTo, setChatMode } = useUINavigationStore();
```

## Usage Examples

### Basic Usage

```typescript
import { useSettingsStore, type SettingsState } from '@/stores';

function MyComponent() {
  // With typed selector (recommended for single values)
  const apiKey = useSettingsStore((state: SettingsState) => state.googleApiKey);
  
  // Or destructure for multiple values
  const { setApiKey, preferredMode } = useSettingsStore();
  
  return <div>{apiKey ? 'Configured' : 'Not configured'}</div>;
}
```

### Navigation

```typescript
import { useUINavigationStore, type UINavigationState } from '@/stores';

function NavButton() {
  const navigateTo = useUINavigationStore((state: UINavigationState) => state.navigateTo);
  
  return <button onClick={() => navigateTo('settings')}>Settings</button>;
}
```

### Non-Reactive Access (Event Handlers)

```typescript
// Use getState() when you don't need reactivity
const handleClick = () => {
  const { setVoiceFabVisibility } = useUINavigationStore.getState();
  setVoiceFabVisibility(false);
};
```

### Pre-built Selectors

Some stores export pre-built selectors for common use cases:

```typescript
import { 
  useChatStore, 
  selectIsLoading, 
  selectMessages, 
  selectStatus 
} from '@/stores';

function ChatStatus() {
  const isLoading = useChatStore(selectIsLoading);
  const status = useChatStore(selectStatus);
  return <div>{isLoading ? 'Loading...' : status}</div>;
}
```

## Middleware

### Chrome Storage Sync

Automatically syncs store state with `chrome.storage`:

```typescript
import { chromeStorageSync } from '@/stores/middleware/chromeStorageSync';

const useMyStore = create<MyState>()(
  chromeStorageSync({
    storageKey: 'my_store_key',
    storageArea: 'local', // or 'sync'
    persistFields: ['field1', 'field2'], // optional
    debounceMs: 200, // optional, defaults to 100
  })((set, get) => ({
    // store implementation
  }))
);
```

### Logger (Development)

```typescript
import { storeLogger } from '@/stores/middleware/logger';

const useMyStore = create<MyState>()(
  storeLogger('MyStore')((set, get) => ({
    // store implementation
  }))
);
```

## Immer Usage

Stores with complex nested state use Immer for cleaner updates:

```typescript
import { immer } from 'zustand/middleware/immer';

// WITHOUT Immer - verbose
set((state) => ({
  ...state,
  messages: state.messages.map(m =>
    m.id === id ? { ...m, ...updates } : m
  ),
}));

// WITH Immer - clean
set((state) => {
  const msg = state.messages.find(m => m.id === id);
  if (msg) Object.assign(msg, updates);
});
```

## Best Practices

1. **Use typed selectors** - Always type the state parameter
2. **Import types** - Always import the state type alongside the hook
3. **Use selectors for single values** - Better performance, only re-renders when that value changes
4. **Use `getState()` for non-reactive access** - Event handlers, callbacks
5. **Keep stores focused** - Each store manages a specific domain
6. **Use pre-built selectors** - When available, use exported selectors

## Migration Notes

These stores replaced several hooks and contexts:
- `useSidepanelUiState` → `useUINavigationStore`
- `useThreadManagement` → `useChatStore`
- `useVoiceRecording` → `useVoiceModeStore`
- `useToolsCount` → `useToolsStore`
- `DocumentContext` → Removed (was empty placeholder)

See `docs/STORE_IMPLEMENTATION_PLAN.md` for the full migration history.
