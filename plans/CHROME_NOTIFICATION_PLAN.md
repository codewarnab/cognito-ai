# 🔔 Chrome Notification with "Continue Iterating" Action - Implementation Plan

## Overview
Implement Chrome native notifications that appear when the AI completes its response AND the user is in another window. The notification will include a "Continue Iterating" action button that allows the user to continue the conversation without switching back to the extension.

**Reference:** Based on existing reminder notification system in `background.ts` (lines 2530-2590)

---

## 📋 Multi-Phase Implementation Plan

### **Phase 1: Notification Infrastructure** 🔔
**Goal:** Set up Chrome notification system for AI completion events

#### Tasks:
1. **Study Existing Notification System**
   - Review reminder notification implementation in `background.ts`
   - Understand how `chrome.notifications.create()` works
   - Learn from `chrome.notifications.onClicked` handler (line 2536)
   - Understand notification options (title, message, buttons, requireInteraction)

2. **Create AI Notification Utility** (`src/utils/aiNotification.ts`)
   - Function to create Chrome notification with action buttons
   - Support for custom title and message
   - Support for notification buttons (Continue Iterating, Dismiss)
   - Handle notification IDs (format: `ai-complete:{threadId}:{timestamp}`)
   - Error handling for notification creation failures

3. **Define Notification Message Types**
   - Create TypeScript types for AI notification messages
   - Define message structure for background ↔ sidepanel communication
   - Use existing background message handler pattern

#### Deliverables:
- ✅ `src/utils/aiNotification.ts` utility file
- ✅ TypeScript types for notification messages
- ✅ Chrome notification creation function

#### Files to Create/Modify:
- `src/utils/aiNotification.ts` (NEW)
- `src/types/notifications.ts` (NEW - optional)

---

### **Phase 2: Background Script Integration** 🖥️
**Goal:** Handle notification events in background service worker

#### Tasks:
1. **Add Notification Message Handler in `background.ts`**
   - Listen for `ai/notification/create` messages from sidepanel
   - Create Chrome notification with action buttons
   - Store notification metadata (threadId, conversationId)
   - Follow existing message handler pattern (like MCP messages)

2. **Add Notification Click Handler**
   - Listen to `chrome.notifications.onClicked` event
   - When clicked, open/focus the sidepanel
   - Navigate to the correct conversation thread
   - Clear the notification after click

3. **Add Button Click Handler**
   - Listen to `chrome.notifications.onButtonClicked` event
   - When "Continue Iterating" is clicked:
     - Open/focus sidepanel
     - Navigate to correct thread
     - Trigger continue action
     - Clear notification
   - When "Dismiss" is clicked:
     - Just clear notification

4. **Notification Cleanup**
   - Auto-clear notifications after 30 seconds (optional)
   - Clear notification when user focuses on extension
   - Prevent duplicate notifications for same completion

#### Deliverables:
- ✅ Message handler for notification creation
- ✅ Click handler for notification interaction
- ✅ Button click handler for actions
- ✅ Cleanup logic

#### Files to Modify:
- `src/background.ts` (MODIFY - add handlers around line 2536)

---

### **Phase 3: AI Logic Integration** 🤖
**Goal:** Trigger notification when AI completes + user is away

#### Tasks:
1. **Modify `aiLogic.ts` - `onFinish` Callback**
   - Locate `onFinish` callback (lines ~738-795)
   - Check if user is away (using visibility state)
   - If away, send message to background to create notification
   - Pass thread ID, conversation summary, and finish reason
   - Ensure notification only fires once per completion

2. **Notification Content Generation**
   - Extract last AI message as preview
   - Generate notification title: "AI Assistant Finished"
   - Generate notification body: First 100 chars of AI response
   - Include thread context for navigation

3. **Handle Different Finish Reasons**
   - Normal completion: "Response complete"
   - Tool call limit: "Stopped at tool limit - Continue available"
   - Token limit: "Response truncated"
   - Error: "Response ended with error"

#### Deliverables:
- ✅ Notification trigger in `onFinish` callback
- ✅ User away state check
- ✅ Message sent to background for notification
- ✅ Context-aware notification content

#### Files to Modify:
- `src/ai/aiLogic.ts` (MODIFY - around lines 738-795)

---

### **Phase 4: Sidepanel Notification Bridge** 🔗
**Goal:** Connect visibility state, AI events, and background notifications

#### Tasks:
1. **Modify `sidepanel.tsx`**
   - Use `useWindowVisibility` hook (from Phase 1 of sound plan)
   - Pass `isUserAway` state to `streamAIResponse` calls
   - Listen for notification action messages from background
   - Implement "Continue Iterating" handler

2. **Handle "Continue Iterating" Action**
   - Listen for background messages (format: `ai/notification/action`)
   - When "Continue" action received:
     - Load the correct thread (if not already active)
     - Trigger the continue action (same as clicking Continue button)
     - Focus the input field
     - Scroll to latest message

3. **Notification State Management**
   - Track active notifications per thread
   - Prevent duplicate notifications
   - Clear notifications when thread becomes active
   - Clear notifications when user focuses extension

#### Deliverables:
- ✅ Visibility state integrated
- ✅ Background message listener for actions
- ✅ Continue action handler
- ✅ Notification state tracking

#### Files to Modify:
- `src/sidepanel.tsx` (MODIFY)

---

### **Phase 5: Testing & Polish** ✨
**Goal:** Ensure notifications work reliably across scenarios

#### Tasks:
1. **Test Scenarios**
   - ✅ Notification appears when user switches to another app
   - ✅ Notification doesn't appear when user is viewing extension
   - ✅ "Continue Iterating" button works correctly
   - ✅ "Dismiss" button clears notification
   - ✅ Clicking notification body opens extension
   - ✅ Multiple completions create separate notifications
   - ✅ Notifications clear when thread is viewed
   - ✅ Works across different finish reasons

2. **Edge Case Handling**
   - User switches windows during AI response
   - Multiple threads completing simultaneously
   - Notification permission denied
   - Extension closed when notification clicked
   - Service worker restart scenarios

3. **User Experience Polish**
   - Appropriate notification icon
   - Clear, concise notification messages
   - Smooth navigation to thread
   - Proper focus management
   - Graceful degradation if notifications blocked

#### Deliverables:
- ✅ Tested across all scenarios
- ✅ Edge cases handled
- ✅ Smooth user experience
- ✅ No console errors

---

## 🗂️ File Structure Summary

```
chrome-ai/
├── public/
│   └── sweep1.mp3 ✅ (For sound - separate feature)
├── src/
│   ├── ai/
│   │   └── aiLogic.ts ⚠️ (MODIFY - Phase 3)
│   ├── utils/
│   │   └── aiNotification.ts 🆕 (NEW - Phase 1)
│   ├── types/
│   │   └── notifications.ts 🆕 (NEW - Phase 1, optional)
│   ├── background.ts ⚠️ (MODIFY - Phase 2)
│   └── sidepanel.tsx ⚠️ (MODIFY - Phase 4)
└── CHROME_NOTIFICATION_PLAN.md 📄 (This file)
```

---

## 🎯 Success Criteria

- [x] Chrome notification appears when AI completes + user is away
- [x] Notification does NOT appear when user is viewing extension
- [x] "Continue Iterating" button navigates to thread and continues
- [x] "Dismiss" button clears notification
- [x] Clicking notification body opens extension to correct thread
- [x] Notifications work across service worker restarts
- [x] No duplicate notifications for same completion
- [x] Graceful handling of notification permission denial
- [x] Clean, maintainable code
- [x] TypeScript types for all new code

---

## 🚀 Execution Order

1. **Phase 1** → Create notification utility and types
2. **Phase 2** → Implement background handlers (follows existing reminder pattern)
3. **Phase 3** → Integrate notification trigger in AI logic
4. **Phase 4** → Wire up sidepanel action handling
5. **Phase 5** → Test and polish

**Estimated Time:** 3-4 hours total (45-60 min per phase)

---

## 📝 Implementation Notes

### Chrome Notification API Reference

Based on existing code in `background.ts` (lines 2550-2570):

```typescript
// Create notification with action buttons
chrome.notifications.create(`ai-complete:${threadId}:${timestamp}`, {
    type: 'basic',
    iconUrl: appicon, // Use existing app icon from reminders
    title: 'AI Assistant Finished',
    message: 'Response complete. Click to view or continue.',
    buttons: [
        { title: 'Continue Iterating' },
        { title: 'Dismiss' }
    ],
    priority: 2,
    requireInteraction: false // Auto-dismiss after timeout
});

// Handle button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    if (notificationId.startsWith('ai-complete:')) {
        if (buttonIndex === 0) {
            // Continue Iterating clicked
            // Send message to sidepanel to continue
        } else if (buttonIndex === 1) {
            // Dismiss clicked
            chrome.notifications.clear(notificationId);
        }
    }
});

// Handle notification body click
chrome.notifications.onClicked.addListener((notificationId) => {
    if (notificationId.startsWith('ai-complete:')) {
        // Open sidepanel to the thread
        // Extract threadId from notification ID
        // Send message to sidepanel to navigate
        chrome.notifications.clear(notificationId);
    }
});
```

### Message Format

```typescript
// Sidepanel → Background: Create notification
{
    type: 'ai/notification/create',
    payload: {
        threadId: string;
        title: string;
        message: string;
        timestamp: number;
    }
}

// Background → Sidepanel: Continue action
{
    type: 'ai/notification/action',
    payload: {
        action: 'continue' | 'dismiss';
        threadId: string;
    }
}
```

---

## 🔄 Future Enhancements (Post-MVP)

1. **Rich Notifications**
   - Show AI response preview with formatting
   - Display tool calls made
   - Show progress indicator

2. **Notification Groups**
   - Group multiple completions by thread
   - Expandable notification list

3. **Custom Actions**
   - "Read Aloud" button
   - "Copy Response" button
   - "Share" button

4. **Smart Timing**
   - Delay notification if user quickly switches back
   - Respect "Do Not Disturb" hours
   - Batch notifications for rapid completions

---

## ✅ Ready to Implement?

This plan follows the existing reminder notification pattern in `background.ts` and integrates with the visibility tracking from the sound notification plan.

**Dependencies:**
- Requires visibility tracking from Sound Plan Phase 1
- Can be implemented in parallel with sound notifications
- Both features can share the same `isUserAway` state

Reply with:
- "Start Phase 1" to begin notification infrastructure
- Or request modifications to this plan
