# CopilotKit Integration for Chrome AI Extension

This document explains the CopilotKit integration with custom UI for the Chrome AI extension side panel.

## Overview

The extension now supports **CopilotKit with a custom UI** that connects to an external Gemini runtime. This implementation uses:

- **Custom UI components** (not the default CopilotKit UI)
- **External Gemini runtime** (keys remain server-side)
- **Chrome extension actions** (tab management, text selection, etc.)
- **Frontend-only integration** (no backend in this repo)

## Architecture

### Files Created/Modified

1. **`src/constants.ts`** - Added `COPILOT_RUNTIME_URL` constant
2. **`src/sidepanel-copilotkit.tsx`** - New CopilotKit-powered side panel
3. **`src/components/CopilotChatWindow.tsx`** - Custom chat UI component
4. **`src/styles/copilot.css`** - Custom styling for chat interface

### Key Features

- ✅ Custom chat UI (no default CopilotKit UI components)
- ✅ Connects to external Gemini runtime
- ✅ Chrome extension actions (tabs, selection, history)
- ✅ Dark mode support
- ✅ Streaming responses
- ✅ Message filtering and validation
- ✅ Auto-scroll to latest message
- ✅ Configuration validation

## Setup Instructions

### 1. Deploy Your CopilotKit Runtime

First, you need a CopilotKit runtime with Gemini. You can:

- Deploy using the [CopilotKit documentation](https://docs.copilotkit.ai/)
- Use a hosted CopilotKit Cloud instance
- Deploy your own runtime with Gemini API integration

### 2. Configure the Runtime URL

Edit `src/constants.ts`:

```typescript
export const COPILOT_RUNTIME_URL = "https://your-runtime.example.com/api/copilotkit";
```

Replace `https://your-runtime.example.com/api/copilotkit` with your actual runtime endpoint.

### 3. Update Manifest CSP (if needed)

If your runtime is on a different domain, ensure the manifest allows connections:

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; connect-src https://your-runtime.example.com"
  }
}
```

### 4. Use the CopilotKit Side Panel

To use the new CopilotKit-powered side panel, you have two options:

#### Option A: Replace the existing sidepanel (Recommended for testing)

Rename the files:
```bash
# Backup original
mv src/sidepanel.tsx src/sidepanel-chrome-ai.tsx

# Use CopilotKit version
mv src/sidepanel-copilotkit.tsx src/sidepanel.tsx
```

#### Option B: Keep both versions

Keep both implementations and switch between them as needed for testing.

### 5. Build and Test

```bash
pnpm run build
```

Load the unpacked extension and test the side panel.

## Custom Actions Available

The CopilotKit integration includes several custom actions that the AI can use:

### 1. `getActiveTab`
Get information about the currently active browser tab.

```typescript
// AI can invoke: "What tab am I on?"
// Returns: { title, url, id }
```

### 2. `searchTabs`
Search through all open browser tabs.

```typescript
// AI can invoke: "Find tabs related to GitHub"
// Parameters: query (string)
// Returns: { found, tabs: [{ id, title, url }] }
```

### 3. `openTab`
Open a new browser tab with a specified URL.

```typescript
// AI can invoke: "Open google.com"
// Parameters: url (string)
// Returns: { success, tabId, url }
```

### 4. `getSelectedText`
Get currently selected text from the active tab.

```typescript
// AI can invoke: "What text is selected?"
// Returns: { success, selectedText, length }
```

## How It Works

### 1. Provider Setup

The `SidePanel` component wraps everything in a `CopilotKit` provider:

```tsx
<CopilotKit runtimeUrl={COPILOT_RUNTIME_URL} agent="chrome-ai-assistant">
  <CopilotChatContent />
</CopilotKit>
```

### 2. Custom UI with Hooks

The `CopilotChatContent` uses CopilotKit hooks:

```tsx
const { visibleMessages, isLoading, appendMessage } = useCopilotChat();
```

### 3. Context Sharing

Uses `useCopilotReadable` to share extension context:

```tsx
useCopilotReadable({
  description: "Chrome extension context and capabilities",
  value: {
    extensionName: "Chrome AI Assistant",
    capabilities: ["Tab management", "Browsing history", ...]
  }
});
```

### 4. Custom Actions

Uses `useCopilotAction` to register actions:

```tsx
useCopilotAction({
  name: "getActiveTab",
  description: "Get information about the currently active browser tab",
  handler: async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return { title: tab.title, url: tab.url };
  }
});
```

## Styling

The custom UI uses CSS custom properties for theming:

```css
--bg-primary: #ffffff
--bg-secondary: #f9fafb
--text-primary: #1a1a1a
--border-color: #e5e7eb
--primary-color: #3b82f6
```

Dark mode is automatically supported via `prefers-color-scheme`.

## Differences from the Guide

The implementation adapts the Next.js guide for Chrome extensions:

| Next.js Guide | Chrome Extension |
|---------------|------------------|
| `useRouter()`, `usePathname()` | Chrome tabs API |
| Server-side API routes | External runtime URL |
| Next.js page context | Chrome extension context |
| React Router navigation | `chrome.tabs.create()` |
| `<Button />`, `<Input />` components | Native HTML elements |
| Tailwind utility classes | Custom CSS with variables |

## Security Considerations

1. **Keys on Server**: API keys remain on your external runtime, never in the extension
2. **CORS**: Configure your runtime to accept requests from your extension
3. **CSP**: Ensure Content Security Policy allows your runtime domain
4. **Permissions**: Only request necessary Chrome permissions

## Testing Checklist

- [ ] Configure `COPILOT_RUNTIME_URL` in `src/constants.ts`
- [ ] Build extension: `pnpm run build`
- [ ] Load unpacked extension in Chrome
- [ ] Open side panel (Ctrl+Shift+H)
- [ ] Send a test message
- [ ] Test custom actions:
  - [ ] "What tab am I on?"
  - [ ] "Find tabs about GitHub"
  - [ ] "Open google.com"
  - [ ] "What text is selected?" (select text first)
- [ ] Verify dark mode works
- [ ] Check message streaming
- [ ] Test configuration prompt (with unconfigured URL)

## Troubleshooting

### Configuration Prompt Appears

If you see the configuration prompt, it means `COPILOT_RUNTIME_URL` is still set to the default value. Update it in `src/constants.ts`.

### CORS Errors

Your runtime needs to allow requests from your extension. Add CORS headers:

```typescript
Access-Control-Allow-Origin: chrome-extension://YOUR_EXTENSION_ID
```

### Actions Not Working

Check browser console for errors. Actions require appropriate Chrome permissions:

- `tabs` permission for tab operations
- `activeTab` for current tab access
- `scripting` for content script injection (getSelectedText)

### Messages Not Appearing

- Verify runtime URL is correct
- Check network tab for failed requests
- Ensure runtime is returning proper response format

## Next Steps

1. **Add More Actions**: Extend with bookmarks, history, etc.
2. **Improve UI**: Add avatars, timestamps, formatting
3. **Error Handling**: Better error messages and recovery
4. **Persistence**: Save chat history to extension storage
5. **Settings UI**: Let users configure runtime URL via options page

## Resources

- [CopilotKit Documentation](https://docs.copilotkit.ai/)
- [Chrome Extension APIs](https://developer.chrome.com/docs/extensions/reference/)
- [Chrome AI Hackathon 2025](./docs/chrome_ai_hackathon_2025.md)

---

**Implementation Date**: January 2025
**Status**: Ready for testing
