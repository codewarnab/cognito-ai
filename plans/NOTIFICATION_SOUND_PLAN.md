# 🔔 Notification Sound Implementation Plan (UPDATED)

## Overview
Implement a notification sound (`sweep1.mp3`) that plays when the AI stops responding (completes its response) AND the user is focused on another window (not the Chrome extension).

**Key Change:** Sound plays on AI response completion, NOT just when Continue button appears.

**Architecture:** Using Chrome Windows API + React Context (no background worker needed)

---

## 📋 Multi-Phase Implementation Plan

### **Phase 1: Visibility Tracking Infrastructure** 🎯
**Goal:** Set up reliable window/document visibility detection using Chrome Windows API

#### Tasks:
1. **Create Visibility Context** (`src/contexts/WindowVisibilityContext.tsx`)
   - Use `chrome.windows.onFocusChanged` API for reliable focus detection
   - Track when Chrome window loses focus (user switches to another app)
   - Combine with `document.visibilityState` for comprehensive tracking
   - Return `isUserAway` boolean state
   - Provide context throughout the app (no prop drilling)
   - Clean up event listeners on unmount

2. **Chrome Windows API Integration**
   - Listen to `chrome.windows.onFocusChanged` events
   - Detect when focus changes to `WINDOW_ID_NONE` (all Chrome windows lose focus)
   - Handle multiple Chrome windows correctly
   - Works reliably in sidepanel context

#### Deliverables:
- ✅ `WindowVisibilityContext` with Chrome Windows API integration
- ✅ `useWindowVisibility` hook to consume context
- ✅ TypeScript types for visibility state
- ✅ Reliable detection across all scenarios

#### Files to Create/Modify:
- `src/contexts/WindowVisibilityContext.tsx` (NEW)
- `src/hooks/useWindowVisibility.ts` (NEW - hook to consume context)

---

### **Phase 2: Sound Notification Utility** 🔊
**Goal:** Create reusable sound playback utility with autoplay unlock

#### Tasks:
1. **Create Sound Utility** (`src/utils/soundNotification.ts`)
   - Function to play `sweep1.mp3`
   - Error handling for audio playback failures
   - Debouncing to prevent multiple plays (500ms)
   - Volume control support
   - Memoization to avoid recreating Audio objects

2. **Autoplay Policy Workaround**
   - Preload audio on first user interaction (Alternative approach)
   - Play silent audio once to unlock autoplay
   - Graceful fallback if sound blocked
   - Log errors without breaking app

3. **Chrome Extension Audio Context**
   - Use relative path to public folder: `/sweep1.mp3`
   - Handle Chrome extension URL resolution
   - Test in sidepanel context

#### Deliverables:
- ✅ `playNotificationSound()` function with autoplay unlock
- ✅ `initializeNotificationSound()` for first-time setup
- ✅ Error handling for blocked autoplay
- ✅ Debouncing mechanism (prevent spam)

#### Files to Create/Modify:
- `src/utils/soundNotification.ts` (NEW)
- `src/constants/audio.ts` (NEW - for audio paths)

---

### **Phase 3: AI Response Completion Sound Integration** ⏹️
**Goal:** Trigger sound when AI stops responding (completes response) + user is away

#### Tasks:
1. **Modify `aiLogic.ts`**
   - Locate the `onFinish` callback (line ~220 in current codebase)
   - Add condition: if user is away → play sound
   - Access visibility state from React Context
   - Ensure sound plays on EVERY AI completion, not just when continue button appears
   - Play sound for all finish reasons (stop, length, tool-calls, etc.)

2. **Use Visibility Context in AI Logic**
   - Import `useWindowVisibility` hook in component that calls `streamAIResponse`
   - Pass visibility checker function or state to AI logic
   - Use in `onFinish` callback to trigger sound

3. **Test Different Finish Scenarios**
   - Ensure sound plays when AI completes normally
   - Ensure sound plays when AI hits tool call limit
   - Ensure sound plays when AI hits token limit
   - Verify sound does NOT play when user is viewing the extension

#### Deliverables:
- ✅ Sound trigger in `aiLogic.ts` on ALL AI completions
- ✅ Visibility state accessed via Context
- ✅ Sound plays ONLY when user is away AND AI completes response

#### Files to Create/Modify:
- `src/ai/core/aiLogic.ts` (MODIFY - line ~220)
- Component calling `streamAIResponse` (MODIFY)

---

### **Phase 4: Integration with Sidepanel** 🖥️
**Goal:** Wire up visibility tracking and sound initialization in main UI component

#### Tasks:
1. **Modify `sidepanel.tsx`**
   - Wrap app with `WindowVisibilityProvider`
   - Initialize sound on first user interaction
   - Ensure context is available to all components

2. **Initialize Audio on Mount**
   - Call `initializeNotificationSound()` on user's first interaction
   - Use click or keypress event to unlock audio
   - Show optional "Sounds enabled" indicator

#### Deliverables:
- ✅ Visibility context wrapping entire app
- ✅ Sound initialized and ready to play
- ✅ End-to-end flow working

#### Files to Create/Modify:
- `src/sidepanel.tsx` (MODIFY - add provider wrapper)

---

### **Phase 5: Testing & Polish** ✨
**Goal:** Ensure feature works reliably and handle edge cases

#### Tasks:
1. **Manual Testing** (User will test)
   - ✅ Sound plays when user switches to another app
   - ✅ Sound doesn't play when user is viewing Chrome
   - ✅ Sound plays only once per AI response completion
   - ✅ Sound doesn't break if file missing
   - ✅ Works in different Chrome windows
   - ✅ Works in minimized state

2. **Edge Case Handling**
   - User rapidly switches windows
   - Multiple AI responses in quick succession
   - Sound file load failure
   - Browser autoplay blocked
   - Muted system volume (can't detect, but handle gracefully)

3. **User Settings** (Optional future enhancement)
   - Add option to enable/disable sounds
   - Volume control slider
   - Custom sound selection

#### Deliverables:
- ✅ Edge cases handled
- ✅ No console errors
- ✅ Smooth user experience

#### Files to Create/Modify:
- Settings UI (future enhancement)

---

## 🗂️ File Structure Summary

```
chrome-ai/
├── public/
│   └── sweep1.mp3 ✅ (Already exists)
├── src/
│   ├── ai/
│   │   └── core/
│   │       └── aiLogic.ts ⚠️ (MODIFY - Phase 3, line ~220)
│   ├── contexts/
│   │   └── WindowVisibilityContext.tsx 🆕 (NEW - Phase 1)
│   ├── hooks/
│   │   └── useWindowVisibility.ts 🆕 (NEW - Phase 1)
│   ├── utils/
│   │   └── soundNotification.ts 🆕 (NEW - Phase 2)
│   ├── constants/
│   │   └── audio.ts 🆕 (NEW - Phase 2)
│   └── sidepanel.tsx ⚠️ (MODIFY - Phase 4)
└── NOTIFICATION_SOUND_PLAN.md 📄 (This file - UPDATED)
```

---

## ✅ Success Criteria

- [x] Sound plays when AI completes response + user is in another window
- [x] Sound does NOT play when user is viewing the Chrome extension
- [x] Sound plays on EVERY AI completion (regardless of continue button)
- [x] Sound plays only once per AI completion
- [x] No errors if sound fails to play
- [x] Minimal performance impact
- [x] Clean, maintainable code with React Context
- [x] TypeScript types for all new code
- [x] Proper cleanup of event listeners
- [x] Uses Chrome Windows API for reliable focus detection
- [x] Autoplay policy handled with user interaction unlock
- [x] Works for multiple Chrome windows scenario

---

## 🚀 Execution Order

1. **Phase 1** → Create visibility detection infrastructure
2. **Phase 2** → Build sound playback utility (can be parallel with Phase 1)
3. **Phase 3** → Integrate sound trigger in AI logic
4. **Phase 4** → Wire up in sidepanel UI
5. **Phase 5** → Test and polish

**Estimated Time:** 2-3 hours total (30-45 min per phase)

---

## 📝 Notes & Considerations

### Browser Compatibility
- ✅ Chrome extensions support Web Audio API
- ✅ `chrome.windows.onFocusChanged` is stable and well-supported
- ✅ `document.visibilityState` supported in all modern browsers
- ⚠️ Autoplay policies handled with user interaction unlock

### Performance
- Use React Context to avoid prop drilling
- Debounce sound plays (500ms minimum between plays)
- Remove event listeners on unmount
- Memoize audio object creation

### User Experience
- Keep sound short and pleasant (sweep1.mp3 should be brief)
- Unlock audio on first user interaction
- No visual disruption when sound plays
- Future: Allow users to disable in settings

### Chrome Windows API Benefits
- More reliable than `window.focus/blur` in extension context
- Detects when ALL Chrome windows lose focus
- Works correctly with multiple Chrome windows
- Better integration with Chrome's window management

### Security
- Sound file is local (in `public/` folder) - safe
- No external audio requests
- No privacy concerns
- Chrome Windows API requires no special permissions

---

## 🔄 Future Enhancements (Post-MVP)

1. **User Settings**
   - Toggle sound on/off
   - Volume control
   - Custom sound upload

2. **Multiple Sound Types**
   - Different sounds for different events
   - Error sounds vs success sounds

3. **Visual Notifications**
   - Browser notifications API
   - Desktop notifications
   - Badge count on extension icon

4. **Smart Timing**
   - Don't play during "Do Not Disturb" hours
   - Respect system notification settings

---

## ✅ Ready to Implement?

Reply with:
- "Start Phase 1" to begin with visibility tracking
- "Start Phase 2" to begin with sound utility
- "Start All" to implement all phases sequentially
- Or request modifications to this plan
