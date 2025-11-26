# `/write` Slash Command Implementation Plan

## Overview

Implement a context-aware AI writing assistant that activates when users type `/write` in any input field or contenteditable element on any webpage. The feature will use the Gemini API for text generation and stream results back to the user.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERACTION                                │
│                                                                              │
│   User types "/write draft an email about project delay" in any input       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONTENT SCRIPT LAYER                                 │
│                      src/contents/write-command.tsx                          │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │ Command         │  │ Target Element  │  │ Writer UI Overlay           │  │
│  │ Detection       │──▶│ Capture         │──▶│ (Floating Panel)           │  │
│  │ (/write regex)  │  │ + Cursor Pos    │  │                             │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ chrome.runtime.sendMessage
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       BACKGROUND SERVICE WORKER                              │
│                      src/background/writer/                                  │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │ Message Router  │  │ Context         │  │ Gemini API Client           │  │
│  │ (WRITE_GENERATE)│──▶│ Builder         │──▶│ (REST with streaming)       │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Streaming chunks via port
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONTENT SCRIPT LAYER                                 │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     Writer UI Updates                                │    │
│  │  - Real-time text streaming display                                  │    │
│  │  - "Writing..." animation during generation                          │    │
│  │  - Press Enter to insert into target element                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Foundation Setup
**Estimated Time: 2-3 hours**

### 1.1 Create Settings Infrastructure

**File: `src/utils/writeCommandSettings.ts`**

```typescript
// Storage key and default settings
export const WRITE_COMMAND_STORAGE_KEY = 'writeCommandSettings';

export interface WriteCommandSettings {
    enabled: boolean;
    defaultTone: 'professional' | 'casual' | 'formal' | 'friendly';
    includePageContext: boolean;
    maxOutputTokens: number;
}

export const DEFAULT_WRITE_SETTINGS: WriteCommandSettings = {
    enabled: true,
    defaultTone: 'professional',
    includePageContext: true,
    maxOutputTokens: 1024,
};

// Functions:
// - getWriteCommandSettings(): Promise<WriteCommandSettings>
// - saveWriteCommandSettings(settings: WriteCommandSettings): Promise<void>
// - isWriteCommandEnabled(): Promise<boolean>
```

### 1.2 Define Message Types

**File: `src/types/writeCommand.ts`**

```typescript
// Message types for content script <-> background communication
export interface WriteGenerateRequest {
    action: 'WRITE_GENERATE';
    payload: {
        prompt: string;
        pageContext?: {
            title: string;
            url: string;
            domain: string;
            platform?: string;
        };
        settings?: {
            tone?: string;
            maxTokens?: number;
        };
    };
}

export interface WriteGenerateResponse {
    success: boolean;
    text?: string;
    error?: string;
}

export interface WriteStreamChunk {
    action: 'WRITE_STREAM_CHUNK';
    text: string;
    done: boolean;
}
```

### 1.3 Create CSS Styles

**File: `src/styles/write-command.css`**

```css
/* Writer overlay styles */
/* - Dark theme floating panel */
/* - Draggable header */
/* - Input field styling */
/* - Output display area */
/* - Loading animation */
/* - Responsive positioning */
```

### Tasks:
- [ ] Create `src/utils/writeCommandSettings.ts`
- [ ] Create `src/types/writeCommand.ts`  
- [ ] Create `src/styles/write-command.css`
- [ ] Add settings key to storage constants

---

## Phase 2: Background Service Implementation
**Estimated Time: 3-4 hours**

### 2.1 Gemini Writer Client

**File: `src/background/writer/geminiWriter.ts`**

```typescript
import { getGoogleApiKey } from '@/utils/providerCredentials';

// Core Gemini API client for writing
export class GeminiWriter {
    private apiKey: string;
    private model = 'gemini-2.5-flash';
    private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    // Non-streaming generation
    async generate(prompt: string, context?: string): Promise<string>;
    
    // Streaming generation (returns async generator)
    async *generateStream(prompt: string, context?: string): AsyncGenerator<string>;
    
    // Build system prompt with context
    private buildSystemPrompt(context?: PageContext): string;
}
```

**API Integration Details:**

```typescript
// REST endpoint for streaming
const url = `${this.baseUrl}/models/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

// Request body structure
const body = {
    contents: [{
        role: 'user',
        parts: [{ text: prompt }]
    }],
    systemInstruction: {
        parts: [{ text: systemPrompt }]
    },
    generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
        topP: 0.95,
    }
};

// Parse SSE stream
// Each line: data: {"candidates":[{"content":{"parts":[{"text":"..."}]}}]}
```

### 2.2 Context Builder

**File: `src/background/writer/contextBuilder.ts`**

```typescript
// Build rich context from page information
export interface PageContext {
    title: string;
    url: string;
    domain: string;
    platform?: string;  // gmail, linkedin, github, twitter, etc.
    fieldType?: string; // email, comment, post, etc.
}

// Detect platform from URL
export function detectPlatform(url: string): string | undefined;

// Build context string for Gemini
export function buildContextString(context: PageContext): string;

// Example output:
// "Page: Compose Email | Domain: mail.google.com | Platform: Gmail
//  You are a helpful writing assistant. Generate clear, professional content."
```

### 2.3 Message Handler

**File: `src/background/writer/handler.ts`**

```typescript
import { GeminiWriter } from './geminiWriter';
import { buildContextString } from './contextBuilder';

// Handle WRITE_GENERATE message
export async function handleWriteGenerate(
    request: WriteGenerateRequest,
    port: chrome.runtime.Port
): Promise<void> {
    const writer = new GeminiWriter();
    
    try {
        // Stream chunks back via port
        for await (const chunk of writer.generateStream(request.payload.prompt)) {
            port.postMessage({
                action: 'WRITE_STREAM_CHUNK',
                text: chunk,
                done: false,
            });
        }
        
        port.postMessage({
            action: 'WRITE_STREAM_CHUNK',
            text: '',
            done: true,
        });
    } catch (error) {
        port.postMessage({
            action: 'WRITE_ERROR',
            error: error.message,
        });
    }
}
```

### 2.4 Register in Router

**Update: `src/background/messaging/router.ts`**

```typescript
// Add to existing message router
case 'WRITE_GENERATE':
    return handleWriteGenerate(request, sender);
```

### Tasks:
- [ ] Create `src/background/writer/geminiWriter.ts`
- [ ] Create `src/background/writer/contextBuilder.ts`
- [ ] Create `src/background/writer/handler.ts`
- [ ] Create `src/background/writer/index.ts` (exports)
- [ ] Update `src/background/messaging/router.ts`

---

## Phase 3: Content Script Implementation
**Estimated Time: 4-5 hours**

### 3.1 Command Detection Hook

**File: `src/contents/write-command/useWriteCommandDetection.ts`**

```typescript
// Hook to detect /write command in any input
export function useWriteCommandDetection() {
    const [isWriterMode, setIsWriterMode] = useState(false);
    const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
    const [cursorPosition, setCursorPosition] = useState(0);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        // Document-wide input listener
        const handleInput = (e: Event) => {
            const target = e.target as HTMLElement;
            
            // Check if input/textarea/contenteditable
            if (!isEditableElement(target)) return;
            
            // Get text content
            const text = getElementText(target);
            const cursorPos = getCursorPosition(target);
            
            // Check for /write pattern
            const match = text.match(/\/write(\s|$)/i);
            if (match) {
                // Remove command from input
                removeCommandFromElement(target, match);
                
                // Calculate overlay position
                const rect = target.getBoundingClientRect();
                setTooltipPosition(calculatePosition(rect));
                
                // Activate writer mode
                setTargetElement(target);
                setCursorPosition(cursorPos);
                setIsWriterMode(true);
            }
        };

        document.addEventListener('input', handleInput, true);
        return () => document.removeEventListener('input', handleInput, true);
    }, []);

    return { isWriterMode, targetElement, cursorPosition, tooltipPosition, setIsWriterMode };
}

// Helper functions:
function isEditableElement(el: HTMLElement): boolean;
function getElementText(el: HTMLElement): string;
function getCursorPosition(el: HTMLElement): number;
function removeCommandFromElement(el: HTMLElement, match: RegExpMatchArray): void;
function calculatePosition(rect: DOMRect): { x: number; y: number };
```

### 3.2 Text Insertion Hook

**File: `src/contents/write-command/useTextInsertion.ts`**

```typescript
// Hook to insert generated text into target element
export function useTextInsertion() {
    const insertText = useCallback((
        target: HTMLElement,
        text: string,
        cursorPosition: number
    ) => {
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
            // Standard input/textarea
            const before = target.value.substring(0, cursorPosition);
            const after = target.value.substring(cursorPosition);
            target.value = before + text + after;
            
            // Move cursor to end of inserted text
            const newPos = cursorPosition + text.length;
            target.setSelectionRange(newPos, newPos);
            
            // Trigger framework events
            target.dispatchEvent(new Event('input', { bubbles: true }));
            target.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (target.isContentEditable) {
            // ContentEditable (Draft.js, rich editors)
            // Try execCommand first
            const success = document.execCommand('insertText', false, text);
            
            if (!success) {
                // Fallback: direct DOM manipulation
                insertTextAtCursor(target, text);
            }
            
            // Trigger InputEvent for frameworks
            target.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                inputType: 'insertText',
                data: text,
            }));
        }
    }, []);

    return { insertText };
}
```

### 3.3 Writer UI Component

**File: `src/contents/write-command/WriterOverlay.tsx`**

```tsx
interface WriterOverlayProps {
    position: { x: number; y: number };
    onGenerate: (prompt: string) => void;
    onInsert: () => void;
    onClose: () => void;
    isGenerating: boolean;
    generatedText: string;
}

export function WriterOverlay({
    position,
    onGenerate,
    onInsert,
    onClose,
    isGenerating,
    generatedText,
}: WriterOverlayProps) {
    const [prompt, setPrompt] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (generatedText) {
                    onInsert();
                } else if (prompt.trim()) {
                    onGenerate(prompt);
                }
            } else if (e.key === 'Escape') {
                onClose();
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [prompt, generatedText, onGenerate, onInsert, onClose]);

    return (
        <div 
            className="writer-overlay"
            style={{
                position: 'fixed',
                left: position.x,
                top: position.y,
                zIndex: 2147483647,
            }}
        >
            {/* Header with drag handle and close button */}
            <div className="writer-header">
                <div className="writer-drag-handle" onMouseDown={handleDragStart}>
                    <GripVertical size={16} />
                </div>
                <span className="writer-title">Writer</span>
                <button className="writer-close" onClick={onClose}>
                    <X size={16} />
                </button>
            </div>

            {/* Input row */}
            <div className="writer-input-row">
                <input
                    ref={inputRef}
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="What would you like me to write?"
                    disabled={isGenerating || !!generatedText}
                />
                <button onClick={() => onGenerate(prompt)} disabled={!prompt.trim()}>
                    <Send size={16} />
                </button>
            </div>

            {/* Loading state */}
            {isGenerating && !generatedText && (
                <div className="writer-loading">
                    <WritingAnimation />
                </div>
            )}

            {/* Output display */}
            {generatedText && (
                <div className="writer-output">
                    <div className="writer-output-text">
                        {generatedText}
                        {isGenerating && <span className="writer-cursor">▌</span>}
                    </div>
                    {!isGenerating && (
                        <div className="writer-hint">
                            Press <kbd>Enter</kbd> to insert
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
```

### 3.4 Main Content Script

**File: `src/contents/write-command.tsx`**

```tsx
import type { PlasmoCSConfig } from "plasmo";
import { useWriteCommandDetection } from './write-command/useWriteCommandDetection';
import { useTextInsertion } from './write-command/useTextInsertion';
import { WriterOverlay } from './write-command/WriterOverlay';
import cssText from "data-text:~/styles/write-command.css";

export const config: PlasmoCSConfig = {
    matches: ["<all_urls>"],
    all_frames: true, // Enable for iframes (Gmail, etc.)
};

export const getStyle = () => {
    const style = document.createElement("style");
    style.textContent = cssText;
    return style;
};

function WriteCommandContent() {
    const {
        isWriterMode,
        targetElement,
        cursorPosition,
        tooltipPosition,
        setIsWriterMode,
    } = useWriteCommandDetection();
    
    const { insertText } = useTextInsertion();
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedText, setGeneratedText] = useState('');

    // Handle text generation via background
    const handleGenerate = useCallback(async (prompt: string) => {
        setIsGenerating(true);
        setGeneratedText('');

        // Get page context
        const pageContext = {
            title: document.title,
            url: window.location.href,
            domain: window.location.hostname,
        };

        // Connect to background via port for streaming
        const port = chrome.runtime.connect({ name: 'write-command' });
        
        port.onMessage.addListener((message) => {
            if (message.action === 'WRITE_STREAM_CHUNK') {
                setGeneratedText((prev) => prev + message.text);
                if (message.done) {
                    setIsGenerating(false);
                }
            } else if (message.action === 'WRITE_ERROR') {
                setIsGenerating(false);
                // Show error notification
            }
        });

        port.postMessage({
            action: 'WRITE_GENERATE',
            payload: { prompt, pageContext },
        });
    }, []);

    // Handle text insertion
    const handleInsert = useCallback(() => {
        if (targetElement && generatedText) {
            insertText(targetElement, generatedText, cursorPosition);
            handleClose();
        }
    }, [targetElement, generatedText, cursorPosition, insertText]);

    // Handle close
    const handleClose = useCallback(() => {
        setIsWriterMode(false);
        setGeneratedText('');
        setIsGenerating(false);
    }, [setIsWriterMode]);

    if (!isWriterMode) return null;

    return (
        <WriterOverlay
            position={tooltipPosition}
            onGenerate={handleGenerate}
            onInsert={handleInsert}
            onClose={handleClose}
            isGenerating={isGenerating}
            generatedText={generatedText}
        />
    );
}

export default WriteCommandContent;
```

### Tasks:
- [ ] Create `src/contents/write-command/useWriteCommandDetection.ts`
- [ ] Create `src/contents/write-command/useTextInsertion.ts`
- [ ] Create `src/contents/write-command/WriterOverlay.tsx`
- [ ] Create `src/contents/write-command/WritingAnimation.tsx`
- [ ] Create `src/contents/write-command.tsx` (main content script)
- [ ] Create supporting utilities

---

## Phase 4: Streaming Integration
**Estimated Time: 2-3 hours**

### 4.1 Port-Based Streaming

**Update: `src/background/messaging/router.ts`**

```typescript
// Handle long-lived connections for streaming
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'write-command') {
        port.onMessage.addListener(async (message) => {
            if (message.action === 'WRITE_GENERATE') {
                await handleWriteGenerateStreaming(message, port);
            }
        });
    }
});
```

### 4.2 SSE Stream Parser

**File: `src/background/writer/streamParser.ts`**

```typescript
// Parse Gemini SSE stream
export async function* parseGeminiSSE(
    response: Response
): AsyncGenerator<string> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') return;
                
                try {
                    const json = JSON.parse(data);
                    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) yield text;
                } catch {
                    // Skip malformed JSON
                }
            }
        }
    }
}
```

### Tasks:
- [ ] Update router for port connections
- [ ] Create `src/background/writer/streamParser.ts`
- [ ] Test streaming end-to-end

---

## Phase 5: Settings UI Integration
**Estimated Time: 2-3 hours**

### 5.1 Settings Component

**File: `src/components/features/settings/components/WriteCommandSettings.tsx`**

```tsx
export function WriteCommandSettings() {
    const [settings, setSettings] = useState<WriteCommandSettings>(DEFAULT_WRITE_SETTINGS);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getWriteCommandSettings().then((s) => {
            setSettings(s);
            setLoading(false);
        });
    }, []);

    const handleToggle = async (key: keyof WriteCommandSettings, value: any) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        await saveWriteCommandSettings(newSettings);
    };

    return (
        <div className="settings-section">
            <h3>/write Command</h3>
            
            {/* Enable/Disable toggle */}
            <div className="settings-row">
                <label>Enable /write command</label>
                <Toggle
                    checked={settings.enabled}
                    onChange={(v) => handleToggle('enabled', v)}
                />
            </div>
            
            <p className="settings-hint">
                Type /write in any text field to generate AI content
            </p>

            {/* Default tone selector */}
            <div className="settings-row">
                <label>Default writing tone</label>
                <select
                    value={settings.defaultTone}
                    onChange={(e) => handleToggle('defaultTone', e.target.value)}
                >
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="formal">Formal</option>
                    <option value="friendly">Friendly</option>
                </select>
            </div>

            {/* Page context toggle */}
            <div className="settings-row">
                <label>Include page context</label>
                <Toggle
                    checked={settings.includePageContext}
                    onChange={(v) => handleToggle('includePageContext', v)}
                />
            </div>
        </div>
    );
}
```

### 5.2 Add to Settings Screen

**Update: `src/components/features/settings/SettingsScreen.tsx`**

```tsx
import { WriteCommandSettings } from './components/WriteCommandSettings';

// Add to settings tabs/sections
<WriteCommandSettings />
```

### Tasks:
- [ ] Create `src/components/features/settings/components/WriteCommandSettings.tsx`
- [ ] Update SettingsScreen to include WriteCommandSettings
- [ ] Add to tool descriptions for settings UI

---

## Phase 6: Platform Detection & Context Enhancement
**Estimated Time: 2-3 hours**

### 6.1 Platform Detector

**File: `src/contents/write-command/platformDetector.ts`**

```typescript
interface PlatformInfo {
    platform: string;
    fieldType: string;
    suggestedTone: string;
}

export function detectPlatform(): PlatformInfo {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;

    // Gmail
    if (hostname.includes('mail.google.com')) {
        return { platform: 'Gmail', fieldType: 'email', suggestedTone: 'professional' };
    }

    // LinkedIn
    if (hostname.includes('linkedin.com')) {
        if (pathname.includes('/messaging/')) {
            return { platform: 'LinkedIn', fieldType: 'message', suggestedTone: 'professional' };
        }
        return { platform: 'LinkedIn', fieldType: 'post', suggestedTone: 'professional' };
    }

    // Twitter/X
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
        return { platform: 'Twitter', fieldType: 'tweet', suggestedTone: 'casual' };
    }

    // GitHub
    if (hostname.includes('github.com')) {
        if (pathname.includes('/issues/') || pathname.includes('/pull/')) {
            return { platform: 'GitHub', fieldType: 'comment', suggestedTone: 'professional' };
        }
        return { platform: 'GitHub', fieldType: 'markdown', suggestedTone: 'professional' };
    }

    // Slack
    if (hostname.includes('slack.com')) {
        return { platform: 'Slack', fieldType: 'message', suggestedTone: 'casual' };
    }

    // Discord
    if (hostname.includes('discord.com')) {
        return { platform: 'Discord', fieldType: 'message', suggestedTone: 'casual' };
    }

    // Default
    return { platform: 'Web', fieldType: 'text', suggestedTone: 'neutral' };
}
```

### 6.2 Enhanced System Prompt

**Update: `src/background/writer/geminiWriter.ts`**

```typescript
private buildSystemPrompt(context: PageContext): string {
    const platformInstructions: Record<string, string> = {
        Gmail: `You are writing an email. Be clear, professional, and include appropriate greetings/closings.`,
        LinkedIn: `You are writing for a professional network. Be engaging and business-appropriate.`,
        Twitter: `You are writing a tweet. Be concise (under 280 chars if possible), engaging, and consider hashtags.`,
        GitHub: `You are writing for developers. Be technical, clear, and follow markdown conventions.`,
        Slack: `You are writing a workplace message. Be concise, friendly, and professional.`,
        Discord: `You are writing a chat message. Be casual and conversational.`,
    };

    const basePrompt = `You are a helpful writing assistant. Generate content based on the user's request.`;
    const platformPrompt = platformInstructions[context.platform || 'Web'] || '';
    const contextInfo = `Current page: ${context.title} | Domain: ${context.domain}`;

    return `${basePrompt}\n\n${platformPrompt}\n\n${contextInfo}`;
}
```

### Tasks:
- [ ] Create `src/contents/write-command/platformDetector.ts`
- [ ] Update system prompt with platform-specific instructions
- [ ] Test on various platforms (Gmail, LinkedIn, GitHub, etc.)

---

## Phase 7: Error Handling & Edge Cases
**Estimated Time: 2-3 hours**

### 7.1 Error States

```typescript
// Error types to handle:
// 1. No API key configured
// 2. API rate limiting
// 3. Network errors
// 4. Invalid response
// 5. Content script context invalidated
// 6. Target element removed/changed
```

### 7.2 Error UI

**Update: `WriterOverlay.tsx`**

```tsx
{error && (
    <div className="writer-error">
        <AlertCircle size={16} />
        <span>{error}</span>
        <button onClick={handleRetry}>Retry</button>
    </div>
)}
```

### 7.3 Edge Cases

```typescript
// Handle edge cases:
// 1. User clicks outside overlay - close
// 2. Target input is removed - close gracefully
// 3. Page navigation during generation - abort
// 4. Multiple /write commands - only handle first
// 5. iframe context - ensure message passing works
// 6. Shadow DOM inputs - handle correctly
```

### Tasks:
- [ ] Add error boundary to content script
- [ ] Implement error UI states
- [ ] Handle abort on navigation
- [ ] Test edge cases

---

## Phase 8: Testing & Polish
**Estimated Time: 3-4 hours**

### 8.1 Manual Test Cases

| Platform | Test Case | Expected Behavior |
|----------|-----------|-------------------|
| Gmail | Type /write in compose box | Writer overlay appears, generates email-style text |
| LinkedIn | Type /write in post composer | Professional tone, LinkedIn-appropriate content |
| GitHub | Type /write in issue comment | Markdown-friendly, developer-focused |
| Twitter | Type /write in tweet box | Concise, under 280 chars if possible |
| Generic | Type /write in any input | Neutral tone, clean output |

### 8.2 Compatibility Testing

- [ ] Test on Chrome 120+
- [ ] Test with React-based inputs (Gmail, Twitter)
- [ ] Test with contenteditable (LinkedIn, GitHub)
- [ ] Test with standard inputs
- [ ] Test in iframes
- [ ] Test with various page zoom levels

### 8.3 Performance Testing

- [ ] Measure first token latency
- [ ] Ensure UI remains responsive during streaming
- [ ] Memory leak testing (open/close many times)
- [ ] Test with slow network conditions

### Tasks:
- [ ] Create test plan document
- [ ] Execute manual tests
- [ ] Fix identified issues
- [ ] Polish UI animations

---

## File Structure Summary

```
src/
├── contents/
│   ├── write-command.tsx                    # Main content script entry
│   └── write-command/
│       ├── useWriteCommandDetection.ts      # Command detection hook
│       ├── useTextInsertion.ts              # Text insertion hook
│       ├── WriterOverlay.tsx                # Main UI component
│       ├── WritingAnimation.tsx             # Loading animation
│       └── platformDetector.ts              # Platform detection
├── background/
│   └── writer/
│       ├── index.ts                         # Module exports
│       ├── geminiWriter.ts                  # Gemini API client
│       ├── contextBuilder.ts                # Context builder
│       ├── streamParser.ts                  # SSE stream parser
│       └── handler.ts                       # Message handler
├── utils/
│   └── writeCommandSettings.ts              # Settings storage
├── types/
│   └── writeCommand.ts                      # Type definitions
├── styles/
│   └── write-command.css                    # Component styles
└── components/
    └── features/
        └── settings/
            └── components/
                └── WriteCommandSettings.tsx  # Settings UI
```

---

## Dependencies

No new dependencies required! Uses:
- Native `fetch` API for Gemini REST calls
- Chrome Extension APIs (`chrome.runtime`, `chrome.storage`)
- React (already installed via Plasmo)
- Existing styling system

---

## Estimated Total Time

| Phase | Estimated Time |
|-------|----------------|
| Phase 1: Foundation | 2-3 hours |
| Phase 2: Background Service | 3-4 hours |
| Phase 3: Content Script | 4-5 hours |
| Phase 4: Streaming | 2-3 hours |
| Phase 5: Settings UI | 2-3 hours |
| Phase 6: Platform Detection | 2-3 hours |
| Phase 7: Error Handling | 2-3 hours |
| Phase 8: Testing & Polish | 3-4 hours |
| **Total** | **20-28 hours** |

---

## Future Enhancements (Post-MVP)

1. **Rewrite command** (`/rewrite`) - Select text, type /rewrite to improve it
3. **Memory integration** - Use stored user preferences in prompts
4. **Custom prompts** - Let users define their own slash commands
5. **Keyboard shortcuts** - Alt+W to open writer without /write
6. **History** - Remember recent generations for quick re-use
7. **Templates** - Pre-built templates for common use cases

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| API costs | Implement rate limiting, usage tracking |
| Slow responses | Show streaming, add cancel button |
| CORS issues | Route all API calls through background |
| UI conflicts | Use high z-index, Shadow DOM if needed |
| Framework compatibility | Test execCommand + direct DOM fallback |

---

## Success Criteria

- [ ] /write command detected in all major input types
- [ ] Writer overlay appears positioned correctly
- [ ] Text streams in real-time during generation
- [ ] Enter inserts text at correct cursor position
- [ ] Works on Gmail, LinkedIn, Twitter, GitHub
- [ ] Settings allow enable/disable
- [ ] Error states handled gracefully
- [ ] No memory leaks or performance issues
