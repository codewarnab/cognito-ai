# Writer Overlay Tab Mentions Implementation Plan

## Overview

This plan outlines the implementation of tab mentions (`@TabName` syntax) in the Writer Overlay component (`/write` command), enabling users to reference browser tabs as context for AI-generated content.

### Goals
- Add `@` mention support to the Writer Overlay input field
- Reuse existing tab mention components and utilities from chat
- Maintain the current input field appearance and behavior
- Pass mentioned tab content as context to the Gemini Writer
- Support keyboard navigation and selection in the dropdown

### Non-Goals
- Modifying the existing chat `MentionInput.tsx` component
- Adding tool mentions (`#` syntax) to Writer Overlay
- Changing the RewriterTooltip component (separate feature)

---

## Current Architecture Analysis

### Writer Overlay Flow
```
User types "/write" → WriterOverlay appears with prompt input
    ↓
User types prompt → handleGenerate() called with prompt + toolSettings
    ↓
write-command.tsx sends WriteGenerateRequest via chrome.runtime.Port
    ↓
Background: handler.ts receives WRITE_GENERATE request
    ↓
Background: geminiWriter.ts makes REST API call to Gemini
    ↓
Streaming response → chunks sent back to overlay
    ↓
UI updates with streaming text
```

### Current Writer Input (from WriterOverlay.tsx)
- Uses a simple `<input type="text">` element
- Single line input with onChange/onSubmit handling
- No mention support currently
- Ref: `inputRef = useRef<HTMLInputElement>(null)`

### Existing Chat Tab Mentions System
| Component | File Path | Purpose |
|-----------|-----------|---------|
| `MentionInput` | `src/components/shared/inputs/MentionInput.tsx` | Textarea with @ mention trigger detection |
| `TabMentionDropdown` | `src/components/shared/inputs/TabMentionDropdown.tsx` | Dropdown UI for tab selection |
| `mentionUtils` | `src/utils/chat/mentionUtils.ts` | Utility functions for mentions |
| `tabSnapshot` | `src/utils/tabs/tabSnapshot.ts` | Tab content capture functions |

### Key Mention Utilities Available
```typescript
// From mentionUtils.ts
- extractMentions(text) → { tabMentions, toolMentions }
- getCursorPosition(element) → number
- insertMentionAtCursor(text, cursor, mention, trigger) → { newText, newCursorPosition }
- isMentionTrigger(text, cursor, trigger) → { isTrigger, searchQuery }
- formatTabMention(title, tabId, faviconUrl) → string
- truncateMentionText(text, maxLength) → string

// From tabSnapshot.ts
- getAllTabs() → Promise<chrome.tabs.Tab[]>
- captureTabSnapshot(tabId) → Promise<TabSnapshotResult>
- processMentionedTabs(mentions) → Promise<string>
```

### Type Definitions Required

```typescript
// Already exists in writeCommand.ts
interface WriteGenerateRequest {
    action: 'WRITE_GENERATE';
    payload: {
        prompt: string;
        pageContext?: WritePageContext;
        settings?: { /* ... */ };
        // NEW: Add tab context
        tabContext?: string;  // Processed tab mention content
    };
}
```

---

## Phase 1: Content Script Tab Fetching & Dropdown Integration

**Objective**: Add tab mention dropdown to Writer Overlay, handling the content script limitation that it cannot access `chrome.tabs` API directly.

### 1.0 Background Message Handler for Tab Fetching

**Critical**: Content scripts cannot access `chrome.tabs.query()` directly. We must add a message handler in the background script.

In `src/background/messaging/router.ts` or create `src/background/tabs/handler.ts`:

```typescript
// Add handler for GET_ALL_TABS message
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_ALL_TABS') {
        chrome.tabs.query({})
            .then(tabs => sendResponse({ success: true, tabs }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep channel open for async response
    }
});
```

### 1.1 Create Content Script Tab Fetching Utility

Create `src/contents/write-command/utils/fetchTabs.ts`:

```typescript
/**
 * Fetch all tabs via message to background script
 * Content scripts cannot access chrome.tabs API directly
 */
export async function fetchTabsFromBackground(): Promise<chrome.tabs.Tab[]> {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'GET_ALL_TABS' }, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            if (response?.success) {
                resolve(response.tabs);
            } else {
                reject(new Error(response?.error || 'Failed to fetch tabs'));
            }
        });
    });
}
```

### 1.2 Create Writer-Specific Tab Dropdown Component

Since the existing `TabMentionDropdown` uses `getAllTabs()` directly (which won't work in content scripts), create a content-script-compatible version.

Create `src/contents/write-command/WriterTabDropdown.tsx`:

```typescript
/**
 * Tab mention dropdown for Writer Overlay (content script context)
 * Uses message passing to fetch tabs from background script
 */
import React, { useEffect, useState } from 'react';
import { fetchTabsFromBackground } from './utils/fetchTabs';
import { extractMentions } from '@/utils/chat';

interface WriterTabDropdownProps {
    searchQuery: string;
    onSelectTab: (tab: chrome.tabs.Tab) => void;
    onClose: () => void;
    position?: { top: number; left: number };
    currentInput?: string;
}

export function WriterTabDropdown({
    searchQuery,
    onSelectTab,
    onClose,
    position,
    currentInput = ''
}: WriterTabDropdownProps) {
    const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load tabs via background message
    useEffect(() => {
        let mounted = true;

        const loadTabs = async () => {
            try {
                setLoading(true);
                setError(null);
                const allTabs = await fetchTabsFromBackground();
                if (mounted) {
                    setTabs(allTabs);
                }
            } catch (err) {
                console.error('Failed to load tabs:', err);
                if (mounted) {
                    setError('Failed to load tabs');
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        loadTabs();
        return () => { mounted = false; };
    }, []);

    // ... rest of component (filtering, keyboard nav, rendering)
    // Similar to TabMentionDropdown but self-contained for content script
}
```

### 1.3 Update WriterOverlay.tsx State

Add new state and refs for mention handling:

```typescript
// New state for mention dropdown
const [showMentionDropdown, setShowMentionDropdown] = useState(false);
const [mentionSearchQuery, setMentionSearchQuery] = useState('');
const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
```

### 1.4 Import Dependencies

```typescript
import { WriterTabDropdown } from './WriterTabDropdown';
import {
    isMentionTrigger,
    formatTabMention,
    insertMentionAtCursor
} from '@/utils/chat';
```

### 1.5 Handle Input Changes

Modify the input onChange handler to detect @ triggers:

```typescript
const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setPrompt(newValue);

    const cursorPos = e.target.selectionStart || 0;
    const trigger = isMentionTrigger(newValue, cursorPos, '@');

    if (trigger.isTrigger) {
        setMentionSearchQuery(trigger.searchQuery);
        setShowMentionDropdown(true);
        updateDropdownPosition();
    } else {
        setShowMentionDropdown(false);
    }
};
```

### 1.6 Dropdown Position Calculation

```typescript
const updateDropdownPosition = () => {
    if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        setDropdownPosition({
            top: rect.top - 10,  // Position above input
            left: rect.left
        });
    }
};
```

### 1.7 Tab Selection Handler

```typescript
const handleSelectTab = (tab: chrome.tabs.Tab) => {
    if (!inputRef.current || !tab.id) return;

    const cursorPos = inputRef.current.selectionStart || 0;
    const mentionText = formatTabMention(
        tab.title || 'Untitled',
        tab.id,
        tab.favIconUrl
    );
    const { newText, newCursorPosition } = insertMentionAtCursor(
        prompt,
        cursorPos,
        mentionText,
        '@'
    );

    setPrompt(newText);
    setShowMentionDropdown(false);

    // Restore focus and cursor
    setTimeout(() => {
        if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
        }
    }, 0);
};
```

### 1.8 Render Dropdown

Add to component JSX (using the content-script-compatible dropdown):

```tsx
{showMentionDropdown && (
    <WriterTabDropdown
        searchQuery={mentionSearchQuery}
        onSelectTab={handleSelectTab}
        onClose={() => setShowMentionDropdown(false)}
        position={dropdownPosition}
        currentInput={prompt}
    />
)}
```

### Files Modified in Phase 1
- `src/background/messaging/router.ts` (or new handler file) - Add GET_ALL_TABS handler
- `src/contents/write-command/utils/fetchTabs.ts` (NEW) - Tab fetching via message
- `src/contents/write-command/WriterTabDropdown.tsx` (NEW) - Content-script dropdown
- `src/contents/write-command/WriterOverlay.tsx` - Add dropdown, state, handlers

---

## Phase 2: Keyboard Navigation & UX Polish

**Objective**: Ensure smooth keyboard navigation and prevent conflicts.

### 2.1 Update Keyboard Handler

Modify the Enter key handling to not submit when dropdown is open:

```typescript
// In useEffect for keyboard shortcuts
const handleKeyDown = (e: KeyboardEvent) => {
    if (!overlayRef.current?.contains(document.activeElement)) return;

    if (e.key === 'Enter' && !e.shiftKey) {
        // Don't submit if mention dropdown is showing
        if (showMentionDropdown) {
            return; // Let dropdown handle it
        }
        
        e.preventDefault();
        if (prompt.trim() && !isGenerating) {
            handleGenerate();
        }
    }
    // ... rest of handler
};
```

### 2.2 Close Dropdown on Outside Click

Add effect to handle clicking outside:

```typescript
useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
        if (showMentionDropdown && 
            inputRef.current && 
            !inputRef.current.contains(e.target as Node)) {
            setShowMentionDropdown(false);
        }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
}, [showMentionDropdown]);
```

### 2.3 Update Placeholder Text

```tsx
placeholder="What would you like me to write? (@ to mention tabs)"
```

### Files Modified in Phase 2
- `src/contents/write-command/WriterOverlay.tsx`

---

## Phase 3: Tab Context Processing & API Integration

**Objective**: Process mentioned tabs and send context to Gemini Writer.

### 3.1 Update Type Definitions

In `src/types/writeCommand.ts`:

```typescript
export interface WriteGenerateRequest {
    action: 'WRITE_GENERATE';
    payload: {
        prompt: string;
        pageContext?: WritePageContext;
        settings?: {
            tone?: WriteTone;
            maxTokens?: number;
            enableUrlContext?: boolean;
            enableGoogleSearch?: boolean;
            enableSupermemorySearch?: boolean;
        };
        // NEW: Tab mention context
        tabContext?: string;
    };
}
```

### 3.2 Process Tab Mentions Before Sending

In `write-command.tsx` handleGenerate:

```typescript
import { extractMentions } from '@/utils/chat';
import { processMentionedTabs } from '@/utils/tabs';

const handleGenerate = useCallback(async (
    prompt: string,
    toolSettings?: { /* ... */ }
) => {
    // ... existing setup code ...

    // Extract and process tab mentions
    const { tabMentions } = extractMentions(prompt);
    let tabContext: string | undefined;
    
    if (tabMentions.length > 0) {
        log.debug('Processing tab mentions', { count: tabMentions.length });
        tabContext = await processMentionedTabs(tabMentions);
    }

    // Build request with tab context
    const request: WriteGenerateRequest = {
        action: 'WRITE_GENERATE',
        payload: {
            prompt,
            pageContext: settings.includePageContext ? pageContext : undefined,
            settings: { /* ... */ },
            tabContext,  // NEW
        },
    };

    port.postMessage(request);
}, []);
```

### 3.3 Update Background Handler

In `src/background/writer/handler.ts`:

```typescript
export async function handleWriteGenerate(
    request: WriteGenerateRequest,
    port: chrome.runtime.Port
): Promise<void> {
    const { prompt, pageContext, settings, tabContext } = request.payload;

    log.info('Processing write request', {
        promptLength: prompt.length,
        hasTabContext: !!tabContext,
        tabContextLength: tabContext?.length,
    });

    // Build enhanced prompt with tab context
    let enhancedPrompt = prompt;
    if (tabContext) {
        enhancedPrompt = `${prompt}\n\n---\nReferenced Tab Content:\n${tabContext}`;
    }

    // Pass to writer with hasTabContext flag for system prompt adjustment
    const options: WriterOptions = {
        // ... existing options
        hasTabContext: !!tabContext,  // NEW: Flag for system prompt
    };

    const text = await geminiWriter.generate(enhancedPrompt, options);
    
    // ... rest of handler
}
```

### 3.4 Update WriterOptions Interface

In `src/background/writer/geminiWriter.ts`:

```typescript
export interface WriterOptions {
    tone?: WriteTone;
    maxTokens?: number;
    pageContext?: WritePageContext;
    enableUrlContext?: boolean;
    enableGoogleSearch?: boolean;
    enableSupermemorySearch?: boolean;
    // NEW: Tab context flag
    hasTabContext?: boolean;  // Indicates tab mentions are present
}
```

### 3.5 Update System Prompt for Tab Context

In `src/background/writer/geminiWriter.ts`, modify `buildSystemPrompt()`:

```typescript
private buildSystemPrompt(options?: WriterOptions): string {
    const platform = options?.pageContext?.platform || 'Web';
    const tone = options?.tone || 'professional';

    const platformInstruction = PLATFORM_INSTRUCTIONS[platform] || PLATFORM_INSTRUCTIONS['Web'];
    const toneInstruction = TONE_INSTRUCTIONS[tone];

    let contextInfo = '';
    if (options?.pageContext) {
        contextInfo = `\n\nContext: Writing on ${options.pageContext.domain}`;
        if (options.pageContext.title) {
            contextInfo += ` - Page: "${options.pageContext.title}"`;
        }
        if (options.pageContext.fieldType) {
            contextInfo += ` - Field type: ${options.pageContext.fieldType}`;
        }
    }

    // NEW: Tab context instructions
    let tabContextInstructions = '';
    if (options?.hasTabContext) {
        tabContextInstructions = `

## Referenced Tab Content
The user has mentioned specific browser tabs using @mentions. The content from these tabs is provided below the user's request, marked as "Referenced Tab Content".

When using referenced tab content:
- Use the tab content as context and source material for your writing
- You can quote, summarize, or draw information from the referenced content
- If the user asks to summarize or analyze the tab, focus on that content
- If the user asks to write something "based on" or "using" the tab, incorporate relevant information
- Reference specific details from the tabs when relevant to the request
- If a tab's content couldn't be extracted (shows an error), acknowledge this limitation`;
    }

    return `You are a helpful writing assistant. Generate content based on the user's request.

${platformInstruction}

${toneInstruction}
${contextInfo}
${tabContextInstructions}

Important guidelines:
- Output ONLY the requested content itself with no preamble, introduction, or meta-commentary
- Do NOT add phrases like "Here is...", "Here's...", "Sure, here's...", etc.
- Start directly with the actual content
- BE CONCISE by default - keep responses brief and to the point unless the user explicitly asks for detailed, long, or comprehensive content
- For most requests, aim for 1-3 short paragraphs or less
- Only write longer content when specifically asked (e.g., "write a detailed...", "explain thoroughly...", "comprehensive guide...")
- Match the appropriate length for the platform (tweets should be short, emails moderate, articles can be longer if requested)
- Be accurate and don't make up facts
- If the request is unclear, provide a reasonable interpretation
- Format appropriately for the context (e.g., markdown for GitHub, plain text for emails)`;
}
```

### Files Modified in Phase 3
- `src/types/writeCommand.ts`
- `src/contents/write-command.tsx`
- `src/background/writer/handler.ts`
- `src/background/writer/geminiWriter.ts` (WriterOptions + buildSystemPrompt)

---

## Phase 4: Styling & CSS Updates

**Objective**: Add styles for the mention dropdown in Writer Overlay context.

### 4.1 Add Dropdown Styles to write-command.css

The `TabMentionDropdown` component already has styles from the sidepanel CSS. We need to ensure they work in the content script context.

```css
/* Writer Overlay - Tab Mention Dropdown */
.writer-overlay .tab-mention-dropdown {
    position: fixed;
    z-index: 2147483648; /* Above overlay */
    
    min-width: 280px;
    max-width: 400px;
    max-height: 300px;
    
    background: rgba(30, 30, 30, 0.98);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    
    box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.4),
        0 0 0 1px rgba(255, 255, 255, 0.05);
    
    overflow: hidden;
}

.writer-overlay .tab-mention-list {
    max-height: 280px;
    overflow-y: auto;
    padding: 4px;
}

.writer-overlay .tab-mention-item {
    display: flex;
    align-items: center;
    gap: 10px;
    
    width: 100%;
    padding: 10px 12px;
    
    background: transparent;
    border: none;
    border-radius: 8px;
    
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
    text-align: left;
    
    cursor: pointer;
    transition: background 0.15s ease;
}

.writer-overlay .tab-mention-item:hover,
.writer-overlay .tab-mention-item.selected {
    background: rgba(139, 92, 246, 0.15);
}

.writer-overlay .tab-mention-item.disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.writer-overlay .tab-mention-favicon {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    
    display: flex;
    align-items: center;
    justify-content: center;
}

.writer-overlay .tab-mention-favicon img {
    width: 14px;
    height: 14px;
    border-radius: 2px;
}

.writer-overlay .tab-mention-info {
    flex: 1;
    min-width: 0;
    overflow: hidden;
}

.writer-overlay .tab-mention-title {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.writer-overlay .tab-mention-url {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.writer-overlay .tab-mention-loading,
.writer-overlay .tab-mention-empty {
    padding: 16px;
    text-align: center;
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
}

.writer-overlay .already-mentioned-badge {
    font-size: 10px;
    color: #a78bfa;
    margin-left: 4px;
}
```

### Files Modified in Phase 4
- `src/styles/features/write-command.css`

---

## Phase 5: Testing & Edge Cases

**Objective**: Ensure robust handling of edge cases.

### 5.1 Edge Cases to Handle

| Scenario | Expected Behavior |
|----------|-------------------|
| Tab closed after mention | Show error in context, don't fail generation |
| Restricted URL (chrome://) | Show warning, skip content extraction |
| Multiple tab mentions | Process all, concatenate context |
| Tab mention mid-sentence | Insert properly, maintain cursor |
| Long tab titles | Truncate display, preserve full ID |
| Dropdown while generating | Dropdown should be disabled |
| Empty search query | Show all available tabs |

### 5.2 Test Scenarios

1. **Basic mention flow**
   - Type `@` → See dropdown
   - Select tab → Mention inserted
   - Generate → Tab content included

2. **Keyboard navigation**
   - Arrow keys to navigate dropdown
   - Enter to select
   - Escape to close dropdown

3. **Multiple mentions**
   - Mention Tab A, then Tab B
   - Both should be processed

4. **Error handling**
   - Mention a tab, close it, then generate
   - Should show error for closed tab

### 5.3 Validation Checklist

- [ ] Dropdown appears on `@` keystroke
- [ ] Dropdown filters tabs correctly
- [ ] Tab selection inserts mention properly
- [ ] Enter key behavior correct (dropdown open vs closed)
- [ ] Click outside closes dropdown
- [ ] Generated content includes tab context
- [ ] Error states handled gracefully
- [ ] Styling matches overlay theme

---

## Phase 6: Optional Enhancements

**Objective**: Future improvements (not required for initial release).

### 6.1 Visual Mention Rendering
Currently mentions display as raw `@[Title|favicon](id)` text. Consider:
- Rich text rendering with styled mention chips
- Inline favicon display

### 6.2 Screenshot Context
The `captureTabSnapshot` function can capture screenshots. Consider:
- Including screenshot data for Gemini multimodal input
- Showing screenshot preview in dropdown

### 6.3 Context Length Indicator
- Show character/token count with tab context
- Warn when context is large

---

## Implementation Order

| Phase | Estimated Time | Dependencies |
|-------|----------------|--------------|
| Phase 1 | 2-3 hours | None |
| Phase 2 | 1 hour | Phase 1 |
| Phase 3 | 2 hours | Phase 1, 2 |
| Phase 4 | 1 hour | Phase 1 |
| Phase 5 | 2 hours | All previous |
| Phase 6 | Optional | All previous |

**Total Estimated Time**: 8-10 hours (excluding Phase 6)

---

## Files Summary

### Files to Create (NEW)
| File | Purpose |
|------|---------|
| `src/contents/write-command/utils/fetchTabs.ts` | Fetch tabs via message to background (content script can't access chrome.tabs) |
| `src/contents/write-command/WriterTabDropdown.tsx` | Tab dropdown component for content script context |

### Files to Modify
| File | Changes |
|------|---------|
| `src/background/messaging/router.ts` | Add `GET_ALL_TABS` message handler |
| `src/contents/write-command/WriterOverlay.tsx` | Add dropdown, state, handlers |
| `src/contents/write-command.tsx` | Process tab mentions before sending |
| `src/types/writeCommand.ts` | Add `tabContext` to payload |
| `src/background/writer/handler.ts` | Include tab context in prompt, pass flag to writer |
| `src/background/writer/geminiWriter.ts` | Add `hasTabContext` to WriterOptions, update `buildSystemPrompt()` with tab context instructions |
| `src/styles/features/write-command.css` | Dropdown styling |

### Files Reused (No Changes)
| File | Purpose |
|------|---------|
| `src/utils/chat/mentionUtils.ts` | Mention utilities (isMentionTrigger, formatTabMention, etc.) |
| `src/utils/tabs/tabSnapshot.ts` | Tab content capture (processMentionedTabs) - called from background |

**Note**: `TabMentionDropdown.tsx` is NOT reused because it directly calls `getAllTabs()` which uses `chrome.tabs.query()` - this API is unavailable in content scripts. Instead, we create `WriterTabDropdown.tsx` that fetches tabs via message passing to the background script.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Content script can't access `chrome.tabs` API | ✅ Use `chrome.runtime.sendMessage` to background script with `GET_ALL_TABS` handler. Create `WriterTabDropdown` component that fetches tabs via message passing instead of reusing `TabMentionDropdown`. |
| Content script can't call `processMentionedTabs` directly | Tab context processing happens in `write-command.tsx` which sends data to background. Background script can access all Chrome APIs. |
| Large tab content bloats context | Truncate snapshot content (already implemented in `tabSnapshot.ts`) |
| Dropdown z-index conflicts | Use max z-index (2147483648, above overlay's 2147483647) |
| Performance with many tabs | Lazy load, limit displayed tabs, filter quickly |
| Shadow DOM styling issues | Scope CSS to `.writer-overlay` prefix |

---

## Success Criteria

1. ✅ User can type `@` in Writer Overlay to see tab dropdown
2. ✅ User can select tabs using keyboard or mouse
3. ✅ Selected tab appears as mention in input
4. ✅ Generated content uses tab page content as context
5. ✅ Error handling for closed/restricted tabs works
6. ✅ UI matches existing Writer Overlay design
7. ✅ No regression in existing Writer Overlay functionality
