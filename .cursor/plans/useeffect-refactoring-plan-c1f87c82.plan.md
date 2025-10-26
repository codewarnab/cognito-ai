<!-- c1f87c82-91a0-4f92-b82f-011e52d75d6d 723bc189-1b4f-4653-b3e0-42e5cff13376 -->
# UseEffect Refactoring Plan

## Overview

Refactor 94+ useEffect hooks across 62 files following React best practices: eliminate redundant state, calculate during render, move logic to event handlers, and properly synchronize with external systems.

## Analysis Summary

After analyzing the codebase, I've identified these useEffect patterns that need refactoring:

### Category 1: Redundant State & Unnecessary Effects (High Priority)

**Pattern**: Effects that update state based on props/state changes

**Files affected**:

- `src/hooks/useSuggestions.ts` - Multiple effects managing suggestion state
- `src/components/chat/SuggestedActions.tsx` - Effect resetting suggestion visibility
- `src/components/CopilotChatWindow.tsx` - Multiple effects tracking model state and conversation mode
- `src/sidepanel.tsx` - Effects for onboarding state management

### Category 2: Event Handler Logic in Effects (High Priority)

**Pattern**: Effects performing actions that should be in event handlers

**Files affected**:

- `src/sidepanel.tsx` - Thread title generation in effect (line 371-410)
- `src/sidepanel.tsx` - Message saving in effect (line 308-418)
- `src/components/chat/ChatHeader.tsx` - Click outside handler (line 25-31)
- `src/components/McpServerCard.tsx` - Click outside tooltip (line 115-133)

### Category 3: Proper External System Synchronization (Medium Priority)

**Pattern**: Effects that correctly synchronize with external systems but may need cleanup improvements

**Files affected**:

- `src/hooks/useSuggestions.ts` - Chrome tabs API listeners (lines 156-201)
- `src/audio/useSpeechRecognition.ts` - Speech recognition API (lines 49-302)
- `src/audio/VoiceInput.tsx` - Effects with side effects (lines 82-101)
- `src/components/McpServerCard.tsx` - Chrome runtime message listeners (lines 76-112)

### Category 4: Interval/Timer Effects (Medium Priority)

**Pattern**: Effects with setInterval/setTimeout that could be optimized

**Files affected**:

- `src/sidepanel.tsx` - Tab context polling (line 216-230)
- `src/sidepanel.tsx` - Behavioral preferences polling (line 232-246)
- `src/components/LoadingScreen.tsx` - Countdown timer (line 12-24)
- `src/audio/useSpeechRecognition.ts` - Silence detection timers

### Category 5: One-time Initialization (Low Priority)

**Pattern**: Effects that load data on mount - these are generally acceptable but could use optimization

**Files affected**:

- `src/sidepanel.tsx` - API key loading (line 104-117)
- `src/sidepanel.tsx` - Onboarding check (line 119-142)
- `src/components/MemoryPanel.tsx` - Memory loading (line 41-45)

---

## Phase 1: Eliminate Redundant State & Calculate During Render

### 1.1 Fix `useSuggestions.ts` Multiple Effects

**Current issues**:

- Effect at line 206-225: Detects mode switch from local to cloud
- Effect at line 228-234: Resets state when `shouldGenerate` changes
- These create cascading state updates

**Refactoring**:

```typescript
// REMOVE these two separate effects (lines 206-234)
// CONSOLIDATE into the main effect at line 156 with better dependency logic
```

**Changes needed**:

- Remove the mode switch detection effect
- Remove the reset effect  
- Handle mode transitions and resets directly in the main tab listener effect
- Use refs to track previous mode without triggering re-renders

### 1.2 Fix `SuggestedActions.tsx` Visibility Reset

**Current issue** (line 70-74):

```typescript
useEffect(() => {
    if (messages.length === 0 && !input.trim()) {
        setShowSuggestions(true);
    }
}, [messages.length, input]);
```

**Refactoring**:

Calculate `showSuggestions` during render based on conditions instead of using state + effect:

```typescript
// Remove state: const [showSuggestions, setShowSuggestions] = useState(true);
// Calculate directly:
const showSuggestions = useMemo(() => {
    // Reset to true when conditions are met
    return messages.length === 0 && !input.trim();
}, [messages.length, input]);
```

### 1.3 Fix `CopilotChatWindow.tsx` Conversation Mode Tracking

**Current issue** (line 100-109):

Effect that tracks when first message is sent to lock conversation mode

**Refactoring**:

Move this logic into the `handleSendMessage` callback in `sidepanel.tsx` where the actual message is sent - this is an event, not a synchronization

### 1.4 Fix `sidepanel.tsx` Onboarding State Management

**Current issues**:

- Lines 119-142: Effect checks onboarding status on mount
- Lines 183-199: Effect exposes testing functions globally

**Refactoring**:

- Move onboarding check to component initialization (before render, not in effect)
- Expose testing functions during component definition, not in effect

---

## Phase 2: Move Event Logic Out of Effects

### 2.1 Fix Thread Title Generation in `sidepanel.tsx`

**Current issue** (lines 371-410):

Thread title generation happens in effect when messages change - this is event-based logic

**Refactoring**:

Move title generation into `handleSendMessage` after successful message completion:

```typescript
// In handleSendMessage, after AI response completes:
aiChat.onFinish = (result) => {
    if (messages.length >= 2 && result.message.role === 'assistant') {
        // Generate title here, not in effect
        generateAndUpdateTitle(currentThreadId, messages);
    }
};
```

### 2.2 Fix Message Persistence in `sidepanel.tsx`

**Current issue** (lines 308-418):

Messages saved to IndexedDB in effect whenever they change

**Refactoring**:

- Move to `onFinish` callback in AI chat
- Save immediately after message is complete, not on every state change
- Eliminates unnecessary re-saves and JSON.stringify dependency

### 2.3 Fix Click-Outside Handlers

**Files**: `ChatHeader.tsx`, `McpServerCard.tsx`

**Current pattern**:

```typescript
useEffect(() => {
    const handleClickOutside = () => setShowMenu(false);
    if (showMenu) {
        window.addEventListener('click', handleClickOutside, { once: true });
    }
    return () => window.removeEventListener('click', handleClickOutside);
}, [showMenu]);
```

**Refactoring**:

Use `useRef` callback pattern or move to menu button's onClick handler with `stopPropagation`

---

## Phase 3: Optimize External System Synchronization

### 3.1 Improve `useSuggestions.ts` Chrome Tabs Listeners

**Current implementation** (lines 156-201):

Generally correct but recreates listeners on every `shouldGenerate` change

**Optimization**:

- Extract listener functions outside effect
- Use refs to access latest `shouldGenerate` value
- Only create/destroy listeners once on mount/unmount
- Check `shouldGenerate` inside the listener callbacks

### 3.2 Optimize `useSpeechRecognition.ts` Cleanup

**Current implementation**:

Multiple refs for timers, complex cleanup logic

**Optimization**:

- Consolidate timer cleanup into single `useEffect` return
- Extract cleanup logic to reusable function
- Ensure all timers cleared on unmount

### 3.3 Fix `VoiceInput.tsx` Side Effect Ordering

**Current issues** (lines 82-101):

Three separate effects that could be consolidated

**Refactoring**:

Combine related effects and ensure proper dependency arrays

---

## Phase 4: Optimize Timers and Intervals

### 4.1 Fix Polling in `sidepanel.tsx`

**Current issues**:

- Lines 216-230: Tab context polling every 2 seconds
- Lines 232-246: Behavioral preferences polling every 30 seconds

**Optimization**:

- Use Chrome tabs API events instead of polling for tab context
- Increase behavioral preferences interval or make on-demand
- Consider using `useCallback` for interval callbacks

### 4.2 Fix `LoadingScreen.tsx` Countdown

**Current implementation** (lines 12-24):

Creates new interval on every duration change

**Optimization**:

- Use `useRef` for countdown state to avoid re-renders
- Consider using CSS animations instead of JS countdown

---

## Phase 5: One-Time Initialization Patterns

### 5.1 Optimize Initial Data Loading

**Files**: `sidepanel.tsx`, `MemoryPanel.tsx`, `CopilotChatWindow.tsx`

**Current pattern**:

```typescript
useEffect(() => {
    loadData();
}, []);
```

**Optimization**:

- Add loading/error states
- Use React 19 `use()` for async data loading (if upgrading)
- Consider lazy initialization with `useState(() => initialValue)`

---

## Phase 6: Testing & Validation

### 6.1 Test Each Refactored Component

- Verify no regression in functionality
- Check that cleanup still works properly
- Ensure no memory leaks

### 6.2 Performance Validation

- Monitor re-render counts
- Verify reduced effect executions
- Check Chrome DevTools performance

### 6.3 Edge Cases

- Test rapid mode switches
- Test component unmounting during async operations
- Test error scenarios

---

## Implementation Order

**Week 1**: Phase 1 (High Priority - Redundant State)

- Most impactful improvements
- Reduces unnecessary re-renders

**Week 2**: Phase 2 (High Priority - Event Logic)

- Improves code clarity
- Reduces bugs from stale closures

**Week 3**: Phase 3 & 4 (Medium Priority - Optimization)

- Performance improvements
- Better resource management

**Week 4**: Phase 5 & 6 (Low Priority - Cleanup)

- Polish and testing
- Documentation updates

---

## Success Metrics

1. **Reduced Effect Count**: Target 30% reduction in useEffect calls
2. **Fewer Re-renders**: Measure with React DevTools Profiler
3. **Code Clarity**: More logic in event handlers vs effects
4. **Maintainability**: Easier to understand data flow
5. **Performance**: Faster component updates and less memory usage

---

## Risk Mitigation

1. **Incremental Rollout**: Refactor one category at a time
2. **Feature Flags**: Add flags for new behavior
3. **Extensive Testing**: Unit + integration tests
4. **Rollback Plan**: Git branches per phase
5. **Monitoring**: Watch for console errors post-deployment

### To-dos

- [ ] Refactor useSuggestions.ts to eliminate redundant effects (mode switch and reset effects) and consolidate into main effect
- [ ] Remove showSuggestions state from SuggestedActions.tsx and calculate visibility during render
- [ ] Move conversation mode tracking from CopilotChatWindow effect to handleSendMessage event handler
- [ ] Move onboarding check and global function exposure from effects to component initialization
- [ ] Move thread title generation from effect to onFinish callback in handleSendMessage
- [ ] Move message saving from effect to AI chat onFinish callback to eliminate redundant saves
- [ ] Refactor click-outside handlers in ChatHeader.tsx and McpServerCard.tsx using useRef pattern
- [ ] Optimize Chrome tabs listeners in useSuggestions.ts to use refs and avoid recreating listeners
- [ ] Consolidate timer cleanup in useSpeechRecognition.ts into single useEffect return
- [ ] Combine and optimize effects in VoiceInput.tsx with proper dependencies
- [x] Replace tab context polling with Chrome events API and optimize behavioral preferences polling
- [x] Optimize LoadingScreen.tsx countdown using useRef to reduce re-renders
- [x] Optimize initial data loading patterns across sidepanel.tsx, MemoryPanel.tsx, and CopilotChatWindow.tsx
- [ ] Test all refactored components for regressions, memory leaks, and performance improvements