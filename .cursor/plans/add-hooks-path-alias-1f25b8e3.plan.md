<!-- 1f25b8e3-5a4d-4d32-b403-c756d4f54ef5 7a0b6654-c347-472f-b8ad-51d315aed862 -->
# Add Hooks Path Alias and Migration Plan

## Overview

Add `@hooks` and `@hooks/*` path aliases to `tsconfig.json` following the existing `@components` pattern, then migrate all hook imports from relative paths to the new alias.

## Implementation Steps

### 1. Update tsconfig.json Path Aliases

Add hooks aliases to `tsconfig.json` in the `paths` section (after `@ai/*`):

- `@hooks` → `./src/hooks`
- `@hooks/*` → `./src/hooks/*`

This follows the same pattern as `@components` and `@components/*`.

### 2. Migrate Hook Imports

#### Files to Update (26 import statements found):

**src/sidepanel.tsx** (9 imports):

- `"./hooks/useApiKey"` → `@hooks/useApiKey`
- `"./hooks/useOnboarding"` → `@hooks/useOnboarding`
- `"./hooks/useVoiceRecording"` → `@hooks/useVoiceRecording`
- `"./hooks/useThreadManagement"` → `@hooks/useThreadManagement`
- `"./hooks/useMessageHandlers"` → `@hooks/useMessageHandlers`
- `"./hooks/useAIChatMessages"` → `@hooks/useAIChatMessages`
- `"./hooks/useActiveTabDetection"` → `@hooks/useActiveTabDetection`
- `"./hooks/sidepanel"` → `@hooks/sidepanel`

**src/components/core/CopilotChatWindow.tsx** (1 import):

- `'../../hooks/useActiveTabDetection'` → `@hooks/useActiveTabDetection`

**src/components/features/chat/components/Composer.tsx** (2 imports):

- `'../../../../hooks/useActiveTabDetection'` → `@hooks/useActiveTabDetection`
- `'../../../../hooks/useYouTubeVideoDetection'` → `@hooks/useYouTubeVideoDetection`

**src/components/features/chat/components/SuggestedActions.tsx** (1 import):

- `'../../../../hooks/useSuggestions'` → `@hooks/useSuggestions`

**src/components/features/settings/components/VoiceSettings.tsx** (1 import):

- `'../../../../hooks/useApiKey'` → `@hooks/useApiKey`

**src/components/features/chat/components/ChatInput.tsx** (7 imports):

- `'../../../../hooks/useActiveTabDetection'` → `@hooks/useActiveTabDetection`
- `'../../../../hooks/useFileAttachments'` → `@hooks/useFileAttachments`
- `'../../../../hooks/useLocalPdfAttachment'` → `@hooks/useLocalPdfAttachment`
- `'../../../../hooks/useYouTubeVideoDetection'` → `@hooks/useYouTubeVideoDetection`
- `'../../../../hooks/useYouTubeVideoAttachment'` → `@hooks/useYouTubeVideoAttachment`
- `'../../../../hooks/useWorkflowMode'` → `@hooks/useWorkflowMode`
- `'../../../../hooks/useChatInputValidation'` → `@hooks/useChatInputValidation`

**src/hooks/index.ts** (1 comment example):

- Update example comment: `'./hooks'` → `@hooks`

### 3. Update Documentation

Update `.cursor/rules/coding-standards.mdc` to include hooks alias in the path aliases list:

- Add `@hooks` → `./src/hooks` and `@hooks/*` → `./src/hooks/*` to the documented aliases

## Notes

- Keep `./ai/hooks` imports as-is (they're in a different directory structure)
- Component-specific hooks (e.g., `src/components/features/voice/hooks/useGeminiLiveClient`) remain with relative paths as they're co-located with components
- Only migrate imports from `src/hooks/` directory
- Type imports should use the same alias pattern (e.g., `import type { LocalPdfInfo } from '@hooks/useActiveTabDetection'`)

## Verification

After migration:

1. Run `pnpm type:check` to ensure no TypeScript errors
2. Verify imports resolve correctly in IDE
3. Check that all relative path patterns (`../../`, `../../../`, etc.) for hooks are eliminated

### To-dos

- [ ] Add @hooks and @hooks/* path aliases to tsconfig.json paths section
- [ ] Migrate hook imports in src/sidepanel.tsx from relative paths to @hooks alias
- [ ] Migrate hook imports in all component files (CopilotChatWindow, Composer, SuggestedActions, VoiceSettings, ChatInput) from relative paths to @hooks alias
- [ ] Update example comment in src/hooks/index.ts to use @hooks alias
- [ ] Update .cursor/rules/coding-standards.mdc to document the new @hooks aliases