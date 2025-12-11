---
inclusion: fileMatch
fileMatchPattern: "**/content*.{ts,tsx,js}"
---

# DOM and Event Listener Lifecycle

## Cleanup Requirements
- Always clean up injected DOM elements (canvas, style tags) on unmount
- Always remove event listeners in cleanup functions
- Re-query DOM elements in cleanup instead of capturing references once
- Store named handler references for proper removal

## Event Listeners
- Guard against duplicate listener registration
- Use `(window as any).__handlerName` to persist references in content scripts
- Remove listeners when: component unmounts, tool unregisters, canvas destroyed, page unloads
- Clean up abort/signal listeners even on success paths

## Animation Tracking
- Implement animation counters: increment on start, decrement on completion
- Schedule cleanup after idle timeout (e.g., 3 seconds) when count reaches zero
- Clean up: canvas elements, style tags, event listeners, timers, animation frames
- Ensure cleanup runs even if animation fails
