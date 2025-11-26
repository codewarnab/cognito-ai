# Text Selection Summarizer - Implementation Plan

## Overview

Implement a Glancy-inspired text selection summarizer feature that shows a floating AI icon when users select text on any webpage. Unlike Glancy (which uses Chrome's built-in Gemini Nano), this implementation will use the **Gemini API via REST** calls from the background service worker, similar to the `/write` command architecture.

---

## Analysis: Glancy vs Our Implementation

### Glancy's Approach
- Uses `self.Summarizer.create()` - Chrome's built-in Summarizer API (Gemini Nano)
- Streaming via `summarizer.summarizeStreaming(text)`
- Content script handles AI calls directly
- Uses Shadow DOM for style isolation
- Radix UI for floating popover

### Our Approach (Cognito)
- Uses **Gemini API REST calls** from background service worker
- Streaming via SSE (Server-Sent Events) from Gemini API
- Content script → Background messaging → Gemini API → Stream back to content script
- Uses Plasmo's Shadow DOM via `data-text:` CSS imports
- Custom floating UI components (similar to existing `ask-ai-button.tsx`)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERACTION                                │
│                                                                              │
│   User selects text (100+ chars) on any webpage                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONTENT SCRIPT LAYER                                 │
│                    src/contents/text-summarizer.tsx                          │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │ Text Selection  │  │ Floating Icon   │  │ Summary Popup               │  │
│  │ Detection       │──▶│ Component       │──▶│ (Streaming Display)        │  │
│  │ (100+ chars)    │  │                 │  │                             │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ chrome.runtime.connect (port)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       BACKGROUND SERVICE WORKER                              │
│                      src/background/summarizer/                              │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │ Port Listener   │  │ Context         │  │ Gemini API Client           │  │
│  │ (SUMMARIZE_*)   │──▶│ Builder         │──▶│ (REST with SSE streaming)   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Streaming chunks via port.postMessage
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONTENT SCRIPT LAYER                                 │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     Summary Popup Updates                            │    │
│  │  - Real-time text streaming with cursor animation                    │    │
│  │  - Copy to clipboard button                                          │    │
│  │  - Send to Cognito button (opens sidepanel with context)            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Foundation Setup
**Estimated Time: 1-2 hours**

### 1.1 Create Settings Infrastructure

**File: `src/utils/textSummarizerSettings.ts`**

```typescript
import { createLogger } from '~logger';

const log = createLogger('TextSummarizerSettings', 'SETTINGS');

export const TEXT_SUMMARIZER_STORAGE_KEY = 'textSummarizerSettings';

export interface TextSummarizerSettings {
    enabled: boolean;
    minTextLength: number;
    summaryType: 'key-points' | 'tl-dr' | 'headline' | 'teaser';
    summaryLength: 'short' | 'medium' | 'long';
}

export const DEFAULT_SUMMARIZER_SETTINGS: TextSummarizerSettings = {
    enabled: true,
    minTextLength: 100,
    summaryType: 'tl-dr',
    summaryLength: 'medium',
};

export async function getTextSummarizerSettings(): Promise<TextSummarizerSettings> {
    try {
        const result = await chrome.storage.local.get(TEXT_SUMMARIZER_STORAGE_KEY);
        return { ...DEFAULT_SUMMARIZER_SETTINGS, ...(result[TEXT_SUMMARIZER_STORAGE_KEY] || {}) };
    } catch (error) {
        log.error('Failed to get settings:', error);
        return DEFAULT_SUMMARIZER_SETTINGS;
    }
}

export async function saveTextSummarizerSettings(settings: TextSummarizerSettings): Promise<void> {
    try {
        await chrome.storage.local.set({ [TEXT_SUMMARIZER_STORAGE_KEY]: settings });
        log.info('Settings saved');
    } catch (error) {
        log.error('Failed to save settings:', error);
        throw error;
    }
}

export async function isTextSummarizerEnabled(): Promise<boolean> {
    const settings = await getTextSummarizerSettings();
    return settings.enabled;
}
```

### 1.2 Define Message Types

**File: `src/types/textSummarizer.ts`**

```typescript
export interface SummarizeRequest {
    action: 'SUMMARIZE_REQUEST';
    payload: {
        text: string;
        pageContext: {
            title: string;
            url: string;
            domain: string;
        };
        settings?: {
            summaryType?: 'key-points' | 'tl-dr' | 'headline' | 'teaser';
            summaryLength?: 'short' | 'medium' | 'long';
        };
    };
}

export interface SummarizeStreamChunk {
    action: 'SUMMARIZE_STREAM_CHUNK';
    text: string;
    done: boolean;
}

export interface SummarizeError {
    action: 'SUMMARIZE_ERROR';
    error: string;
    code?: string;
}

export type SummarizeMessage = SummarizeRequest | SummarizeStreamChunk | SummarizeError;
```

### 1.3 Create CSS Styles

**File: `src/styles/text-summarizer.css`**

```css
/* ============================================
   Text Selection Summarizer - Content Script Styles
   ============================================ */

/* Floating Summarize Button */
.summarize-button {
    position: absolute;
    z-index: 2147483647;
    
    display: flex;
    align-items: center;
    justify-content: center;
    
    width: 36px;
    height: 36px;
    padding: 0;
    
    background: rgba(30, 30, 30, 0.95);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    
    cursor: pointer;
    
    opacity: 0;
    transform: scale(0.8);
    animation: summarize-button-appear 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    
    transition: all 0.15s ease;
}

.summarize-button:hover {
    background: rgba(50, 50, 50, 0.95);
    transform: scale(1.1);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.summarize-button:active {
    transform: scale(0.95);
}

.summarize-button svg {
    width: 18px;
    height: 18px;
    color: white;
}

@keyframes summarize-button-appear {
    from {
        opacity: 0;
        transform: scale(0.8);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}

/* Tooltip on hover */
.summarize-button::after {
    content: 'Summarize';
    position: absolute;
    top: -32px;
    left: 50%;
    transform: translateX(-50%);
    
    padding: 4px 10px;
    
    background: rgba(30, 30, 30, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease;
}

.summarize-button:hover::after {
    opacity: 1;
}

/* ============================================
   Summary Popup
   ============================================ */

.summary-popup {
    position: absolute;
    z-index: 2147483647;
    
    width: 380px;
    max-width: 90vw;
    max-height: 400px;
    
    background: rgba(25, 25, 25, 0.98);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    
    box-shadow: 
        0 8px 40px rgba(0, 0, 0, 0.4),
        0 0 0 1px rgba(255, 255, 255, 0.05);
    
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: white;
    
    opacity: 0;
    transform: scale(0.95) translateY(8px);
    animation: summary-popup-appear 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    
    overflow: hidden;
}

@keyframes summary-popup-appear {
    from {
        opacity: 0;
        transform: scale(0.95) translateY(8px);
    }
    to {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}

/* Header */
.summary-popup__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    
    padding: 14px 16px;
    
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.summary-popup__title {
    display: flex;
    align-items: center;
    gap: 8px;
    
    margin: 0;
    
    font-size: 14px;
    font-weight: 600;
    color: white;
}

.summary-popup__title svg {
    width: 16px;
    height: 16px;
    color: #a78bfa;
}

.summary-popup__close {
    display: flex;
    align-items: center;
    justify-content: center;
    
    width: 28px;
    height: 28px;
    padding: 0;
    
    background: rgba(255, 255, 255, 0.05);
    border: none;
    border-radius: 6px;
    
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    
    transition: all 0.15s ease;
}

.summary-popup__close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
}

.summary-popup__close svg {
    width: 16px;
    height: 16px;
}

/* Content */
.summary-popup__content {
    padding: 16px;
    max-height: 280px;
    overflow-y: auto;
}

.summary-popup__content::-webkit-scrollbar {
    width: 6px;
}

.summary-popup__content::-webkit-scrollbar-track {
    background: transparent;
}

.summary-popup__content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
}

.summary-popup__text {
    margin: 0;
    
    font-size: 14px;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.9);
    
    white-space: pre-wrap;
    word-wrap: break-word;
}

/* Streaming cursor */
.summary-popup__cursor {
    display: inline-block;
    color: #a78bfa;
    animation: cursor-blink 0.8s infinite;
}

@keyframes cursor-blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
}

/* Loading state */
.summary-popup__loading {
    padding: 32px 16px;
    text-align: center;
}

.summary-popup__shimmer {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.summary-popup__shimmer-line {
    height: 14px;
    background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0.06) 0%,
        rgba(255, 255, 255, 0.12) 50%,
        rgba(255, 255, 255, 0.06) 100%
    );
    background-size: 200% 100%;
    border-radius: 6px;
    animation: shimmer 1.5s infinite;
}

.summary-popup__shimmer-line:nth-child(1) { width: 100%; }
.summary-popup__shimmer-line:nth-child(2) { width: 90%; }
.summary-popup__shimmer-line:nth-child(3) { width: 75%; }
.summary-popup__shimmer-line:nth-child(4) { width: 60%; }

@keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

/* Actions */
.summary-popup__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    
    padding: 12px 16px;
    
    background: rgba(255, 255, 255, 0.02);
    border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.summary-popup__action-button {
    display: flex;
    align-items: center;
    gap: 6px;
    
    padding: 8px 14px;
    
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
    font-weight: 500;
    
    cursor: pointer;
    transition: all 0.15s ease;
}

.summary-popup__action-button:hover {
    background: rgba(255, 255, 255, 0.1);
}

.summary-popup__action-button svg {
    width: 14px;
    height: 14px;
}

.summary-popup__action-button--primary {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.3);
    color: #c4b5fd;
}

.summary-popup__action-button--primary:hover {
    background: rgba(139, 92, 246, 0.3);
}

/* Error state */
.summary-popup__error {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    
    padding: 16px;
    
    background: rgba(239, 68, 68, 0.1);
    border-radius: 8px;
    
    color: #fca5a5;
    font-size: 13px;
    line-height: 1.5;
}

.summary-popup__error svg {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    color: #f87171;
}

/* Toast notification */
.summary-toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    
    padding: 10px 18px;
    
    background: rgba(30, 30, 30, 0.95);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
    font-weight: 500;
    
    opacity: 0;
    animation: toast-appear 0.3s ease forwards;
}

@keyframes toast-appear {
    from {
        opacity: 0;
        transform: translateX(-50%) translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
    }
}

/* Reduce motion */
@media (prefers-reduced-motion: reduce) {
    .summarize-button,
    .summary-popup,
    .summary-popup__shimmer-line,
    .summary-popup__cursor,
    .summary-toast {
        animation: none !important;
        transition-duration: 0.1s !important;
    }
}
```

### Tasks:
- [ ] Create `src/utils/textSummarizerSettings.ts`
- [ ] Create `src/types/textSummarizer.ts`
- [ ] Create `src/styles/text-summarizer.css`

---

## Phase 2: Background Service Implementation
**Estimated Time: 2-3 hours**

### 2.1 Gemini Summarizer Client

**File: `src/background/summarizer/geminiSummarizer.ts`**

```typescript
import { getGoogleApiKey } from '@/utils/providerCredentials';
import { createLogger } from '~logger';

const log = createLogger('GeminiSummarizer', 'BACKGROUND');

export interface SummarizerOptions {
    summaryType: 'key-points' | 'tl-dr' | 'headline' | 'teaser';
    summaryLength: 'short' | 'medium' | 'long';
    pageContext?: {
        title: string;
        url: string;
        domain: string;
    };
}

const SUMMARY_TYPE_INSTRUCTIONS: Record<string, string> = {
    'key-points': 'Extract the key points from the text as a bulleted list. Focus on the main ideas and important details.',
    'tl-dr': 'Provide a concise TL;DR summary of the text. Capture the essence in 2-3 sentences.',
    'headline': 'Create a single headline that captures the main idea of the text.',
    'teaser': 'Write a brief teaser that would make someone want to read the full text.',
};

const SUMMARY_LENGTH_TOKENS: Record<string, number> = {
    'short': 100,
    'medium': 250,
    'long': 500,
};

export class GeminiSummarizer {
    private model = 'gemini-2.5-flash';
    private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    private buildSystemPrompt(options: SummarizerOptions): string {
        const typeInstruction = SUMMARY_TYPE_INSTRUCTIONS[options.summaryType] || SUMMARY_TYPE_INSTRUCTIONS['tl-dr'];
        
        let contextInfo = '';
        if (options.pageContext) {
            contextInfo = `\n\nContext: This text was selected from "${options.pageContext.title}" (${options.pageContext.domain}).`;
        }

        return `You are a helpful text summarizer. Your task is to summarize the selected text clearly and concisely.

${typeInstruction}${contextInfo}

Important:
- Focus only on the selected text
- Be accurate and don't add information not present in the text
- Use clear, easy-to-understand language
- Format appropriately for the summary type requested`;
    }

    /**
     * Streaming summarization using Gemini API SSE
     */
    async *summarizeStream(
        text: string,
        options: SummarizerOptions
    ): AsyncGenerator<string, void, unknown> {
        const apiKey = await getGoogleApiKey();
        
        if (!apiKey) {
            throw new Error('Google API key not configured. Please add your API key in settings.');
        }

        const url = `${this.baseUrl}/models/${this.model}:streamGenerateContent?alt=sse&key=${apiKey}`;

        const systemPrompt = this.buildSystemPrompt(options);
        const maxTokens = SUMMARY_LENGTH_TOKENS[options.summaryLength] || 250;

        const body = {
            contents: [{
                role: 'user',
                parts: [{ text: `Please summarize the following text:\n\n${text}` }]
            }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: maxTokens,
                topP: 0.9,
            }
        };

        log.debug('Starting summary stream', { textLength: text.length, options });

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            log.error('Gemini API error', { status: response.status, error: errorText });
            throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Process complete SSE lines
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();
                        if (data && data !== '[DONE]') {
                            try {
                                const parsed = JSON.parse(data);
                                const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                                if (text) {
                                    yield text;
                                }
                            } catch {
                                // Skip malformed JSON
                            }
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    /**
     * Non-streaming summarization (for quick summaries)
     */
    async summarize(text: string, options: SummarizerOptions): Promise<string> {
        let result = '';
        for await (const chunk of this.summarizeStream(text, options)) {
            result += chunk;
        }
        return result;
    }
}

export const geminiSummarizer = new GeminiSummarizer();
```

### 2.2 Message Handler

**File: `src/background/summarizer/handler.ts`**

```typescript
import { createLogger } from '~logger';
import { geminiSummarizer, SummarizerOptions } from './geminiSummarizer';
import type { SummarizeRequest } from '@/types/textSummarizer';

const log = createLogger('SummarizerHandler', 'BACKGROUND');

/**
 * Handle summarize request with streaming response
 */
export async function handleSummarizeRequest(
    request: SummarizeRequest,
    port: chrome.runtime.Port
): Promise<void> {
    const { text, pageContext, settings } = request.payload;

    log.info('Processing summarize request', {
        textLength: text.length,
        domain: pageContext?.domain,
    });

    const options: SummarizerOptions = {
        summaryType: settings?.summaryType || 'tl-dr',
        summaryLength: settings?.summaryLength || 'medium',
        pageContext,
    };

    try {
        // Stream chunks back via port
        for await (const chunk of geminiSummarizer.summarizeStream(text, options)) {
            port.postMessage({
                action: 'SUMMARIZE_STREAM_CHUNK',
                text: chunk,
                done: false,
            });
        }

        // Signal completion
        port.postMessage({
            action: 'SUMMARIZE_STREAM_CHUNK',
            text: '',
            done: true,
        });

        log.info('Summary stream completed');
    } catch (error) {
        log.error('Summarization failed', error);
        
        port.postMessage({
            action: 'SUMMARIZE_ERROR',
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            code: 'SUMMARIZE_FAILED',
        });
    }
}
```

### 2.3 Export Module

**File: `src/background/summarizer/index.ts`**

```typescript
export { geminiSummarizer, GeminiSummarizer } from './geminiSummarizer';
export type { SummarizerOptions } from './geminiSummarizer';
export { handleSummarizeRequest } from './handler';
```

### 2.4 Register Port Listener in Router

**Update: `src/background/messaging/router.ts`**

Add port connection handling for summarizer:

```typescript
import { handleSummarizeRequest } from '../summarizer';

// Add at the bottom of initializeMessageRouter() or create new function:
export function initializeSummarizerPortListener(): void {
    chrome.runtime.onConnect.addListener((port) => {
        if (port.name === 'text-summarizer') {
            backgroundLog.info('Text summarizer port connected');
            
            port.onMessage.addListener(async (message) => {
                if (message.action === 'SUMMARIZE_REQUEST') {
                    await handleSummarizeRequest(message, port);
                }
            });
            
            port.onDisconnect.addListener(() => {
                backgroundLog.debug('Text summarizer port disconnected');
            });
        }
    });
}
```

### 2.5 Initialize in Background

**Update: `src/background.ts`**

Import and initialize the summarizer port listener.

### Tasks:
- [ ] Create `src/background/summarizer/geminiSummarizer.ts`
- [ ] Create `src/background/summarizer/handler.ts`
- [ ] Create `src/background/summarizer/index.ts`
- [ ] Update `src/background/messaging/router.ts` with port listener
- [ ] Update `src/background.ts` to initialize summarizer

---

## Phase 3: Content Script Implementation
**Estimated Time: 3-4 hours**

### 3.1 Text Selection Hook

**File: `src/contents/text-summarizer/useTextSelection.ts`**

```typescript
import { useCallback, useEffect, useState } from 'react';
import { isTextSummarizerEnabled } from '@/utils/textSummarizerSettings';

export interface Position {
    x: number;
    y: number;
}

export interface TextSelection {
    text: string;
    position: Position;
    show: boolean;
}

const BUTTON_OFFSET_X = 8;
const BUTTON_OFFSET_Y = -4;
const DEFAULT_MIN_LENGTH = 100;

export function useTextSelection(minTextLength: number = DEFAULT_MIN_LENGTH) {
    const [selection, setSelection] = useState<TextSelection>({
        text: '',
        position: { x: 0, y: 0 },
        show: false,
    });
    const [isEnabled, setIsEnabled] = useState(true);

    // Check if feature is enabled on mount
    useEffect(() => {
        isTextSummarizerEnabled().then(setIsEnabled);
    }, []);

    const resetSelection = useCallback(() => {
        setSelection({
            text: '',
            position: { x: 0, y: 0 },
            show: false,
        });
    }, []);

    const handleSelection = useCallback(() => {
        if (!isEnabled) return;

        const windowSelection = window.getSelection();
        const text = windowSelection?.toString().trim();

        if (text && text.length >= minTextLength) {
            const range = windowSelection?.getRangeAt(0);
            if (range) {
                const rects = range.getClientRects();
                if (rects.length > 0) {
                    // Position at the end of selection
                    const lastRect = rects[rects.length - 1];
                    const x = lastRect.right + window.scrollX + BUTTON_OFFSET_X;
                    const y = lastRect.top + window.scrollY + BUTTON_OFFSET_Y;

                    setSelection({
                        text,
                        position: { x, y },
                        show: true,
                    });
                }
            }
        } else {
            setSelection((prev) => ({ ...prev, show: false }));
        }
    }, [isEnabled, minTextLength]);

    const handleSelectionChange = useCallback(() => {
        const windowSelection = window.getSelection();
        const text = windowSelection?.toString().trim();

        if (!text) {
            setSelection((prev) => ({ ...prev, show: false }));
        }
    }, []);

    useEffect(() => {
        document.addEventListener('mouseup', handleSelection);
        document.addEventListener('selectionchange', handleSelectionChange);

        return () => {
            document.removeEventListener('mouseup', handleSelection);
            document.removeEventListener('selectionchange', handleSelectionChange);
        };
    }, [handleSelection, handleSelectionChange]);

    return { selection, setSelection, resetSelection, isEnabled };
}
```

### 3.2 Floating Button Component

**File: `src/contents/text-summarizer/SummarizeButton.tsx`**

```tsx
import type { Position } from './useTextSelection';

interface SummarizeButtonProps {
    position: Position;
    onClick: () => void;
}

export function SummarizeButton({ position, onClick }: SummarizeButtonProps) {
    return (
        <button
            className="summarize-button"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
            }}
            onClick={onClick}
            aria-label="Summarize selected text"
        >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
            </svg>
        </button>
    );
}
```

### 3.3 Summary Popup Component

**File: `src/contents/text-summarizer/SummaryPopup.tsx`**

```tsx
import { useState, useEffect, useRef } from 'react';
import type { Position } from './useTextSelection';

interface SummaryPopupProps {
    position: Position;
    summary: string;
    isLoading: boolean;
    isStreaming: boolean;
    error: string | null;
    onClose: () => void;
    onSendToSidepanel: () => void;
}

export function SummaryPopup({
    position,
    summary,
    isLoading,
    isStreaming,
    error,
    onClose,
    onSendToSidepanel,
}: SummaryPopupProps) {
    const [toast, setToast] = useState<string | null>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    // Calculate position to keep popup in viewport
    const getAdjustedPosition = () => {
        const padding = 16;
        const popupWidth = 380;
        const popupHeight = 300;
        
        let adjustedX = position.x;
        let adjustedY = position.y + 40; // Below the button

        // Adjust horizontal position
        if (adjustedX + popupWidth > window.innerWidth - padding) {
            adjustedX = window.innerWidth - popupWidth - padding;
        }
        if (adjustedX < padding) {
            adjustedX = padding;
        }

        // Adjust vertical position
        if (adjustedY + popupHeight > window.innerHeight + window.scrollY - padding) {
            adjustedY = position.y - popupHeight - 8; // Above the selection
        }

        return { x: adjustedX, y: adjustedY };
    };

    const adjustedPos = getAdjustedPosition();

    // Handle copy to clipboard
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(summary);
            setToast('Copied to clipboard!');
            setTimeout(() => setToast(null), 2000);
        } catch {
            setToast('Failed to copy');
            setTimeout(() => setToast(null), 2000);
        }
    };

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        // Handle escape key
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    return (
        <>
            <div
                ref={popupRef}
                className="summary-popup"
                style={{
                    left: `${adjustedPos.x}px`,
                    top: `${adjustedPos.y}px`,
                }}
            >
                {/* Header */}
                <div className="summary-popup__header">
                    <h2 className="summary-popup__title">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
                        </svg>
                        Summary
                    </h2>
                    <button
                        className="summary-popup__close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                {isLoading && !summary ? (
                    <div className="summary-popup__loading">
                        <div className="summary-popup__shimmer">
                            <div className="summary-popup__shimmer-line" />
                            <div className="summary-popup__shimmer-line" />
                            <div className="summary-popup__shimmer-line" />
                            <div className="summary-popup__shimmer-line" />
                        </div>
                    </div>
                ) : error ? (
                    <div className="summary-popup__content">
                        <div className="summary-popup__error">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
                            </svg>
                            <span>{error}</span>
                        </div>
                    </div>
                ) : (
                    <div className="summary-popup__content">
                        <p className="summary-popup__text">
                            {summary}
                            {isStreaming && <span className="summary-popup__cursor">▊</span>}
                        </p>
                    </div>
                )}

                {/* Actions - only show when we have summary */}
                {summary && !error && (
                    <div className="summary-popup__actions">
                        <button
                            className="summary-popup__action-button"
                            onClick={handleCopy}
                            disabled={isStreaming}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" />
                                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                            </svg>
                            Copy
                        </button>
                        <button
                            className="summary-popup__action-button summary-popup__action-button--primary"
                            onClick={onSendToSidepanel}
                            disabled={isStreaming}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Ask Cognito
                        </button>
                    </div>
                )}
            </div>

            {/* Toast notification */}
            {toast && <div className="summary-toast">{toast}</div>}
        </>
    );
}
```

### 3.4 Summarizer Hook

**File: `src/contents/text-summarizer/useSummarizer.ts`**

```typescript
import { useCallback, useState, useRef } from 'react';
import { getTextSummarizerSettings } from '@/utils/textSummarizerSettings';
import type { SummarizeRequest, SummarizeMessage } from '@/types/textSummarizer';

interface SummarizerState {
    summary: string;
    isLoading: boolean;
    isStreaming: boolean;
    error: string | null;
}

export function useSummarizer() {
    const [state, setState] = useState<SummarizerState>({
        summary: '',
        isLoading: false,
        isStreaming: false,
        error: null,
    });
    
    const portRef = useRef<chrome.runtime.Port | null>(null);

    const resetSummary = useCallback(() => {
        // Disconnect existing port if any
        if (portRef.current) {
            portRef.current.disconnect();
            portRef.current = null;
        }

        setState({
            summary: '',
            isLoading: false,
            isStreaming: false,
            error: null,
        });
    }, []);

    const summarize = useCallback(async (text: string) => {
        if (!text) return;

        // Reset and start loading
        setState({
            summary: '',
            isLoading: true,
            isStreaming: false,
            error: null,
        });

        try {
            // Get settings
            const settings = await getTextSummarizerSettings();

            // Get page context
            const pageContext = {
                title: document.title,
                url: window.location.href,
                domain: window.location.hostname,
            };

            // Connect to background via port for streaming
            const port = chrome.runtime.connect({ name: 'text-summarizer' });
            portRef.current = port;

            port.onMessage.addListener((message: SummarizeMessage) => {
                if (message.action === 'SUMMARIZE_STREAM_CHUNK') {
                    setState((prev) => ({
                        ...prev,
                        summary: prev.summary + message.text,
                        isLoading: false,
                        isStreaming: !message.done,
                    }));
                } else if (message.action === 'SUMMARIZE_ERROR') {
                    setState({
                        summary: '',
                        isLoading: false,
                        isStreaming: false,
                        error: message.error,
                    });
                }
            });

            port.onDisconnect.addListener(() => {
                portRef.current = null;
            });

            // Send request
            const request: SummarizeRequest = {
                action: 'SUMMARIZE_REQUEST',
                payload: {
                    text,
                    pageContext,
                    settings: {
                        summaryType: settings.summaryType,
                        summaryLength: settings.summaryLength,
                    },
                },
            };

            port.postMessage(request);
        } catch (error) {
            setState({
                summary: '',
                isLoading: false,
                isStreaming: false,
                error: error instanceof Error ? error.message : 'Failed to start summarization',
            });
        }
    }, []);

    return {
        ...state,
        summarize,
        resetSummary,
    };
}
```

### 3.5 Main Content Script

**File: `src/contents/text-summarizer.tsx`**

```tsx
import type { PlasmoCSConfig } from 'plasmo';
import { useCallback, useState } from 'react';
import cssText from 'data-text:~/styles/text-summarizer.css';

import { useTextSelection } from './text-summarizer/useTextSelection';
import { useSummarizer } from './text-summarizer/useSummarizer';
import { SummarizeButton } from './text-summarizer/SummarizeButton';
import { SummaryPopup } from './text-summarizer/SummaryPopup';

export const config: PlasmoCSConfig = {
    matches: ['<all_urls>'],
    all_frames: false,
    // Exclude extension pages and chrome:// URLs
    exclude_matches: [
        'chrome://*',
        'chrome-extension://*',
        'moz-extension://*',
    ],
};

export const getStyle = () => {
    const style = document.createElement('style');
    style.textContent = cssText;
    return style;
};

function TextSummarizerContent() {
    const { selection, setSelection, resetSelection, isEnabled } = useTextSelection();
    const { summary, isLoading, isStreaming, error, summarize, resetSummary } = useSummarizer();
    const [showPopup, setShowPopup] = useState(false);
    const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });

    // Handle button click - start summarization
    const handleButtonClick = useCallback(() => {
        // Save position for popup
        setPopupPosition(selection.position);
        
        // Hide button, show popup
        setSelection((prev) => ({ ...prev, show: false }));
        setShowPopup(true);
        
        // Start summarization
        void summarize(selection.text);
    }, [selection, setSelection, summarize]);

    // Handle popup close
    const handleClose = useCallback(() => {
        setShowPopup(false);
        resetSelection();
        resetSummary();
    }, [resetSelection, resetSummary]);

    // Handle "Ask Cognito" - send to sidepanel
    const handleSendToSidepanel = useCallback(() => {
        // Send message to background to open sidepanel with context
        chrome.runtime.sendMessage({
            action: 'OPEN_SIDEBAR_WITH_MESSAGE',
            payload: {
                message: `Here's a summary of text I selected:\n\n${summary}\n\nOriginal text:\n${selection.text.slice(0, 500)}${selection.text.length > 500 ? '...' : ''}`,
            },
        });

        handleClose();
    }, [summary, selection.text, handleClose]);

    // Don't render if disabled
    if (!isEnabled) return null;

    return (
        <>
            {/* Floating summarize button */}
            {selection.show && !showPopup && (
                <SummarizeButton
                    position={selection.position}
                    onClick={handleButtonClick}
                />
            )}

            {/* Summary popup */}
            {showPopup && (
                <SummaryPopup
                    position={popupPosition}
                    summary={summary}
                    isLoading={isLoading}
                    isStreaming={isStreaming}
                    error={error}
                    onClose={handleClose}
                    onSendToSidepanel={handleSendToSidepanel}
                />
            )}
        </>
    );
}

export default TextSummarizerContent;
```

### Tasks:
- [ ] Create `src/contents/text-summarizer/useTextSelection.ts`
- [ ] Create `src/contents/text-summarizer/useSummarizer.ts`
- [ ] Create `src/contents/text-summarizer/SummarizeButton.tsx`
- [ ] Create `src/contents/text-summarizer/SummaryPopup.tsx`
- [ ] Create `src/contents/text-summarizer.tsx`

---

## Phase 4: Settings UI Integration
**Estimated Time: 1-2 hours**

### 4.1 Settings Component

**File: `src/components/features/settings/components/TextSummarizerSettings.tsx`**

```tsx
import { useState, useEffect } from 'react';
import {
    getTextSummarizerSettings,
    saveTextSummarizerSettings,
    DEFAULT_SUMMARIZER_SETTINGS,
    type TextSummarizerSettings as Settings,
} from '@/utils/textSummarizerSettings';

export function TextSummarizerSettings() {
    const [settings, setSettings] = useState<Settings>(DEFAULT_SUMMARIZER_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getTextSummarizerSettings().then((s) => {
            setSettings(s);
            setLoading(false);
        });
    }, []);

    const handleChange = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        setSaving(true);
        
        try {
            await saveTextSummarizerSettings(newSettings);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-4">Loading settings...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-sm font-medium text-white">
                        Text Selection Summarizer
                    </h4>
                    <p className="text-xs text-white/60 mt-1">
                        Show a summarize icon when you select text on any page
                    </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={settings.enabled}
                        onChange={(e) => handleChange('enabled', e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
            </div>

            {settings.enabled && (
                <>
                    <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                            Minimum text length
                        </label>
                        <select
                            value={settings.minTextLength}
                            onChange={(e) => handleChange('minTextLength', Number(e.target.value))}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                        >
                            <option value={50}>50 characters</option>
                            <option value={100}>100 characters (default)</option>
                            <option value={200}>200 characters</option>
                            <option value={500}>500 characters</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                            Summary type
                        </label>
                        <select
                            value={settings.summaryType}
                            onChange={(e) => handleChange('summaryType', e.target.value as Settings['summaryType'])}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                        >
                            <option value="tl-dr">TL;DR (concise summary)</option>
                            <option value="key-points">Key Points (bullet list)</option>
                            <option value="headline">Headline (one line)</option>
                            <option value="teaser">Teaser (engaging preview)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                            Summary length
                        </label>
                        <select
                            value={settings.summaryLength}
                            onChange={(e) => handleChange('summaryLength', e.target.value as Settings['summaryLength'])}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                        >
                            <option value="short">Short (~50 words)</option>
                            <option value="medium">Medium (~100 words)</option>
                            <option value="long">Long (~200 words)</option>
                        </select>
                    </div>
                </>
            )}

            {saving && (
                <p className="text-xs text-white/40">Saving...</p>
            )}
        </div>
    );
}
```

### 4.2 Add to Settings Screen

Update `src/components/features/settings/SettingsScreen.tsx` to include the new settings component.

### Tasks:
- [ ] Create `src/components/features/settings/components/TextSummarizerSettings.tsx`
- [ ] Update SettingsScreen to include TextSummarizerSettings
- [ ] Add icon/visual for the settings section

---

## Phase 5: Error Handling & Edge Cases
**Estimated Time: 1-2 hours**

### 5.1 Error Handling

```typescript
// Error scenarios to handle:
// 1. No API key configured → Show "Configure API key in settings"
// 2. API rate limiting → Show retry message
// 3. Network errors → Show "Check your connection"
// 4. Invalid response → Show generic error
// 5. Text too long → Truncate with warning
// 6. Port disconnected during streaming → Clean up gracefully
```

### 5.2 Edge Cases

```typescript
// Edge cases to handle:
// 1. User clicks outside popup → Close
// 2. User presses Escape → Close
// 3. Selection cleared while loading → Cancel and close
// 4. Page navigation during stream → Abort and cleanup
// 5. Multiple rapid selections → Debounce/cancel previous
// 6. Selection in iframes → Skip (all_frames: false)
// 7. Selection in editable elements → Consider skipping
// 8. Very large text selections → Truncate to ~10k chars
```

### 5.3 Text Length Validation

**Update `useSummarizer.ts`:**

```typescript
const MAX_TEXT_LENGTH = 10000;

const summarize = useCallback(async (text: string) => {
    if (!text) return;

    // Truncate very long text
    let processedText = text;
    if (text.length > MAX_TEXT_LENGTH) {
        processedText = text.slice(0, MAX_TEXT_LENGTH);
        console.warn(`Text truncated from ${text.length} to ${MAX_TEXT_LENGTH} chars`);
    }

    // ... rest of summarize logic
}, []);
```

### Tasks:
- [ ] Add text length validation and truncation
- [ ] Handle port disconnection gracefully
- [ ] Add debouncing for rapid selections
- [ ] Test all error scenarios

---

## Phase 6: Testing & Polish
**Estimated Time: 2-3 hours**

### 6.1 Test Matrix

| Site | Test Case | Expected Behavior |
|------|-----------|-------------------|
| Wikipedia | Select article paragraph | Button appears, summary works |
| News site | Select article text | Button appears, context-aware summary |
| GitHub | Select README content | Markdown-friendly summary |
| Twitter/X | Select tweet | Short summary appropriate |
| PDF viewer | Select text | May not work (limitation) |
| Google Docs | Select text | May not work (iframe) |

### 6.2 Compatibility Testing

- [ ] Test on Chrome 120+
- [ ] Test with slow network (3G throttling)
- [ ] Test long selections (5000+ chars)
- [ ] Test rapid selection changes
- [ ] Test in different viewport sizes
- [ ] Test with zoom levels (100%, 150%, 200%)

### 6.3 Performance Testing

- [ ] First token latency < 1s (good connection)
- [ ] UI responsive during streaming
- [ ] No memory leaks (repeated open/close)
- [ ] Button appears within 100ms of selection

### Tasks:
- [ ] Create test plan
- [ ] Execute manual tests
- [ ] Fix identified issues
- [ ] Polish animations and transitions

---

## File Structure Summary

```
src/
├── contents/
│   ├── text-summarizer.tsx                  # Main content script entry
│   └── text-summarizer/
│       ├── useTextSelection.ts              # Text selection detection hook
│       ├── useSummarizer.ts                 # Summarization logic hook
│       ├── SummarizeButton.tsx              # Floating button component
│       └── SummaryPopup.tsx                 # Summary display popup
├── background/
│   ├── messaging/
│   │   └── router.ts                        # Add port listener (update)
│   └── summarizer/
│       ├── index.ts                         # Module exports
│       ├── geminiSummarizer.ts              # Gemini API client
│       └── handler.ts                       # Message handler
├── utils/
│   └── textSummarizerSettings.ts            # Settings storage
├── types/
│   └── textSummarizer.ts                    # Type definitions
├── styles/
│   └── text-summarizer.css                  # Component styles
└── components/
    └── features/
        └── settings/
            └── components/
                └── TextSummarizerSettings.tsx  # Settings UI
```

---

## Dependencies

**No new dependencies required!** Uses:
- Native `fetch` API for Gemini REST calls
- Chrome Extension APIs (`chrome.runtime`, `chrome.storage`)
- React (already installed via Plasmo)
- Existing styling patterns

---

## Estimated Total Time

| Phase | Estimated Time |
|-------|----------------|
| Phase 1: Foundation | 1-2 hours |
| Phase 2: Background Service | 2-3 hours |
| Phase 3: Content Script | 3-4 hours |
| Phase 4: Settings UI | 1-2 hours |
| Phase 5: Error Handling | 1-2 hours |
| Phase 6: Testing | 2-3 hours |
| **Total** | **10-16 hours** |

---

## Key Differences from Glancy

| Feature | Glancy | Cognito Implementation |
|---------|--------|------------------------|
| AI Model | Gemini Nano (built-in) | Gemini API (remote) |
| API calls | Content script direct | Background service worker |
| Streaming | Summarizer API | SSE from REST API |
| Dependencies | Radix UI | Custom components |
| Styling | SCSS Modules | Plain CSS |
| Shadow DOM | react-shadow | Plasmo built-in |

---

## Future Enhancements (Post-MVP)

1. **Translate summary** - Add translation to other languages
2. **Custom prompts** - Let users define summary style
3. **History** - Remember recent summaries
4. **Keyboard shortcut** - Trigger summarize without clicking
5. **Export options** - Save to Notion, markdown file
6. **Speak summary** - Text-to-speech integration
7. **Compare with original** - Side-by-side view

---

## Success Criteria

- [ ] Summarize button appears when selecting 100+ chars
- [ ] Button positioned correctly at end of selection
- [ ] Summary streams in real-time with cursor animation
- [ ] Copy to clipboard works
- [ ] "Ask Cognito" opens sidepanel with context
- [ ] Works on major websites (Wikipedia, news, GitHub)
- [ ] Settings allow customization
- [ ] Error states handled gracefully
- [ ] No memory leaks or performance issues
- [ ] Feature can be disabled in settings
