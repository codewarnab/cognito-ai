<!-- 90c91eb5-9149-4ddb-b114-6ea51817902c de624a1d-f85c-4959-8a3c-15e44fb667d5 -->
# Hide Local Mode Configuration

## Overview

Add a `HIDE_LOCAL_MODE` constant to `constants.ts` that when enabled:

- Hides the mode selector UI in chat input
- Forces remote/cloud mode
- Shows a toast notification when user tries to send a message without an API key

## Implementation Steps

### 1. Add Configuration Constant

**File: `src/constants.ts`**

- Add new constant `HIDE_LOCAL_MODE: false` after the `LOG_CONFIG` section
- Add JSDoc comment explaining its purpose

### 2. Conditionally Hide Mode Selector

**File: `src/components/features/chat/components/ChatInput.tsx`**

- Import `HIDE_LOCAL_MODE` from constants
- Wrap the `<ModeSelector>` component (lines 539-545) with conditional rendering
- Only render if `!HIDE_LOCAL_MODE`

### 3. Force Remote Mode When Hidden

**File: `src/utils/modelSettings.ts`**

- Import `HIDE_LOCAL_MODE` from constants
- Modify `getModelConfig()` function to return `mode: 'remote'` when `HIDE_LOCAL_MODE` is true (override the stored/default mode)

### 4. Add API Key Validation Before Sending

**File: `src/hooks/useMessageHandlers.ts`**

- Import `HIDE_LOCAL_MODE` from constants
- Import `hasGeminiApiKey` from `../utils/geminiApiKey`
- In `handleSendMessage()`, before processing the message (around line 43):
- Check if `HIDE_LOCAL_MODE` is true
- If true, validate that user has API key using `hasGeminiApiKey()`
- If no API key, show error toast via callback and return early
- Toast message: "API Key Required. Please add your Gemini API key in Settings to use the AI assistant."

### 5. Handle Edge Case - Mode Initialization

**File: `src/sidepanel.tsx` or model state initialization**

- Ensure that when the app loads with `HIDE_LOCAL_MODE: true`, the initial mode is set to 'remote'
- This should automatically work through the modified `getModelConfig()` function

## Edge Cases Covered

### Mode & Storage

1. ✅ User has local mode saved in preferences → `getModelConfig()` overrides to 'remote' when `HIDE_LOCAL_MODE` is true
2. ✅ Existing conversations started in local mode → Will be forced to remote (conversationStartMode remains 'local' but current mode becomes 'remote', which is allowed)
3. ✅ New conversation initialization → Always starts in 'remote' mode when hidden

### UI Components

4. ✅ Mode selector completely hidden → No way to accidentally switch to local mode
5. ✅ SlashCommandDropdown → Shows "Workflows not available in Local mode" message only when mode === 'local', won't show when forced to remote
6. ✅ Word count limits → ChatInput checks word limits only for local mode (lines 298-326), won't trigger in forced remote mode

### Tool & Feature Access

7. ✅ Tool filtering → `getToolsForMode()` correctly returns all tools for remote mode
8. ✅ Workflow access → Always available since mode is forced to remote
9. ✅ MCP tools → Available in remote mode (not affected)

### Validation & Errors

10. ✅ User tries to send message without API key → Toast notification shown via `useMessageHandlers`
11. ✅ canSwitchMode validation → Still works correctly; mode selector hidden so users can't trigger switches anyway
12. ✅ Voice mode → Uses apiKey directly, unaffected by mode changes

### Onboarding & Initial Setup

13. ✅ Onboarding flow → No mode selection in onboarding, starts with default from `getModelConfig()` which returns 'remote'
14. ✅ First app launch → Mode defaults to 'remote' through `getModelConfig()`