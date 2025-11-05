# 🔔 Notification Sound Implementation Plan

## Overview
Implement a notification sound (`sweep1.mp3`) that plays when the AI stops responding (completes its response) AND the user is focused on another window (not the Chrome extension).

**Key Change:** Sound plays on AI response completion, NOT just when Continue button appears.

---

## 📋 Multi-Phase Implementation Plan

### **Phase 1: Visibility Tracking Infrastructure** 🎯
**Goal:** Set up reliable window/document visibility detection

#### Tasks:
1. **Create Visibility Hook** (`src/hooks/useWindowVisibility.ts`)
   - Track `document.hidden` state
   - Track `window.focus/blur` events
   - Combine both for accurate detection
   - Return `isUserAway` boolean state
   - Clean up event listeners on unmount

2. **Create Visibility Context** (Optional but recommended)
   - Provide visibility state throughout the app
   - Avoid prop drilling
   - Single source of truth for focus state

#### Deliverables:
- ✅ `useWindowVisibility` custom hook
- ✅ TypeScript types for visibility state
- ✅ Unit tests (optional)

#### Files to Create/Modify:
- `src/hooks/useWindowVisibility.ts` (NEW)
- `src/types/visibility.ts` (NEW - optional)

---

### **Phase 2: Sound Notification Utility** 🔊
**Goal:** Create reusable sound playback utility

#### Tasks:
1. **Create Sound Utility** (`src/utils/soundNotification.ts`)
   - Function to play `sweep1.mp3`
   - Error handling for audio playback failures
   - Debouncing to prevent multiple plays
   - Volume control (optional)
   - Memoization to avoid recreating Audio objects

2. **Sound Permission Handling**
   - Handle browser autoplay policies
   - Graceful fallback if sound blocked
   - Log errors without breaking app

#### Deliverables:
- ✅ `playNotificationSound()` function
- ✅ Error handling for blocked autoplay
- ✅ Debouncing mechanism (prevent spam)

#### Files to Create/Modify:
- `src/utils/soundNotification.ts` (NEW)
- `src/constants/audio.ts` (NEW - optional, for audio paths)

---

### **Phase 3: AI Response Completion Sound Integration** ⏹️
**Goal:** Trigger sound when AI stops responding (completes response) + user is away

#### Tasks:
1. **Modify `aiLogic.ts`**
   - Locate the `onFinish` callback (lines ~738-795)
   - Add condition: if user is away → play sound
   - Pass visibility state from parent component
   - Ensure sound plays on EVERY AI completion, not just when continue button appears
   - Play sound for all finish reasons (stop, length, tool-calls, etc.)

2. **Pass Visibility State to `streamAIResponse`**
   - Add `isUserAway` parameter to function signature
   - Accept visibility state from calling component
   - Use state in `onFinish` callback to trigger sound

3. **Test Different Finish Scenarios**
   - Ensure sound plays when AI completes normally
   - Ensure sound plays when AI hits tool call limit
   - Ensure sound plays when AI hits token limit
   - Verify sound does NOT play when user is viewing the extension

#### Deliverables:
- ✅ Sound trigger in `aiLogic.ts` on ALL AI completions
- ✅ Visibility state passed through function params
- ✅ Sound plays ONLY when user is away AND AI completes response

#### Files to Create/Modify:
- `src/ai/aiLogic.ts` (MODIFY)
- `src/components/chat/ContinueButton.tsx` (MODIFY - optional)

---

### **Phase 4: Integration with Sidepanel** 🖥️
**Goal:** Wire up visibility tracking in main UI component

#### Tasks:
1. **Modify `sidepanel.tsx`**
   - Import and use `useWindowVisibility` hook
   - Get `isUserAway` state
   - Pass state to AI streaming function
   - Update chat context/state

2. **Update `streamAIResponse` Calls**
   - Find all places where `streamAIResponse` is called
   - Add `isUserAway` parameter
   - Ensure consistency across codebase

#### Deliverables:
- ✅ Visibility tracking active in sidepanel
- ✅ State passed to AI logic
- ✅ End-to-end flow working

#### Files to Create/Modify:
- `src/sidepanel.tsx` (MODIFY)
- Any other components calling `streamAIResponse`

---

### **Phase 5: Testing & Polish** ✨
**Goal:** Ensure feature works reliably and handle edge cases

#### Tasks:
1. **Test Scenarios**
   - ✅ Sound plays when user switches to another app
   - ✅ Sound doesn't play when user is viewing Chrome
   - ✅ Sound plays only once per continue button
   - ✅ Sound doesn't break if file missing
   - ✅ Works in different Chrome windows
   - ✅ Works in minimized state

2. **Edge Case Handling**
   - User rapidly switches windows
   - Multiple continue buttons in quick succession
   - Sound file load failure
   - Browser autoplay blocked
   - Muted system volume (can't detect, but handle gracefully)

3. **User Settings** (Optional future enhancement)
   - Add option to enable/disable sounds
   - Volume control slider
   - Custom sound selection

#### Deliverables:
- ✅ Tested in various scenarios
- ✅ Edge cases handled
- ✅ No console errors
- ✅ Smooth user experience

#### Files to Create/Modify:
- Testing checklist document (optional)
- Settings UI (future enhancement)

---

## 🗂️ File Structure Summary

```
chrome-ai/
├── public/
│   └── sweep1.mp3 ✅ (Already exists)
├── src/
│   ├── ai/
│   │   └── aiLogic.ts ⚠️ (MODIFY - Phase 3)
│   ├── components/
│   │   └── chat/
│   │       └── ContinueButton.tsx ⚠️ (MODIFY - Phase 3, optional)
│   ├── hooks/
│   │   └── useWindowVisibility.ts 🆕 (NEW - Phase 1)
│   ├── utils/
│   │   └── soundNotification.ts 🆕 (NEW - Phase 2)
│   ├── types/
│   │   └── visibility.ts 🆕 (NEW - Phase 1, optional)
│   ├── constants/
│   │   └── audio.ts 🆕 (NEW - Phase 2, optional)
│   └── sidepanel.tsx ⚠️ (MODIFY - Phase 4)
└── NOTIFICATION_SOUND_PLAN.md 📄 (This file)
```

---

## ✅ Success Criteria

- [x] Sound plays when AI completes response + user is in another window
- [x] Sound does NOT play when user is viewing the Chrome extension
- [x] Sound plays on EVERY AI completion (regardless of continue button)
- [x] Sound plays only once per AI completion
- [x] No errors if sound fails to play
- [x] Minimal performance impact
- [x] Clean, maintainable code
- [x] TypeScript types for all new code
- [x] Proper cleanup of event listeners

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
- ✅ `document.hidden` supported in all modern browsers
- ⚠️ Autoplay policies may block sound (handle gracefully)

### Performance
- Use `useMemo` for Audio object creation
- Debounce sound plays (500ms minimum between plays)
- Remove event listeners on unmount

### User Experience
- Keep sound short and pleasant (sweep1.mp3 should be brief)
- Consider adding visual indicator that sound was played
- Future: Allow users to disable in settings

### Security
- Sound file is local (in `public/` folder) - safe
- No external audio requests
- No privacy concerns

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
