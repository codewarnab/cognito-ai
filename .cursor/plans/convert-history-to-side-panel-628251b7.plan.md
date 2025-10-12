<!-- 628251b7-11b5-4a33-90b4-14f31145204b b6973b23-d1ec-4485-a4dc-61e8bd1cd36f -->
# Convert History Page to Chrome Side Panel

## Overview

Replace the current tab-based history page (`tabs/history.html`) with a Chrome Side Panel implementation that:

- Opens via extension icon click
- Opens via keyboard shortcut (Ctrl+Shift+H / Cmd+Shift+H)
- Uses the existing history page UI and functionality from `src/pages/history/`

## Implementation Steps

### 1. Add Side Panel Permission to Manifest

Update `package.json` manifest field to include `sidePanel` permission:

```json
"permissions": [
  "storage",
  "offscreen",
  "unlimitedStorage",
  "scripting",
  "alarms",
  "tabs",
  "sidePanel"
]
```

### 2. Create Side Panel Entry Point

Create `src/sidepanel.tsx` (Plasmo convention for side panels):

```tsx
import React from 'react';
import HistoryPage from '~pages/history/index';
import './pages/history/history.css';

export default HistoryPage;
```

### 3. Configure Side Panel Behavior in Background

Update `src/background.ts` to enable side panel on extension icon click:

Add to `chrome.runtime.onInstalled` listener:

```typescript
// Enable side panel to open on action click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch(error => console.error('[Background] Side panel setup error:', error));
```

### 4. Add Keyboard Shortcut

Update `package.json` manifest field to add commands:

```json
"commands": {
  "_execute_side_panel": {
    "suggested_key": {
      "default": "Ctrl+Shift+H",
      "mac": "Command+Shift+H"
    },
    "description": "Open History Search side panel"
  }
}
```

Note: `_execute_side_panel` is a special Chrome command that automatically opens the side panel.

### 5. Update Popup to Open Side Panel

Modify `src/popup.tsx` line 151-165 (the `openHistory` function) to use the Side Panel API:

```typescript
const openHistory = async () => {
  try {
    // Open the side panel
    await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
    setOpenError(false);
  } catch (error) {
    console.error('[Popup] Failed to open side panel:', error);
    setOpenError(true);
  }
}
```

### 6. Remove Old Tab-based Implementation

Delete `src/tabs/history.tsx` as it will be replaced by the side panel.

### 7. Test Implementation

- Build the extension and reload
- Click extension icon to verify side panel opens
- Test keyboard shortcut (Ctrl+Shift+H)
- Verify history search functionality works in side panel
- Test that side panel persists across tab navigation

## Files Modified

- `package.json` - Add `sidePanel` permission and keyboard command
- `src/background.ts` - Configure side panel behavior
- `src/sidepanel.tsx` - Create new side panel entry point
- `src/popup.tsx` - Update history button to open side panel

## Files Deleted

- `src/tabs/history.tsx` - Replaced by side panel

### To-dos

- [ ] Add sidePanel permission to package.json manifest field
- [ ] Create src/sidepanel.tsx entry point using existing history page component
- [ ] Update src/background.ts to enable side panel on icon click
- [ ] Add _execute_side_panel command to package.json manifest
- [ ] Modify openHistory function in src/popup.tsx to use Side Panel API
- [ ] Delete src/tabs/history.tsx file