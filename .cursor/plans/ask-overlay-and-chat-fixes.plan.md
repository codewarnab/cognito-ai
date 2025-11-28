# Ask Overlay & Chat Panel Fixes Plan

This document outlines the issues identified in the Ask Overlay and Chat Panel components, along with detailed fix plans for each issue.

---

## Issue 1: Tools Section UI Shows White Background in Ask Overlay

### ✅ STATUS: FIXED (2025-11-28)

**Fix Applied:** Added missing `.tools-toggle-*` CSS styles to `src/styles/features/ask-command.css` (appended at end of file).

The `ToolsToggle` component uses generic class names (`.tools-toggle-*`) but only `.ask-tools-toggle-*` variants existed in the CSS. Added all required styles including container, trigger, badge, chevron, panel, items, switches, and state modifiers.

---

### Problem (Original)
The tools section (`.ask-tools-row`) in the Ask Overlay does not have proper styling. The `ToolsToggle` component imported from `../shared/ToolsToggle` uses CSS classes like `.tools-toggle-container`, `.tools-toggle-trigger`, `.tools-toggle-panel`, etc., but these styles are NOT defined in `src/styles/features/ask-command.css`.

The ask-command.css file has `.ask-tools-toggle-*` variants defined (lines 698-795), but the actual `ToolsToggle` component uses `.tools-toggle-*` class names without the `ask-` prefix.

### Root Cause
- The `ToolsToggle` component at `src/contents/shared/ToolsToggle.tsx` uses generic class names (`.tools-toggle-*`)
- The CSS file `src/styles/features/ask-command.css` defines `.ask-tools-toggle-*` classes
- There's a mismatch between the component's class names and the CSS selectors

### Files to Modify
1. `src/contents/shared/ToolsToggle.tsx` - Update class names to use `ask-` prefix when used in Ask Overlay context
   
   **OR**
   
2. `src/styles/features/ask-command.css` - Add styles for `.tools-toggle-*` classes (without `ask-` prefix)

### Recommended Fix
**Option A (Preferred):** Add the missing `.tools-toggle-*` styles to `ask-command.css`:

```css
/* Add after line 795 in ask-command.css */

/* ============================================
   Tools Toggle - Generic Styles for Ask Command
   ============================================ */

.tools-toggle-container {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.tools-toggle-trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
}

.tools-toggle-trigger:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.8);
}

.tools-toggle-trigger--active {
    background: rgba(96, 165, 250, 0.1);
    border-color: rgba(96, 165, 250, 0.2);
    color: #60a5fa;
}

.tools-toggle-trigger--expanded {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    border-bottom-color: transparent;
}

.tools-toggle-trigger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.tools-toggle-label {
    font-size: 11px;
}

.tools-toggle-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    background: #60a5fa;
    border-radius: 8px;
    color: white;
    font-size: 10px;
    font-weight: 600;
}

.tools-toggle-chevron {
    display: flex;
    align-items: center;
    transition: transform 0.15s ease;
}

.tools-toggle-chevron--rotated {
    transform: rotate(180deg);
}

.tools-toggle-panel {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-top: none;
    border-radius: 0 0 8px 8px;
}

.tools-toggle-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s ease;
}

.tools-toggle-item:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.8);
}

.tools-toggle-item--active {
    color: rgba(255, 255, 255, 0.9);
}

.tools-toggle-item--active .tools-toggle-item-icon {
    color: #60a5fa;
}

.tools-toggle-item--gated {
    opacity: 0.6;
}

.tools-toggle-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.tools-toggle-item-icon {
    display: flex;
    align-items: center;
    color: rgba(255, 255, 255, 0.5);
}

.tools-toggle-item-label {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 4px;
}

.tools-toggle-item-warning {
    color: #f59e0b;
}

.tools-toggle-item-info {
    display: flex;
    align-items: center;
    color: rgba(255, 255, 255, 0.3);
    cursor: help;
}

.tools-toggle-item-switch {
    width: 28px;
    height: 16px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    position: relative;
    transition: background 0.15s ease;
}

.tools-toggle-item-switch--on {
    background: #60a5fa;
}

.tools-toggle-item-switch-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 12px;
    height: 12px;
    background: white;
    border-radius: 50%;
    transition: transform 0.15s ease;
}

.tools-toggle-item-switch--on .tools-toggle-item-switch-thumb {
    transform: translateX(12px);
}
```

---

## Issue 2: Ask Chat Panel Does Not Render Markdown

### ✅ STATUS: FIXED (2025-11-28)

**Fix Applied:** Updated `src/contents/ask-command/AskMessageBubble.tsx` to use ReactMarkdown with `remark-gfm` and `remark-breaks` plugins for assistant messages. Added custom components for links (open in new tab) and code blocks. Added comprehensive CSS styles for markdown elements in `src/styles/features/ask-command.css`.

---

### Problem (Original)
The `AskMessageBubble` component at `src/contents/ask-command/AskMessageBubble.tsx` renders message content as plain text using `{content}` directly in JSX. The AI returns Markdown-formatted responses, but they are displayed as raw text without formatting.

### Root Cause
- The main chat panel (`ChatMessages.tsx`) uses `ReactMarkdown` with `remark-gfm`, `remark-breaks`, and `rehype-highlight` plugins
- The `AskMessageBubble` component does not use any Markdown rendering library
- Line 62 in `AskMessageBubble.tsx`: `{content}` renders plain text

### Files to Modify
1. `src/contents/ask-command/AskMessageBubble.tsx` - Add Markdown rendering for assistant messages

### Recommended Fix
Import and use a lightweight Markdown renderer for the Ask Overlay. Since this is a content script, we need to be mindful of bundle size.

**Option A (Lightweight):** Use `marked` library for simple Markdown parsing:

```tsx
// In AskMessageBubble.tsx
import { marked } from 'marked';

// Configure marked for safe rendering
marked.setOptions({
    breaks: true,
    gfm: true,
});

// In the component, for assistant messages:
<div 
    className="ask-message-content"
    dangerouslySetInnerHTML={{ 
        __html: isUser ? content : marked.parse(content || '') 
    }}
/>
```

**Option B (Consistent with main chat):** Use ReactMarkdown (larger bundle but consistent):

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

// In the component:
<div className="ask-message-content">
    {isUser ? (
        content
    ) : (
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
            {content || ''}
        </ReactMarkdown>
    )}
    {isStreaming && <span className="ask-cursor">▌</span>}
</div>
```

**Additional CSS needed** in `ask-command.css` for Markdown elements:

```css
/* Markdown content styles for Ask Overlay */
.ask-message--assistant .ask-message-content p {
    margin: 0 0 8px;
}

.ask-message--assistant .ask-message-content p:last-child {
    margin-bottom: 0;
}

.ask-message--assistant .ask-message-content code {
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 13px;
}

.ask-message--assistant .ask-message-content pre {
    background: rgba(0, 0, 0, 0.3);
    padding: 12px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 8px 0;
}

.ask-message--assistant .ask-message-content pre code {
    background: none;
    padding: 0;
}

.ask-message--assistant .ask-message-content ul,
.ask-message--assistant .ask-message-content ol {
    margin: 8px 0;
    padding-left: 20px;
}

.ask-message--assistant .ask-message-content li {
    margin: 4px 0;
}

.ask-message--assistant .ask-message-content a {
    color: #60a5fa;
    text-decoration: none;
}

.ask-message--assistant .ask-message-content a:hover {
    text-decoration: underline;
}

.ask-message--assistant .ask-message-content strong {
    font-weight: 600;
}

.ask-message--assistant .ask-message-content em {
    font-style: italic;
}

.ask-message--assistant .ask-message-content blockquote {
    border-left: 3px solid rgba(96, 165, 250, 0.5);
    margin: 8px 0;
    padding-left: 12px;
    color: rgba(255, 255, 255, 0.7);
}
```

---

## Issue 3: Enter Key Does Not Send Message in Ask Overlay

### ✅ STATUS: FIXED (2025-11-28)

**Fix Applied:** Added `handleSubmitQuestion` to the dependency array of the keyboard handler `useEffect` in `src/contents/ask-command/AskOverlay.tsx`. The callback was being captured as a stale reference because it wasn't included in the dependencies.

---

### Problem (Original)
When typing in the Ask Overlay input and pressing Enter, the message is not sent. Users must click the send button icon to submit.

### Root Cause
Looking at `AskOverlay.tsx` lines 186-196, there IS a keyboard handler for Enter:

```tsx
useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (!overlayRef.current?.contains(document.activeElement)) return;

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if ((question.trim() || attachment) && !isGenerating) {
                handleSubmitQuestion();
            }
        }
        // ...
    };
    window.addEventListener('keydown', handleKeyDown);
    // ...
}, [question, attachment, isGenerating, onClose]);
```

**The issue:** The `handleSubmitQuestion` function is NOT in the dependency array of the `useEffect`. This means the callback captures a stale reference to `handleSubmitQuestion`.

### Files to Modify
1. `src/contents/ask-command/AskOverlay.tsx` - Fix the useEffect dependency array

### Recommended Fix
Add `handleSubmitQuestion` to the dependency array:

```tsx
// Line 186-205 in AskOverlay.tsx
useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (!overlayRef.current?.contains(document.activeElement)) return;

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if ((question.trim() || attachment) && !isGenerating) {
                handleSubmitQuestion();
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
}, [question, attachment, isGenerating, onClose, handleSubmitQuestion]); // Add handleSubmitQuestion
```

**Alternative approach:** Use the input's `onKeyDown` directly instead of a window listener:

```tsx
<input
    ref={inputRef}
    type="text"
    className="ask-input"
    value={question}
    onChange={(e) => setQuestion(e.target.value)}
    onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if ((question.trim() || attachment) && !isGenerating) {
                handleSubmitQuestion();
            }
        }
    }}
    placeholder={attachment ? 'Ask about this file...' : 'Ask a question...'}
    disabled={isGenerating}
    autoComplete="off"
/>
```

---

## Issue 4: Attachment Preview Uses Generic File Icon Instead of File Type Icons

### ✅ STATUS: FIXED (2025-11-28)

**Fix Applied:** Updated `src/contents/ask-command/AskAttachmentPreview.tsx` to import and use `getFileIcon` from `@/utils/files/fileIconMapper` instead of the inline generic `FileIcon` SVG component. Now file attachments display proper file type-specific icons (PDF, code files, images, etc.).

---

### Problem (Original)
When attaching files (PDF, images, etc.) in the Ask Overlay, the attachment preview shows a generic file icon instead of using the file type-specific icons that are already mapped in the codebase.

### Root Cause
The `AskAttachmentPreview.tsx` component defines its own inline `FileIcon` SVG component (lines 16-22) instead of using the `getFileIcon` utility from `@/utils/files/fileIconMapper.tsx`.

### Files to Modify
1. `src/contents/ask-command/AskAttachmentPreview.tsx` - Use the `getFileIcon` utility

### Recommended Fix
Replace the inline `FileIcon` with the `getFileIcon` utility:

```tsx
// src/contents/ask-command/AskAttachmentPreview.tsx

import React from 'react';
import type { AskAttachment } from '@/types';
import { formatFileSize } from './askAttachmentUtils';
import { getFileIcon } from '@/utils/files'; // Add this import

// Remove the inline FileIcon component (lines 16-22)

// Update the render (around line 42):
export function AskAttachmentPreview({ attachment, onRemove, disabled }: AskAttachmentPreviewProps) {
    const isImage = attachment.type === 'image';

    return (
        <div className="ask-attachment-preview">
            {isImage && attachment.preview ? (
                <img
                    src={attachment.preview}
                    alt={attachment.file.name}
                    className="ask-attachment-thumbnail"
                />
            ) : (
                <div className="ask-attachment-icon">
                    {getFileIcon(attachment.file.name, 24)}
                </div>
            )}
            {/* ... rest of component */}
        </div>
    );
}
```

---

## Issue 5: Disabled Tools Icon Needs Tooltip Explanation

### ✅ STATUS: FIXED (2025-11-28)

**Fix Applied:** Wrapped the tools button in `Composer.tsx` with the `Tooltip` component from `@/components/ui/primitives`. The tooltip displays contextual messages explaining why tools are disabled (search mode active, workflow managing tools) or warnings (too many tools enabled). Removed the redundant `title` attribute since the Tooltip provides better UX with styled appearance and proper positioning.

---

## Issue 6: Plus Icon Should Be Hidden When Web Search Is Selected

### ✅ STATUS: FIXED (2025-11-28)

**Fix Applied:** Wrapped the plus icon button and attachment dropdown in conditional renders that check `!isSearchActive`. When web search mode is active, the attachment button is now hidden since attachments are not supported in search mode.

---

### Problem (Original)
When the user selects web search mode, the plus icon (attachment button) in the chat input should be hidden since attachments are not supported in search mode.

### Root Cause
In `Composer.tsx`, the plus icon button is only disabled for `isLocalMode` but not hidden when `isSearchActive`:

```tsx
<button
    type="button"
    className={`copilot-action-button ${isLocalMode ? 'disabled' : ''}`}
    title={isLocalMode ? 'Switch to Cloud mode to use attachments' : 'Attach file or screenshot'}
    // ...
>
```

### Files to Modify
1. `src/components/features/chat/components/composer/Composer.tsx` - Hide plus icon when search mode is active

### Recommended Fix
Conditionally render the plus icon button based on search mode:

```tsx
// Around line 295-315 in Composer.tsx
{/* Plus Icon - Attachment Options - Hidden in search mode */}
{!isSearchActive && (
    <button
        type="button"
        className={`copilot-action-button ${isLocalMode ? 'disabled' : ''}`}
        title={isLocalMode ? 'Switch to Cloud mode to use attachments' : 'Attach file or screenshot'}
        tabIndex={-1}
        aria-disabled={isLocalMode}
        onClick={(e) => {
            e.stopPropagation();
            if (isLocalMode) {
                return;
            }
            setShowAttachmentDropdown(!showAttachmentDropdown);
        }}
        onMouseEnter={() => {
            if (!isLocalMode) plusIconRef.current?.startAnimation();
        }}
        onMouseLeave={() => {
            if (!isLocalMode) plusIconRef.current?.stopAnimation();
        }}
    >
        <PlusIcon ref={plusIconRef} size={16} />
    </button>
)}

{/* Attachment Dropdown - Also hide in search mode */}
{showAttachmentDropdown && !isSearchActive && (
    <AttachmentDropdown
        // ...
    />
)}
```

---

## Issue 7: Model Picker Icon Should Be More Minimal

### ✅ STATUS: FIXED (2025-11-28)

**Fix Applied:** Updated `src/styles/features/copilot/model-selector-popover.css` to make the model selector button more minimal:
- Reduced button size from 28x28px to 26x26px with 6px border-radius (not circular)
- Removed background and border for cleaner look
- Set default opacity to 0.6, increasing to 1 on hover
- Reduced icon size from 18x18px to 16x16px
- Added subtle hover background (rgba(255, 255, 255, 0.06))
- Faster transition (0.15s instead of 0.2s)

---

## Issue 8: Remove Flash Lite Model and Add Gemini 3.0 Pro

### Problem
The model selector includes "Gemini 2.5 Flash Lite" which should be removed, and "Gemini 3.0 Pro" should be added instead.

### Root Cause
The `MODEL_OPTIONS` array in `ModelSelectorPopover.tsx` has outdated model options.

### Files to Modify
1. `src/components/features/chat/components/composer/ModelSelectorPopover.tsx` - Update MODEL_OPTIONS array
2. `src/ai/types/types.ts` (if exists) - Update RemoteModelType to include new model

### Recommended Fix
Update the MODEL_OPTIONS array:

```tsx
// In ModelSelectorPopover.tsx

const MODEL_OPTIONS: ModelOption[] = [
    {
        id: 'gemini-3.0-pro',
        name: 'Gemini 3.0 Pro',
        description: 'Latest and most capable model',
    },
    {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        description: 'Highly capable for complex tasks',
    },
    {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: 'Fast and efficient for most tasks',
    },
    // Remove gemini-2.5-flash-lite
];
```

**Also update the type definition** (search for `RemoteModelType`):

```typescript
export type RemoteModelType = 
    | 'gemini-3.0-pro'
    | 'gemini-2.5-pro' 
    | 'gemini-2.5-flash';
```

**Note:** Ensure the new model ID matches the actual API model identifier. Verify with the Gemini API documentation.

---

## Issue 9: Add "Ask" Option to Context Menu

### ✅ STATUS: FIXED (2025-11-28)

**Fix Applied:** Created `src/background/contextMenu/askerContextMenu.ts` following the same pattern as `rewriterContextMenu.ts`. The context menu item "Ask Cognito AI about '%s'" appears when text is selected. Updated `src/contents/ask-command.tsx` to listen for `SHOW_ASKER` messages from the background script and open the Ask overlay with the selected text pre-filled as an initial question. The overlay positions itself near the selection.

---

### Problem (Original)
The "Ask" feature is not available in the browser's right-click context menu. Users should be able to select text on any webpage and right-click to quickly ask the AI about the selected content.

### Root Cause
The context menu registration in `src/background/contextMenu/` does not include an "Ask" option. Currently, there may be options for "Summarize", "Rewrite", etc., but "Ask" is missing.

### Files to Modify
1. `src/background/contextMenu/` - Add "Ask" menu item registration
2. `src/background/contextMenu/handlers.ts` (or similar) - Add handler for Ask context menu action
3. `src/background/messaging/` - Handle the Ask context menu message

### Recommended Fix

**Step 1:** Register the context menu item in the background script:

```typescript
// In context menu registration file (e.g., contextMenu/index.ts or contextMenu/register.ts)

chrome.contextMenus.create({
    id: 'ask-ai',
    title: 'Ask AI about "%s"',
    contexts: ['selection'],
});
```

**Step 2:** Handle the context menu click:

```typescript
// In context menu handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'ask-ai' && info.selectionText && tab?.id) {
        // Option A: Open Ask Overlay with selected text
        chrome.tabs.sendMessage(tab.id, {
            type: 'OPEN_ASK_OVERLAY',
            payload: {
                selectedText: info.selectionText,
                position: { x: 100, y: 100 }, // Default position or calculate from click
            },
        });
        
        // Option B: Open sidepanel with pre-filled question
        // chrome.sidePanel.open({ tabId: tab.id });
        // chrome.runtime.sendMessage({
        //     type: 'ASK_ABOUT_SELECTION',
        //     text: info.selectionText,
        // });
    }
});
```

**Step 3:** Handle the message in the content script:

```typescript
// In src/contents/ask-command.tsx or a message handler

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'OPEN_ASK_OVERLAY') {
        const { selectedText, position } = message.payload;
        // Open the Ask overlay with the selected text pre-filled
        openAskOverlay({
            initialQuestion: `What does this mean: "${selectedText}"`,
            position,
        });
        sendResponse({ success: true });
    }
    return true;
});
```

**Step 4:** Update manifest permissions if needed:

```json
// In manifest.json (if not already present)
{
    "permissions": ["contextMenus"]
}
```

### Context Menu Structure
Consider grouping AI features under a parent menu:

```typescript
// Parent menu
chrome.contextMenus.create({
    id: 'gemini-assistant',
    title: 'Gemini Assistant',
    contexts: ['selection'],
});

// Child menus
chrome.contextMenus.create({
    id: 'ask-ai',
    parentId: 'gemini-assistant',
    title: 'Ask about this',
    contexts: ['selection'],
});

chrome.contextMenus.create({
    id: 'summarize',
    parentId: 'gemini-assistant',
    title: 'Summarize',
    contexts: ['selection'],
});

chrome.contextMenus.create({
    id: 'rewrite',
    parentId: 'gemini-assistant',
    title: 'Rewrite',
    contexts: ['selection'],
});
```

---

## Issue 10: Add "Write" Option to Context Menu with Conditional Insert Button

### ✅ STATUS: FIXED (2025-11-28)

**Fix Applied:** Created `src/background/contextMenu/writerContextMenu.ts` following the same pattern as `rewriterContextMenu.ts` and `askerContextMenu.ts`. The context menu item "Write with Cognito AI" appears when text is selected or in editable fields. Updated `src/contents/write-command.tsx` to listen for `SHOW_WRITER` messages from the background script and open the Writer overlay with the selected text pre-filled. The `WriterOverlay` component now accepts `hasInsertionTarget` and `initialPrompt` props - when opened from context menu on non-editable content, the Insert button is hidden (only Copy and Regenerate are shown).

---

### Problem (Original)
The "Write" feature should be available in the browser's right-click context menu. However, when Write is opened from the context menu (not from an input field), the "Insert" button should be hidden since there's no target input field to insert the generated text into.

### Root Cause
1. The context menu does not include a "Write" option
2. The Write overlay always shows the "Insert" button regardless of whether there's a valid insertion target

### Files to Modify
1. `src/background/contextMenu/` - Add "Write" menu item registration
2. `src/contents/write-command.tsx` or `src/contents/write-command/WriteOverlay.tsx` - Track insertion context
3. Write overlay component - Conditionally render Insert button based on context

### Recommended Fix

**Step 1:** Register the Write context menu item:

```typescript
// In context menu registration
chrome.contextMenus.create({
    id: 'write-ai',
    parentId: 'gemini-assistant',
    title: 'Write with AI',
    contexts: ['selection', 'editable'], // Show for both selection and editable fields
});
```

**Step 2:** Track whether Write was opened from an input field:

```typescript
// In context menu handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'write-ai' && tab?.id) {
        // Determine if we have an insertion target
        const hasInsertionTarget = info.editable === true;
        
        chrome.tabs.sendMessage(tab.id, {
            type: 'OPEN_WRITE_OVERLAY',
            payload: {
                selectedText: info.selectionText || '',
                hasInsertionTarget, // Pass this flag
                position: { x: 100, y: 100 },
            },
        });
    }
});
```

**Step 3:** Update Write overlay to accept and use the insertion context:

```typescript
// In WriteOverlay.tsx or similar

interface WriteOverlayProps {
    // ... existing props
    hasInsertionTarget?: boolean; // New prop
}

export function WriteOverlay({ 
    hasInsertionTarget = true, // Default to true for backward compatibility
    // ... other props
}: WriteOverlayProps) {
    // ... component logic

    return (
        <div className="write-overlay">
            {/* ... content */}
            
            <div className="write-actions">
                {/* Copy button - always visible */}
                <button 
                    type="button" 
                    className="write-action-button"
                    onClick={handleCopy}
                    aria-label="Copy to clipboard"
                >
                    <CopyIcon />
                    Copy
                </button>
                
                {/* Insert button - only show if there's an insertion target */}
                {hasInsertionTarget && (
                    <button 
                        type="button" 
                        className="write-action-button write-action-button--primary"
                        onClick={handleInsert}
                        aria-label="Insert into field"
                    >
                        <InsertIcon />
                        Insert
                    </button>
                )}
            </div>
        </div>
    );
}
```

**Step 4:** Handle the message in content script:

```typescript
// In src/contents/write-command.tsx

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'OPEN_WRITE_OVERLAY') {
        const { selectedText, hasInsertionTarget, position } = message.payload;
        
        openWriteOverlay({
            initialText: selectedText,
            hasInsertionTarget, // Pass to overlay
            position,
        });
        
        sendResponse({ success: true });
    }
    return true;
});
```

**Step 5:** Alternative - Detect insertion target dynamically:

```typescript
// In WriteOverlay component, detect if there's a focused editable element

const [canInsert, setCanInsert] = useState(false);

useEffect(() => {
    // Check if there's an active editable element we can insert into
    const checkInsertionTarget = () => {
        const activeElement = document.activeElement;
        const isEditable = 
            activeElement instanceof HTMLInputElement ||
            activeElement instanceof HTMLTextAreaElement ||
            activeElement?.getAttribute('contenteditable') === 'true';
        
        // Also check if we have a stored reference to the original input
        const hasStoredTarget = !!originalInputRef.current;
        
        setCanInsert(isEditable || hasStoredTarget);
    };
    
    checkInsertionTarget();
    
    // Re-check when focus changes
    document.addEventListener('focusin', checkInsertionTarget);
    return () => document.removeEventListener('focusin', checkInsertionTarget);
}, []);

// In render:
{canInsert && (
    <button onClick={handleInsert}>Insert</button>
)}
```

### UX Considerations

1. **When opened from context menu on regular text (not in input):**
   - Show: Copy button
   - Hide: Insert button
   - User can copy the generated text and paste manually

2. **When opened from context menu on editable field:**
   - Show: Both Copy and Insert buttons
   - Insert will place text at cursor position in the field

3. **When opened via keyboard shortcut while focused on input:**
   - Show: Both Copy and Insert buttons
   - Maintain reference to the original input field

4. **Visual feedback:**
   - Consider showing a tooltip on Copy button: "No input field detected - use Copy instead"
   - Or show a subtle message: "Copy to clipboard (no insertion target)"

---

## Issue 11: Ask Overlay Panel Size Increases When More Messages Are Sent

### ✅ STATUS: FIXED (2025-11-28)

**Fix Applied:** Updated `src/styles/features/ask-command.css` with proper flex layout constraints:
- Changed `.ask-messages` to use `flex: 1 1 0` and added critical `min-height: 0` to allow the flex item to shrink below content size and enable scrolling
- Removed the fixed `max-height: 400px` that was causing layout issues
- Added `flex-shrink: 0` to `.ask-header`, `.ask-input-row`, `.ask-tools-row`, `.ask-attachment-preview`, and `.ask-error` to prevent these fixed sections from shrinking
- The overlay now maintains its max-height constraint while the messages container scrolls properly

---

### Problem (Original)
When more messages are sent in the Ask Overlay conversation, the panel size keeps increasing instead of maintaining a fixed height with scrollable content. This causes the overlay to grow beyond its intended bounds and potentially overflow the viewport.

### Root Cause
Looking at `src/styles/features/ask-command.css`, the `.ask-overlay` has `max-height: 80vh` but the `.ask-messages` container may not be properly constraining its height, causing the parent to grow.

Current CSS (lines 1-30 in ask-command.css):
```css
.ask-overlay {
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    /* ... */
}

.ask-messages {
    flex: 1;
    overflow-y: auto;
    min-height: 100px;
    max-height: 400px;  /* This may be the issue - fixed max instead of flex */
}
```

The issue is that `.ask-messages` has a fixed `max-height: 400px` which doesn't work well with the flex layout. When content exceeds this, the container may not scroll properly or the parent may expand.

### Files to Modify
1. `src/styles/features/ask-command.css` - Fix the height constraints

### Recommended Fix

**Option A:** Use flex-based height constraints:

```css
.ask-overlay {
    position: fixed;
    z-index: 2147483646;
    
    width: 420px;
    max-width: 90vw;
    height: 500px;        /* Set a fixed height */
    max-height: 80vh;     /* But cap at viewport */
    
    display: flex;
    flex-direction: column;
    
    /* ... rest of styles */
}

.ask-messages {
    flex: 1;
    min-height: 0;        /* IMPORTANT: Allow flex item to shrink below content size */
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}
```

**Option B:** Use calc() for dynamic height:

```css
.ask-overlay {
    position: fixed;
    z-index: 2147483646;
    
    width: 420px;
    max-width: 90vw;
    max-height: 80vh;
    
    display: flex;
    flex-direction: column;
    
    /* ... rest of styles */
}

.ask-messages {
    flex: 1 1 auto;
    min-height: 100px;
    max-height: calc(80vh - 200px);  /* Account for header, input, tools row */
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}
```

**Option C (Recommended):** Remove fixed max-height from messages, let flex handle it:

```css
.ask-overlay {
    position: fixed;
    z-index: 2147483646;
    
    width: 420px;
    max-width: 90vw;
    height: auto;
    min-height: 300px;
    max-height: 80vh;
    
    display: flex;
    flex-direction: column;
    overflow: hidden;     /* Prevent overflow */
    
    /* ... rest of styles */
}

.ask-messages {
    flex: 1 1 0;          /* Grow and shrink, base size 0 */
    min-height: 0;        /* Critical for flex overflow */
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

/* Ensure other sections don't grow */
.ask-header {
    flex-shrink: 0;
}

.ask-input-row {
    flex-shrink: 0;
}

.ask-tools-row {
    flex-shrink: 0;
}

.ask-attachment-preview {
    flex-shrink: 0;
}

.ask-error {
    flex-shrink: 0;
}
```

### Key CSS Fixes Explained

1. **`min-height: 0` on flex children** - This is critical! By default, flex items have `min-height: auto` which prevents them from shrinking below their content size. Setting `min-height: 0` allows the messages container to shrink and enable scrolling.

2. **`flex: 1 1 0`** - This means:
   - `flex-grow: 1` - Take available space
   - `flex-shrink: 1` - Can shrink if needed
   - `flex-basis: 0` - Start from 0, not content size

3. **`overflow: hidden` on parent** - Prevents the overlay from expanding beyond its max-height.

4. **`flex-shrink: 0` on fixed sections** - Header, input row, and tools row should not shrink.

### Testing Checklist
- [ ] Send 1-2 messages - overlay should be compact
- [ ] Send 10+ messages - overlay should not exceed max-height
- [ ] Messages should scroll within the container
- [ ] Header, input, and tools row should remain visible
- [ ] Overlay should not overflow viewport on small screens

---

## Summary of Changes

| Issue | File(s) | Priority |
|-------|---------|----------|
| 1. Tools Section White Background | `ask-command.css` | ✅ DONE |
| 2. Markdown Not Rendering | `AskMessageBubble.tsx`, `ask-command.css` | High |
| 3. Enter Key Not Sending | `AskOverlay.tsx` | High |
| 4. Generic File Icons | `AskAttachmentPreview.tsx` | ✅ DONE |
| 5. Disabled Tools Tooltip | `Composer.tsx` | ✅ DONE |
| 6. Hide Plus Icon in Search | `Composer.tsx` | ✅ DONE |
| 7. Minimal Model Picker | `model-selector-popover.css` | ✅ DONE |
| 8. Update Model Options | `ModelSelectorPopover.tsx`, types | Low |
| 9. Add Ask to Context Menu | `contextMenu/`, `ask-command.tsx` | ✅ DONE |
| 10. Add Write to Context Menu | `contextMenu/`, `write-command.tsx`, WriteOverlay | ✅ DONE |
| 11. Ask Panel Size Growing | `ask-command.css` | ✅ DONE |

---

## Execution Order

1. ✅ **Issue 3** - Fix Enter key (quick fix, high impact)
2. ✅ **Issue 11** - Fix Ask panel size growing (CSS fix, high impact)
3. ✅ **Issue 1** - Fix tools section styling (CSS only)
4. **Issue 2** - Add Markdown rendering (requires testing)
5. ✅ **Issue 4** - Use file icon mapper (simple import change)
6. ✅ **Issue 5** - Add tooltip to disabled tools button
7. ✅ **Issue 6** - Hide plus icon in search mode
8. ✅ **Issue 9** - Add Ask to context menu (new feature)
9. ✅ **Issue 10** - Add Write to context menu with conditional Insert (new feature)
10. ✅ **Issue 7** - Make model picker minimal
11. **Issue 8** - Update model options
