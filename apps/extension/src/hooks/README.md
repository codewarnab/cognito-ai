# Hooks Directory

This directory contains all custom React hooks used in the Cognito AI Browser Agent extension. Hooks are organized by domain/functionality for better discoverability and maintainability.

## Directory Structure

```
src/hooks/
├── index.ts                 # Main barrel export
├── README.md                # This file
│
├── attachments/             # File and media attachment handling
│   └── index.ts
│
├── browser/                 # Chrome browser/tab interactions
│   └── index.ts
│
├── chat/                    # Chat and messaging functionality
│   └── index.ts
│
├── settings/                # Settings and configuration
│   └── index.ts
│
├── sidepanel/               # Sidepanel-specific hooks
│   └── index.ts
│
├── suggestions/             # AI-powered suggestions
│   └── index.ts
│
├── ui/                      # Generic UI state hooks
│   └── index.ts
│
└── workflows/               # Workflow-related hooks
    └── index.ts
```

## Hook Categories

### Attachments (`attachments/`)
Hooks for handling file and media attachments:
- `useFileAttachments` - File upload, paste, and drag-drop handling
- `useLocalPdfAttachment` - Local PDF attachment handling
- `useYouTubeVideoAttachment` - YouTube transcript attachment

### Browser (`browser/`)
Hooks for Chrome browser and tab interactions:
- `useActiveTabDetection` - Detects local PDF files in active tab
- `useTabContext` - Chrome tab context tracking
- `useYouTubeVideoDetection` - YouTube video page detection

### Chat (`chat/`)
Hooks for chat and messaging functionality:
- `useAIChatMessages` - AI message persistence and title generation
- `useChatInputValidation` - Input validation before sending
- `useMessageHandlers` - Message sending with attachments/context
- `useThreadManagement` - Thread lifecycle and persistence

### Settings (`settings/`)
Hooks for settings and configuration:
- `useApiKey` - Manages Gemini API key from storage
- `useOnboarding` - Onboarding state and persistence

### Sidepanel (`sidepanel/`)
Sidepanel-specific hooks:
- `useSidepanelUiState` - UI state toggles and mode management
- `useBackgroundMessageListener` - Omnibox/notification message handling
- `useImagePreviewListener` - Image preview state changes
- `useNotificationSound` - Notification sound initialization
- `useOnboardingTestHandles` - Test function exposure

### Suggestions (`suggestions/`)
AI-powered suggestion hooks:
- `useSuggestions` - Contextual AI-generated suggestions

### UI (`ui/`)
Generic UI state hooks:
- `useWindowVisibility` - Window visibility context consumer
- `useVoiceRecording` - Voice recording state and animations

### Workflows (`workflows/`)
Workflow-related hooks:
- `useWorkflowMode` - Slash command workflow selection

## Usage

### Importing Hooks

All hooks are available via the main barrel export:

```typescript
import { useApiKey, useTabContext, useThreadManagement } from '@/hooks';
```

Or import from specific domains for clarity:

```typescript
import { useTabContext } from '@/hooks/browser';
import { useThreadManagement } from '@/hooks/chat';
import { useApiKey } from '@/hooks/settings';
```

### Creating New Hooks

1. Determine the appropriate domain folder for your hook
2. Create the hook file in that folder (e.g., `useMyHook.ts`)
3. Export from the folder's `index.ts`
4. The root `index.ts` will automatically re-export it

### Hook Naming Convention

- All hooks must start with `use` prefix
- Use descriptive names that indicate purpose
- Follow pattern: `use[Domain][Action]` (e.g., `useTabContext`, `useAIChatMessages`)

## Best Practices

1. **Cleanup**: Always clean up event listeners, subscriptions, and timers in `useEffect` cleanup
2. **Dependencies**: Include all used variables in `useEffect` dependency arrays
3. **Refs**: Use refs for values that must stay current across event handler closures
4. **Error Handling**: Wrap async operations in try-catch with context logging
5. **Logging**: Use `createLogger` for consistent logging

```typescript
import { createLogger } from '~logger';

const log = createLogger('useMyHook');

export function useMyHook() {
  useEffect(() => {
    log.debug('Hook initialized');
    
    return () => {
      log.debug('Hook cleanup');
    };
  }, []);
}
```

## Migration Status

This directory has been fully reorganized. See `plans/HOOKS_REORGANIZATION_PLAN.md` for details.

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ Complete | Create directory structure |
| Phase 2 | ✅ Complete | Migrate browser hooks |
| Phase 3 | ✅ Complete | Migrate attachment hooks |
| Phase 4 | ✅ Complete | Migrate chat hooks |
| Phase 5 | ✅ Complete | Migrate settings hooks |
| Phase 6 | ✅ Complete | Migrate remaining hooks |
| Phase 7 | ✅ Complete | Final cleanup & documentation |
