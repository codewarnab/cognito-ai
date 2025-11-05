# ⚙️ Settings UI for Notification Controls - Implementation Plan

## Overview
Add a "Notification Settings" menu item to the ChatHeader dropdown (`#file:ChatHeader.tsx`) that allows users to configure:
1. **Sound Notifications** - Enable/disable notification sound when AI completes
2. **Chrome Notifications** - Enable/disable Chrome native notifications with "Continue Iterating" action

**Reference:** Existing dropdown menu in `ChatHeader.tsx` (lines 100-136)

---

## 📋 Multi-Phase Implementation Plan

### **Phase 1: Settings Data Structure** 💾
**Goal:** Define settings storage and default values

#### Tasks:
1. **Create Settings Types** (`src/types/settings.ts`)
   - Define TypeScript interface for notification settings
   - Include sound enable/disable flag
   - Include Chrome notification enable/disable flag
   - Include volume control (future enhancement)
   - Version number for migration support

2. **Create Settings Storage Utility** (`src/utils/settingsStorage.ts`)
   - Functions to get settings from `chrome.storage.local`
   - Functions to save settings to `chrome.storage.local`
   - Functions to reset settings to defaults
   - Default settings values
   - Storage key: `userSettings.notifications`

3. **Default Settings**
   ```typescript
   const DEFAULT_SETTINGS = {
       notifications: {
           soundEnabled: true,
           chromeNotificationEnabled: true,
           volume: 0.7, // Future: volume control
       },
       version: 1
   };
   ```

#### Deliverables:
- ✅ `src/types/settings.ts` with TypeScript types
- ✅ `src/utils/settingsStorage.ts` with CRUD functions
- ✅ Default settings configuration

#### Files to Create:
- `src/types/settings.ts` (NEW)
- `src/utils/settingsStorage.ts` (NEW)

---

### **Phase 2: Settings Dialog Component** 🎨
**Goal:** Create a modal dialog for notification settings

#### Tasks:
1. **Create `NotificationSettingsDialog` Component** (`src/components/NotificationSettingsDialog.tsx`)
   - Modal dialog similar to `GeminiApiKeyDialog` (referenced in ChatHeader.tsx line 155)
   - Clean, simple UI with toggle switches
   - Section for sound notifications
   - Section for Chrome notifications
   - Save and Cancel buttons
   - Real-time preview of sound (play sound when toggle is enabled)

2. **UI Layout**
   ```
   ┌─────────────────────────────────────┐
   │  Notification Settings          [×] │
   ├─────────────────────────────────────┤
   │                                     │
   │  🔔 Sound Notifications             │
   │  ─────────────────────────          │
   │  Play sound when AI completes       │
   │  [Toggle: ON/OFF]                   │
   │                                     │
   │  📢 Chrome Notifications            │
   │  ─────────────────────────          │
   │  Show Chrome notification with      │
   │  "Continue Iterating" button        │
   │  [Toggle: ON/OFF]                   │
   │                                     │
   │  ℹ️ Note: Only works when extension │
   │     is not in focus                 │
   │                                     │
   │         [Cancel]  [Save Settings]   │
   └─────────────────────────────────────┘
   ```

3. **Component Features**
   - Load current settings on mount
   - Update state when toggles change
   - Save settings to storage on "Save" click
   - Close dialog on "Cancel" or "Save"
   - Test sound playback when sound toggle is enabled
   - Show success toast after saving

#### Deliverables:
- ✅ `NotificationSettingsDialog.tsx` component
- ✅ Clean, accessible UI with toggle switches
- ✅ Settings save/load functionality
- ✅ Sound preview feature

#### Files to Create:
- `src/components/NotificationSettingsDialog.tsx` (NEW)

---

### **Phase 3: ChatHeader Integration** 🔗
**Goal:** Add "Notification Settings" option to ChatHeader dropdown

#### Tasks:
1. **Modify `ChatHeader.tsx`**
   - Add state for notification settings dialog visibility
   - Add menu item to dropdown (after "Features", before "Gemini API Key Setup")
   - Handle menu item click to open dialog
   - Import and render `NotificationSettingsDialog` component

2. **Menu Item Addition**
   - Add after line 133 (after "Features" menu item)
   - Icon: 🔔 or Bell icon from lucide-react
   - Text: "Notification Settings"
   - Click handler: `setShowNotificationSettingsDialog(true)`

3. **Code Changes**
   ```typescript
   // Add state (around line 27)
   const [showNotificationSettingsDialog, setShowNotificationSettingsDialog] = useState(false);

   // Add menu item (around line 133)
   <button
       className="copilot-header-menu-item"
       onClick={() => {
           setShowHeaderMenu(false);
           setShowNotificationSettingsDialog(true);
       }}
   >
       Notification Settings
   </button>

   // Add dialog component (after GeminiApiKeyDialog, around line 160)
   <NotificationSettingsDialog
       isOpen={showNotificationSettingsDialog}
       onClose={() => setShowNotificationSettingsDialog(false)}
   />
   ```

#### Deliverables:
- ✅ Menu item added to dropdown
- ✅ Dialog opens/closes correctly
- ✅ Clean integration with existing menu

#### Files to Modify:
- `src/components/chat/ChatHeader.tsx` (MODIFY - around lines 27, 133, 160)

---

### **Phase 4: Settings Integration with Features** 🔌
**Goal:** Connect settings to sound and notification features

#### Tasks:
1. **Modify Sound Notification Utility** (`src/utils/soundNotification.ts`)
   - Check settings before playing sound
   - Load settings from storage
   - Only play sound if `soundEnabled === true`
   - Respect user preference

2. **Modify AI Notification Utility** (`src/utils/aiNotification.ts`)
   - Check settings before creating Chrome notification
   - Load settings from storage
   - Only create notification if `chromeNotificationEnabled === true`
   - Respect user preference

3. **Modify `aiLogic.ts`**
   - Load settings in `onFinish` callback
   - Check sound settings before triggering sound
   - Check notification settings before sending notification message
   - Pass settings through context if needed

4. **Settings Caching**
   - Cache settings in memory to avoid repeated storage reads
   - Invalidate cache when settings change
   - Use React context or simple module-level cache

#### Deliverables:
- ✅ Sound respects settings
- ✅ Chrome notifications respect settings
- ✅ Settings loaded efficiently
- ✅ Changes take effect immediately

#### Files to Modify:
- `src/utils/soundNotification.ts` (MODIFY)
- `src/utils/aiNotification.ts` (MODIFY)
- `src/ai/aiLogic.ts` (MODIFY - around line 738-795)

---

### **Phase 5: Settings Context (Optional Enhancement)** 🌐
**Goal:** Create React Context for global settings access

#### Tasks:
1. **Create Settings Context** (`src/contexts/SettingsContext.tsx`)
   - React Context for settings state
   - Load settings on mount
   - Provide settings and update functions
   - Listen for storage changes (sync across components)

2. **Wrap Sidepanel with Context**
   - Wrap `sidepanel.tsx` app with `SettingsProvider`
   - Access settings anywhere in component tree
   - Avoid prop drilling

3. **Benefits**
   - Single source of truth for settings
   - Automatic re-render when settings change
   - Easy access from any component
   - Storage change synchronization

#### Deliverables:
- ✅ Settings context created (optional)
- ✅ Sidepanel wrapped with provider
- ✅ Settings accessible throughout app

#### Files to Create (Optional):
- `src/contexts/SettingsContext.tsx` (NEW - optional)

---

### **Phase 6: Testing & Polish** ✨
**Goal:** Ensure settings work correctly across all scenarios

#### Tasks:
1. **Test Scenarios**
   - ✅ Open settings dialog from dropdown
   - ✅ Toggle sound on/off - verify sound plays/doesn't play
   - ✅ Toggle Chrome notification on/off - verify behavior
   - ✅ Save settings - verify persisted to storage
   - ✅ Cancel dialog - verify settings not saved
   - ✅ Settings persist across extension reload
   - ✅ Settings sync across tabs (if applicable)
   - ✅ Sound preview works in dialog
   - ✅ UI is responsive and accessible

2. **Edge Case Handling**
   - Settings storage fails (show error toast)
   - Default settings when no storage data
   - Migration for future setting changes
   - Invalid settings values (validate and fix)

3. **UI/UX Polish**
   - Smooth animations for dialog
   - Clear toggle states (on/off visible)
   - Helpful descriptions for each setting
   - Success feedback when saved
   - Accessible keyboard navigation

#### Deliverables:
- ✅ All scenarios tested
- ✅ Edge cases handled
- ✅ Polished UI/UX
- ✅ No console errors

---

## 🗂️ File Structure Summary

```
chrome-ai/
├── src/
│   ├── components/
│   │   ├── chat/
│   │   │   └── ChatHeader.tsx ⚠️ (MODIFY - Phase 3)
│   │   └── NotificationSettingsDialog.tsx 🆕 (NEW - Phase 2)
│   ├── contexts/
│   │   └── SettingsContext.tsx 🆕 (NEW - Phase 5, optional)
│   ├── types/
│   │   └── settings.ts 🆕 (NEW - Phase 1)
│   ├── utils/
│   │   ├── settingsStorage.ts 🆕 (NEW - Phase 1)
│   │   ├── soundNotification.ts ⚠️ (MODIFY - Phase 4)
│   │   └── aiNotification.ts ⚠️ (MODIFY - Phase 4)
│   ├── ai/
│   │   └── aiLogic.ts ⚠️ (MODIFY - Phase 4)
│   └── sidepanel.tsx ⚠️ (MODIFY - Phase 5, optional)
└── SETTINGS_UI_PLAN.md 📄 (This file)
```

---

## 🎯 Success Criteria

- [x] "Notification Settings" menu item in ChatHeader dropdown
- [x] Clean, simple settings dialog with toggle switches
- [x] Settings save to `chrome.storage.local` correctly
- [x] Settings load on extension start
- [x] Sound notifications respect enabled/disabled setting
- [x] Chrome notifications respect enabled/disabled setting
- [x] Settings persist across extension reloads
- [x] Sound preview works in dialog
- [x] Accessible UI with keyboard navigation
- [x] TypeScript types for all settings
- [x] Clean, maintainable code

---

## 🚀 Execution Order

1. **Phase 1** → Define settings data structure and storage
2. **Phase 2** → Create settings dialog component
3. **Phase 3** → Integrate dialog into ChatHeader
4. **Phase 4** → Connect settings to features (sound + notifications)
5. **Phase 5** → (Optional) Create settings context for better state management
6. **Phase 6** → Test and polish

**Estimated Time:** 3-4 hours total (30-45 min per phase)

---

## 📝 Implementation Examples

### Settings Storage (Phase 1)

```typescript
// src/utils/settingsStorage.ts
export interface NotificationSettings {
    soundEnabled: boolean;
    chromeNotificationEnabled: boolean;
    volume: number; // 0.0 to 1.0
}

export interface UserSettings {
    notifications: NotificationSettings;
    version: number;
}

const STORAGE_KEY = 'userSettings';
const DEFAULT_SETTINGS: UserSettings = {
    notifications: {
        soundEnabled: true,
        chromeNotificationEnabled: true,
        volume: 0.7,
    },
    version: 1,
};

export async function getSettings(): Promise<UserSettings> {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] || DEFAULT_SETTINGS;
}

export async function saveSettings(settings: UserSettings): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}

export async function resetSettings(): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_SETTINGS });
}
```

### Settings Dialog (Phase 2)

```typescript
// src/components/NotificationSettingsDialog.tsx
import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '../utils/settingsStorage';

interface NotificationSettingsDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export const NotificationSettingsDialog: React.FC<NotificationSettingsDialogProps> = ({
    isOpen,
    onClose,
}) => {
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [chromeNotificationEnabled, setChromeNotificationEnabled] = useState(true);

    useEffect(() => {
        if (isOpen) {
            loadSettings();
        }
    }, [isOpen]);

    const loadSettings = async () => {
        const settings = await getSettings();
        setSoundEnabled(settings.notifications.soundEnabled);
        setChromeNotificationEnabled(settings.notifications.chromeNotificationEnabled);
    };

    const handleSave = async () => {
        const settings = await getSettings();
        settings.notifications.soundEnabled = soundEnabled;
        settings.notifications.chromeNotificationEnabled = chromeNotificationEnabled;
        await saveSettings(settings);
        onClose();
        // Show success toast
    };

    if (!isOpen) return null;

    return (
        <div className="notification-settings-dialog">
            <h2>Notification Settings</h2>
            
            <div className="setting-section">
                <h3>🔔 Sound Notifications</h3>
                <p>Play sound when AI completes</p>
                <Toggle checked={soundEnabled} onChange={setSoundEnabled} />
            </div>

            <div className="setting-section">
                <h3>📢 Chrome Notifications</h3>
                <p>Show Chrome notification with "Continue Iterating" button</p>
                <Toggle checked={chromeNotificationEnabled} onChange={setChromeNotificationEnabled} />
            </div>

            <div className="dialog-actions">
                <button onClick={onClose}>Cancel</button>
                <button onClick={handleSave}>Save Settings</button>
            </div>
        </div>
    );
};
```

### Using Settings in Features (Phase 4)

```typescript
// src/utils/soundNotification.ts
import { getSettings } from './settingsStorage';

export async function playNotificationSound() {
    const settings = await getSettings();
    
    if (!settings.notifications.soundEnabled) {
        console.log('Sound notifications disabled by user');
        return;
    }
    
    // Play sound...
    const audio = new Audio('/sweep1.mp3');
    audio.volume = settings.notifications.volume;
    await audio.play();
}
```

---

## 🔄 Future Enhancements (Post-MVP)

1. **Volume Control**
   - Slider for sound volume
   - Test button to preview volume

2. **Sound Selection**
   - Choose from multiple notification sounds
   - Upload custom sound

3. **Advanced Options**
   - Notification delay (wait X seconds before showing)
   - Do Not Disturb hours
   - Per-thread notification settings
   - Notification grouping preferences

4. **Export/Import Settings**
   - Export settings to file
   - Import settings from file
   - Sync settings across devices

---

## ✅ Ready to Implement?

This plan creates a clean, simple settings UI that integrates seamlessly with the existing ChatHeader dropdown menu.

**Dependencies:**
- Requires sound notification system (Sound Plan)
- Requires Chrome notification system (Chrome Notification Plan)
- Independent of visibility tracking (that's internal to features)

Reply with:
- "Start Phase 1" to begin settings infrastructure
- Or request modifications to this plan
