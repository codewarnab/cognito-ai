<!-- d1f961df-0352-453a-8e8b-854fd42d3085 d2608b78-98ef-44ab-9aab-cb7585fbc345 -->
# Convert Popup to Side Panel with Chat UI

## Overview

Transform the popup into a Chrome side panel with a comprehensive chat interface featuring message history, persistence via IndexedDB, and enhanced chat features.

## Implementation Steps

### 1. Update Manifest Configuration

**File: `package.json`**

- Add `sidePanel` permission to manifest.permissions array
- Add side_panel configuration pointing to a new sidepanel.html

### 2. Extend Database Schema for Chat Messages

**File: `src/db/index.ts`**

- Add `ChatMessage` interface with fields: id, role (user/assistant), content, timestamp, metadata
- Add `chatMessages` table to AppDB class in version 5 schema migration
- Create helper functions: `saveChatMessage()`, `loadChatHistory()`, `clearChatHistory()`

### 3. Create Side Panel Component

**File: `src/sidepanel.tsx` (new)**

- Create main SidePanel component with:
- Header with app title and history link button at top
- Chat messages container with scrollable message list
- Message input form at bottom (sticky)
- Loading states and error handling
- Initialize Chrome Prompt API session on mount
- Load persisted chat history from IndexedDB on mount
- Implement message sending with streaming support
- Save each message (user + AI response) to IndexedDB
- Handle history link click to open history search in side panel or new tab

### 4. Create Chat Message Components

**File: `src/components/ChatMessage.tsx` (new)**

- Create `ChatMessage` component for individual messages with:
- User/assistant role differentiation (different styling)
- Message content with proper text formatting
- Timestamp display
- Action buttons (copy, regenerate for assistant messages)
- Create `MessageList` component for displaying all messages with auto-scroll to bottom

### 5. Create Side Panel Styles

**File: `src/sidepanel.css` (new)**

- Design modern chat UI with:
- Full height layout (header, scrollable messages, input footer)
- Distinct user/assistant message bubbles
- Smooth animations and transitions
- Responsive design
- Dark/light theme support matching branding guide
- Use CSS variables for theming

### 6. Implement Chat Features

**In `src/sidepanel.tsx`:**

- **Copy Message**: Copy assistant response to clipboard
- **Regenerate**: Resend last user message to get new response
- **Clear Chat**: Delete all messages from UI and IndexedDB
- **Auto-scroll**: Scroll to bottom when new messages arrive
- **Streaming indicator**: Show typing animation during streaming

### 7. Update Background Script

**File: `src/background.ts`**

- Add listener to enable side panel when extension icon is clicked
- Configure side panel to be available globally or per-tab

### 8. Remove/Update Popup References

- Keep `src/popup.tsx` for now (can be removed later if not needed)
- Ensure action default_popup is removed from manifest or kept as fallback

### 9. Integration Points

- Ensure history link at top opens `tabs/history.html` in the same side panel or new tab
- Maintain existing Chrome Prompt API integration from popup
- Reuse existing status checking logic for model availability

## Key Files to Modify

- `package.json` - Add sidePanel permission and configuration
- `src/db/index.ts` - Add chat messages table and CRUD functions
- `src/sidepanel.tsx` - New main side panel component
- `src/components/ChatMessage.tsx` - New message component
- `src/sidepanel.css` - New styles for chat UI
- `src/background.ts` - Side panel activation logic

## Design Considerations

- Use brand colors from branding guide (Green Pulse #C6FE1E, Blue Stride #1264FF)
- Ensure WCAG AA accessibility
- Support both light and dark modes
- Mobile-friendly responsive design
- Smooth transitions and animations

### To-dos

- [ ] Add sidePanel permission and configuration to package.json manifest
- [ ] Add ChatMessage table and helper functions to database schema
- [ ] Create ChatMessage and MessageList components with copy/regenerate features
- [ ] Build main SidePanel component with chat UI, message persistence, and history link
- [ ] Design and implement side panel CSS with chat UI styling
- [ ] Configure background script to activate side panel on icon click