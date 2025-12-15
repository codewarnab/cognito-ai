# Content to Chat API - Multi-Phase Implementation Plan

> **Feature**: Allow websites to send content to Cognito's chat input safely
> **Status**: Planning
> **Created**: December 2024

## Table of Contents

1. [Overview](#overview)
2. [Use Cases](#use-cases)
3. [Architecture](#architecture)
4. [Security Model](#security-model)
5. [API Design](#api-design)
6. [Phase 1: Core Infrastructure](#phase-1-core-infrastructure)
7. [Phase 2: Developer SDK](#phase-2-developer-sdk)
8. [Phase 3: Documentation Site](#phase-3-documentation-site)
9. [Phase 4: WebMCP Integration](#phase-4-webmcp-integration)
10. [Phase 5: Advanced Features](#phase-5-advanced-features)
11. [Timeline Estimate](#timeline-estimate)

---

## Overview

### What This Feature Does

Provides a **type-safe, secure API** for websites to send content to Cognito's chat input. This enables "Ask AI" buttons on any website that seamlessly integrate with Cognito.

### Core Principles

1. **User Control First**: Websites can only populate the chat input - user decides to send
2. **Extension Controls AI**: System prompts, tools, and AI behavior are defined by extension only
3. **Transparent**: Users always know when content came from an external source
4. **Opt-in Security**: Users can enable/disable this feature per-domain or globally

### What Websites CAN Do

- ✅ Send text content to chat input (always populates, never auto-sends)
- ✅ Detect if Cognito extension is installed
- ✅ Open sidepanel with content ready for user to send

### What Websites CANNOT Do

- ❌ Auto-send messages (user must always press send)
- ❌ Modify system prompts or AI behavior
- ❌ Execute tools or WebMCP calls directly
- ❌ Access chat history or memory
- ❌ Attach files or media
- ❌ Bypass rate limits or user settings
- ❌ Send content without user awareness

---

## Use Cases

### 1. E-Commerce Product Analysis

```
User on Amazon product page
    → Clicks "Ask Cognito" button
    → Product details sent to chat: "Analyze this product: [title, price, reviews]"
    → User reviews and sends
    → Cognito provides analysis
```

### 2. Documentation "Explain This"

```
User on MDN/docs site reading complex API
    → Clicks "Explain with AI" button
    → Code snippet + context sent to chat
    → Cognito explains in simple terms
```

### 3. News Article Summarization

```
User on news website
    → Clicks "Summarize" button
    → Article text sent to chat
    → Cognito provides summary
```

### 4. GitHub PR/Issue Analysis

```
User viewing GitHub PR
    → Clicks "Analyze Changes" button
    → Diff/description sent to chat
    → Cognito explains changes
```

### 5. Research Paper Summarization

```
User on academic paper site
    → Clicks "Summarize Findings" button
    → Abstract + key sections sent to chat
    → Cognito provides research summary
```

### 6. E-Learning Quiz Generation

```
User on educational platform
    → Clicks "Quiz Me" button
    → Lesson content sent to chat
    → Cognito generates quiz questions
```

### 7. WebMCP-Enabled Workflow Triggers (Phase 4)

```
User on project management tool (with WebMCP)
    → Clicks "Create Task in Notion" button
    → Sends prompt + hints about available WebMCP tools
    → Cognito uses WebMCP tools to complete action
```

---

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              WEBSITE                                         │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  import { sendToChat, onReady } from '@cognito/web-sdk';            │   │
│   │                                                                      │   │
│   │  onReady(() => showButton());                                       │   │
│   │                                                                      │   │
│   │  button.onclick = () => sendToChat("Explain this...");             │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
└──────────────────────────────────────┼───────────────────────────────────────┘
                                       │ window.postMessage
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COGNITO CONTENT SCRIPT                               │
│                         (content-to-chat-bridge.content.ts)                  │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  1. Receive postMessage from SDK                                    │   │
│   │  2. Validate & sanitize content (string, max 10KB)                 │   │
│   │  3. Check rate limits (5 req/min)                                   │   │
│   │  4. Forward to background via chrome.runtime.sendMessage            │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
└──────────────────────────────────────┼───────────────────────────────────────┘
                                       │ chrome.runtime.sendMessage
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       BACKGROUND SERVICE WORKER                              │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  Message Handler: 'content-to-chat/send'                            │   │
│   │                                                                      │   │
│   │  1. ALWAYS open sidepanel                                           │   │
│   │  2. Log domain for transparency                                     │   │
│   │  3. Forward to sidepanel via runtime message                        │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
└──────────────────────────────────────┼───────────────────────────────────────┘
                                       │ chrome.runtime.sendMessage
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SIDEPANEL                                       │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  useBackgroundMessageListener hook                                   │   │
│   │                                                                      │   │
│   │  case 'content-to-chat/receive':                                    │   │
│   │    1. Populate chat input with content                              │   │
│   │    2. Show source badge: "From: example.com"                        │   │
│   │    3. User reviews and presses Send (NEVER auto-send)               │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Message Flow Sequence

```
Website                Content Script          Background           Sidepanel
   │                        │                      │                    │
   │  sendToChat("...")     │                      │                    │
   │  (SDK handles postMsg) │                      │                    │
   │───────────────────────►│                      │                    │
   │                        │                      │                    │
   │                        │  Validate:           │                    │
   │                        │  - Must be string    │                    │
   │                        │  - Max 10,000 chars  │                    │
   │                        │  - Check rate limit  │                    │
   │                        │                      │                    │
   │                        │  chrome.runtime      │                    │
   │                        │  .sendMessage()      │                    │
   │                        │─────────────────────►│                    │
   │                        │                      │                    │
   │                        │                      │  ALWAYS open      │
   │                        │                      │  sidepanel        │
   │                        │                      │                    │
   │                        │                      │  Forward message  │
   │                        │                      │─────────────────►│
   │                        │                      │                    │
   │                        │                      │                    │  Populate input
   │                        │                      │                    │  Show "From: domain"
   │                        │                      │                    │  Wait for user Send
   │                        │                      │                    │
   │                        │◄─────────────────────┼────────────────────│
   │◄───────────────────────│  { success: true }   │                    │
   │                        │                      │                    │
```

---

## Security Model

### Layer 1: Content Sanitization

```typescript
function sanitizeContent(raw: unknown): string {
  // Must be string
  if (typeof raw !== 'string') {
    throw new ValidationError('Content must be a string');
  }
  
  // Length limit (10KB max)
  const MAX_LENGTH = 10_000;
  if (raw.length > MAX_LENGTH) {
    throw new ValidationError(`Content exceeds ${MAX_LENGTH} character limit`);
  }
  
  // Strip HTML tags (prevent injection)
  const stripped = raw.replace(/<[^>]*>/g, '');
  
  // Normalize whitespace
  const normalized = stripped.replace(/\s+/g, ' ').trim();
  
  return normalized;
}
```

### Layer 2: Rate Limiting

```typescript
interface RateLimitConfig {
  maxRequestsPerMinute: 5;
  maxRequestsPerHour: 50;
  maxContentPerHour: 100_000; // characters
}

// Per-domain rate limiting stored in memory
const rateLimitMap = new Map<string, RateLimitState>();
```

### Layer 3: User Permissions

```typescript
interface ContentToChatSettings {
  // Global enable/disable
  enabled: boolean;
  
  // Domain-specific rules
  blockedDomains: string[];  // Blocklist - these domains cannot send content
}
```

### Layer 4: Source Attribution

When content comes from external source, UI clearly shows where it came from:

```
┌─────────────────────────────────────────────────────────────────┐
│  💬 Chat Input                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Explain this code snippet: function foo() {...}           │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────┐                          │
│  │ 📤 From: github.com   ✕ Clear     │                          │
│  └───────────────────────────────────┘                          │
│                                                      [Send ▶]   │
└─────────────────────────────────────────────────────────────────┘

User MUST press Send - content is NEVER auto-sent
```

### Layer 5: Audit Logging

```typescript
interface ContentToChatLog {
  timestamp: number;
  domain: string;
  contentLength: number;
  userAction: 'sent' | 'cleared' | 'modified';
}

// Stored locally, accessible in settings for user transparency
```

---

## API Design

### Design Principles

1. **Dead Simple** - Just one function: `sendToChat(content)`
2. **Type-Safe** - Import from SDK, no `window.cognito?.` patterns
3. **Always Opens Sidepanel** - Not optional, always happens
4. **Never Auto-Sends** - Always populates input, user must send manually

### TypeScript SDK API

```typescript
// @cognito/web-sdk - What developers import

/**
 * Response from sendToChat
 */
export interface SendToChatResult {
  success: boolean;
  error?: string;
}

/**
 * Check if Cognito extension is installed
 */
export function isInstalled(): boolean;

/**
 * Send content to Cognito chat input
 * - Always opens sidepanel
 * - Always populates input (user sends manually)
 * 
 * @param content - Text to add to chat input (max 10,000 characters)
 * @returns Promise with success status
 */
export function sendToChat(content: string): Promise<SendToChatResult>;

/**
 * Listen for when extension becomes ready
 * Useful for showing/hiding "Ask Cognito" buttons
 * 
 * @param callback - Called when extension is ready
 * @returns Cleanup function to stop listening
 */
export function onReady(callback: () => void): () => void;
```

### Website Usage Examples

#### Example 1: TypeScript/React Project (npm)

```typescript
// Install: npm install @cognito/web-sdk
import { isInstalled, sendToChat, onReady } from '@cognito/web-sdk';

// Show button only when extension is installed
onReady(() => {
  document.getElementById('ask-cognito-btn')!.style.display = 'block';
});

// Handle button click
document.getElementById('ask-cognito-btn')!.onclick = async () => {
  const selectedText = window.getSelection()?.toString() || '';
  
  const result = await sendToChat(`Explain this: ${selectedText}`);
  
  if (!result.success) {
    console.error('Failed:', result.error);
  }
};
```

#### Example 2: React Hook Usage

```tsx
import { useCognito } from '@cognito/web-sdk/react';

function ExplainButton() {
  const { isReady, sendToChat } = useCognito();
  
  if (!isReady) return null; // Hide if extension not installed
  
  const handleClick = async () => {
    const text = window.getSelection()?.toString() || '';
    await sendToChat(`Explain this code:\n\n${text}`);
  };
  
  return (
    <button onClick={handleClick}>
      🤖 Explain with Cognito
    </button>
  );
}
```

#### Example 3: No Build Step (Script Tag)

```html
<!-- Include SDK from CDN -->
<script src="https://cdn.cognito.dev/sdk.js"></script>

<button id="cognito-btn" style="display: none;">
  🤖 Ask Cognito
</button>

<script>
  // Show button when extension is ready
  Cognito.onReady(function() {
    document.getElementById('cognito-btn').style.display = 'block';
  });
  
  // Handle click
  document.getElementById('cognito-btn').onclick = function() {
    var text = window.getSelection().toString();
    Cognito.sendToChat('Explain: ' + text);
  };
</script>
```

#### Example 4: One-Liner for Simple Cases

```html
<button onclick="Cognito.sendToChat('Summarize this page: ' + document.body.innerText.slice(0, 5000))">
  Summarize Page
</button>
```

---

## Phase 1: Core Infrastructure

**Goal**: Build the secure content bridge between websites and Cognito sidepanel.

### Deliverables

1. **Content Script: `content-to-chat-bridge.content.ts`**
   - Inject SDK detection marker for `isInstalled()` checks
   - Listen for postMessage from SDK
   - Validate and sanitize content (string, max 10KB)
   - Forward to background service worker

2. **Background Handler: `contentToChatHandler.ts`**
   - Handle `content-to-chat/send` messages
   - ALWAYS open sidepanel
   - Forward content to sidepanel UI

3. **Sidepanel Integration**
   - Update `useBackgroundMessageListener` hook
   - Populate chat input with content
   - Show source badge: "From: example.com"

4. **Settings**
   - Add settings section for Content-to-Chat
   - Enable/disable toggle
   - Domain blocklist
   - View activity log

5. **Types**
   - `src/types/contentToChat.ts` - TypeScript interfaces

### File Structure

```
src/
├── entrypoints/
│   └── content-to-chat-bridge.content.ts    # NEW: Content script
├── background/
│   └── contentToChat/
│       ├── handler.ts                        # NEW: Message handler
│       ├── rateLimiter.ts                    # NEW: Rate limiting logic
│       └── index.ts                          # NEW: Exports
├── hooks/
│   └── sidepanel/
│       └── useBackgroundMessageListener.ts  # UPDATE: Add handler
├── components/
│   └── features/
│       └── chat/
│           └── components/
│               └── composer/
│                   └── ExternalSourceBadge.tsx  # NEW: Source badge
├── types/
│   └── contentToChat.ts                      # NEW: Type definitions
└── utils/
    └── contentToChat/
        └── sanitizer.ts                      # NEW: Content sanitization
```

### Implementation Details

#### 1. Content Script (MAIN world) - SDK Detection

```typescript
// src/entrypoints/content-to-chat-injector.content.ts

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  world: 'MAIN', // Run in page context
  
  main() {
    // Set marker that SDK can detect
    (window as any).__COGNITO_INSTALLED__ = true;
    
    // Dispatch ready event for SDK
    window.dispatchEvent(new CustomEvent('cognito:ready'));
  }
});
```

#### 2. Content Script (ISOLATED world) - Message Bridge

```typescript
// src/entrypoints/content-to-chat-bridge.content.ts

import { defineContentScript } from 'wxt/sandbox';
import { sanitizeContent } from '@/utils/contentToChat/sanitizer';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  world: 'ISOLATED', // Secure context with chrome.* APIs
  
  main() {
    // Listen for messages from SDK (via postMessage)
    window.addEventListener('message', async (event) => {
      if (event.source !== window) return;
      if (event.data?.type !== '__COGNITO_SEND_TO_CHAT__') return;
      
      const { id, content } = event.data;
      
      try {
        // Validate: must be string
        if (typeof content !== 'string') {
          throw new Error('Content must be a string');
        }
        
        // Sanitize: max length, strip HTML
        const sanitized = sanitizeContent(content);
        
        // Forward to background (always opens sidepanel)
        const response = await chrome.runtime.sendMessage({
          type: 'content-to-chat/send',
          payload: {
            content: sanitized,
            sourceDomain: window.location.hostname
          }
        });
        
        // Send response back to SDK
        window.postMessage({
          type: '__COGNITO_RESPONSE__',
          id,
          result: response
        }, '*');
        
      } catch (error) {
        window.postMessage({
          type: '__COGNITO_RESPONSE__',
          id,
          result: { success: false, error: (error as Error).message }
        }, '*');
      }
    });
  }
});
```

#### 3. Background Handler

```typescript
// src/background/contentToChat/handler.ts

export async function handleContentToChat(
  message: ContentToChatMessage,
  sender: chrome.runtime.MessageSender
): Promise<{ success: boolean; error?: string }> {
  const { content, sourceDomain } = message.payload;
  
  // Check if feature is enabled
  const settings = await getContentToChatSettings();
  if (!settings.enabled) {
    return { success: false, error: 'Feature disabled' };
  }
  
  // Check domain blocklist
  if (settings.blockedDomains.includes(sourceDomain)) {
    return { success: false, error: 'Domain blocked' };
  }
  
  // ALWAYS open sidepanel
  const tab = sender.tab;
  if (tab?.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
  
  // Forward to sidepanel
  await chrome.runtime.sendMessage({
    type: 'content-to-chat/receive',
    payload: { content, sourceDomain }
  });
  
  // Log for transparency
  await logContentToChatEvent(sourceDomain, content.length);
  
  return { success: true };
}
```

### Acceptance Criteria

- [ ] SDK can detect Cognito installation via `isInstalled()`
- [ ] SDK can send content via `sendToChat(content)`
- [ ] Sidepanel ALWAYS opens when content is sent
- [ ] Content appears in chat input with source badge
- [ ] Content is sanitized (no HTML, max 10KB)
- [ ] Source domain is displayed to user
- [ ] User can disable feature in settings

---

## Phase 2: Developer SDK

**Goal**: Publish npm package with TypeScript types and utilities for website developers.

### Deliverables

1. **npm Package: `@cognito/web-sdk`**
   - Simple API: `isInstalled()`, `sendToChat(content)`, `onReady(cb)`
   - Full TypeScript support
   - React hook: `useCognito()`

2. **CDN Script**
   - For websites without build step
   - `<script src="https://cdn.cognito.dev/sdk.js">`
   - Exposes global `Cognito` object

### Package Structure

```
packages/
└── web-sdk/
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   ├── index.ts          # Main exports: isInstalled, sendToChat, onReady
    │   ├── types.ts          # TypeScript interfaces
    │   └── react.ts          # React hook: useCognito
    ├── dist/
    │   ├── index.js          # ESM build
    │   ├── index.d.ts        # TypeScript declarations
    │   └── cdn.js            # UMD build for CDN (exposes Cognito global)
    └── README.md
```

### SDK Implementation

```typescript
// packages/web-sdk/src/index.ts

export interface SendToChatResult {
  success: boolean;
  error?: string;
}

/**
 * Check if Cognito extension is installed
 */
export function isInstalled(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__COGNITO_INSTALLED__;
}

/**
 * Send content to Cognito chat input
 * - Always opens sidepanel
 * - Always populates input (user sends manually)
 */
export async function sendToChat(content: string): Promise<SendToChatResult> {
  if (!isInstalled()) {
    return { success: false, error: 'Cognito extension not installed' };
  }
  
  return new Promise((resolve) => {
    const id = crypto.randomUUID();
    
    const handler = (e: MessageEvent) => {
      if (e.data?.type === '__COGNITO_RESPONSE__' && e.data?.id === id) {
        window.removeEventListener('message', handler);
        resolve(e.data.result);
      }
    };
    window.addEventListener('message', handler);
    
    window.postMessage({
      type: '__COGNITO_SEND_TO_CHAT__',
      id,
      content
    }, '*');
    
    // Timeout after 5 seconds
    setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve({ success: false, error: 'Request timed out' });
    }, 5000);
  });
}

/**
 * Listen for when extension becomes ready
 */
export function onReady(callback: () => void): () => void {
  if (isInstalled()) {
    callback();
    return () => {};
  }
  
  const handler = () => callback();
  window.addEventListener('cognito:ready', handler);
  return () => window.removeEventListener('cognito:ready', handler);
}
```

### React Hook

```typescript
// packages/web-sdk/src/react.ts

import { useState, useEffect, useCallback } from 'react';
import { isInstalled, sendToChat, onReady, SendToChatResult } from './index';

export function useCognito() {
  const [isReady, setIsReady] = useState(isInstalled());
  
  useEffect(() => {
    return onReady(() => setIsReady(true));
  }, []);
  
  const send = useCallback(async (content: string): Promise<SendToChatResult> => {
    return sendToChat(content);
  }, []);
  
  return {
    isReady,
    sendToChat: send
  };
}
```

### Acceptance Criteria

- [ ] Package published to npm as `@cognito/web-sdk`
- [ ] `isInstalled()`, `sendToChat()`, `onReady()` work correctly
- [ ] React hook available via `import { useCognito } from '@cognito/web-sdk/react'`
- [ ] CDN script works: `<script src="https://cdn.cognito.dev/sdk.js">`
- [ ] Full TypeScript support with no errors
- [ ] README with usage examples

---

## Phase 3: Documentation Site

**Goal**: Add developer documentation to the Cognito docs site.

### Deliverables

1. **Docs Pages in `apps/docs/`**
   - `/docs/developers/content-to-chat` - Main guide
   - `/docs/developers/sdk-reference` - API reference
   - `/docs/developers/examples` - Code examples

2. **Interactive Examples**
   - Live demo buttons on docs pages
   - Copy-paste code snippets

### Docs Structure

```
apps/docs/content/docs/
└── developers/
    ├── index.mdx                # Developer overview
    ├── meta.json
    ├── content-to-chat/
    │   ├── index.mdx            # Getting started
    │   ├── api-reference.mdx    # API docs
    │   ├── security.mdx         # Security model
    │   └── meta.json
    └── examples/
        ├── index.mdx            # Examples overview
        ├── e-commerce.mdx       # E-commerce example
        ├── documentation.mdx    # Docs site example
        └── meta.json
```

### Example Doc Page

```mdx
---
title: Content to Chat API
description: Send content from your website to Cognito
---

# Content to Chat API

Allow users to send content from your website directly to Cognito's AI chat.

## Quick Start

### 1. Check if Cognito is installed

```js
if (window.cognito?.isInstalled()) {
  // Show your "Ask AI" button
}
```

### 2. Send content to chat

```js
await window.cognito.sendToChat({
  content: "Explain this: " + selectedText,
  autoSend: false
});
```

## Try It

<CognitoDemo />

## Installation

### Option A: NPM (recommended for React/TypeScript)

```bash
npm install @cognito/web-sdk
```

### Option B: CDN (no build step)

```html
<script src="https://cdn.cognito.dev/sdk.js"></script>
```
```

### Acceptance Criteria

- [ ] Documentation pages created
- [ ] Interactive demos work
- [ ] Code examples are copy-pasteable
- [ ] Linked from main docs navigation

---

## Phase 4: WebMCP Integration

**Goal**: Allow websites with WebMCP to hint at available tools for complex workflows.

### Concept

Websites that implement WebMCP can include hints about available tools when sending content. Cognito can then suggest using those tools.

```typescript
interface SendToChatOptionsWithMCP extends SendToChatOptions {
  /**
   * Hint that WebMCP tools are available for this action
   * Does NOT execute tools - just suggests them to user
   */
  webmcpHint?: {
    suggestedTools: string[];  // Tool names available on this page
    workflowDescription: string;  // What user might want to do
  };
}

// Example usage
await window.cognito.sendToChat({
  content: "Create a task from this bug report: ...",
  webmcpHint: {
    suggestedTools: ['notion_create_page', 'github_create_issue'],
    workflowDescription: 'Create a task in your project management tool'
  }
});
```

### UI Display

```
┌─────────────────────────────────────────────────────────┐
│  💬 Chat Input                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Create a task from this bug report: ...           │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────┐                │
│  │ 📤 From: jira.example.com           │                │
│  │ 🔧 Tools available: notion, github  │                │
│  └─────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────┘
```

### Security

- WebMCP hints are **suggestions only** - AI decides what to use
- Tools must already be registered via WebMCP discovery
- User still approves tool execution as normal

### Acceptance Criteria

- [ ] WebMCP hints can be included in sendToChat
- [ ] UI shows available tools hint
- [ ] AI considers hints when responding
- [ ] Tools are NOT auto-executed

---

## Phase 5: Advanced Features

### 5.1 Domain-Specific Configurations

Allow users to configure per-domain settings:

```typescript
interface DomainConfig {
  domain: string;
  trusted: boolean;      // Show in "Trusted" section
  blocked: boolean;      // Block this domain
  customLabel?: string;  // e.g., "Work Tools"
}
```

### 5.2 Analytics Dashboard

Show users which sites use the API:

```
┌─────────────────────────────────────────────────────────┐
│  📊 Content to Chat Activity                            │
│                                                         │
│  Last 7 days:                                           │
│  • github.com         │████████████████│ 45 requests   │
│  • docs.example.com   │████████        │ 23 requests   │
│  • news.site          │████            │ 12 requests   │
│                                                         │
│  [Clear History] [Export]                               │
└─────────────────────────────────────────────────────────┘
```

### 5.3 Keyboard Shortcut Integration

Allow websites to register keyboard shortcuts with Cognito:

```typescript
import { registerShortcut } from '@cognito/web-sdk';

registerShortcut({
  key: 'Ctrl+Shift+E',
  description: 'Explain selected text',
  getContent: () => {
    const text = window.getSelection()?.toString() || '';
    return `Explain this: ${text}`;
  }
});
```

### 5.4 Browser Extension Interop

Allow other extensions to send content:

```typescript
// Other extension can use chrome.runtime.sendMessage
// to extension ID (requires externally_connectable)
chrome.runtime.sendMessage(
  'cognito-extension-id',
  { type: 'content-to-chat/send', payload: { content: '...' } }
);
```

---

## Timeline Estimate

| Phase | Scope | Estimated Effort |
|-------|-------|------------------|
| **Phase 1** | Core Infrastructure | 3-4 days |
| **Phase 2** | Developer SDK | 2-3 days |
| **Phase 3** | Documentation Site | 2 days |
| **Phase 4** | WebMCP Integration | 2-3 days |
| **Phase 5** | Advanced Features | 3-5 days |

**Total: ~12-17 days**

### Recommended Order

1. ✅ Phase 1 first (required foundation)
2. ✅ Phase 2 + 3 can be parallel
3. ✅ Phase 4 after WebMCP is stable
4. ✅ Phase 5 based on user feedback

---

## Open Questions

1. **Trusted domains**: Should we have a list of pre-trusted domains (like GitHub, MDN)?
   - **Recommendation**: No pre-trust, but allow users to mark domains as trusted

2. **Manifest externally_connectable**: Should we support direct extension-to-extension messaging?
   - **Recommendation**: Phase 5, requires listing specific extension IDs

3. **Rate limiting**: Should rate limiting be per-domain or global?
   - **Recommendation**: Per-domain (5 req/min per domain)

4. **File attachments**: Should websites be able to suggest file attachments?
   - **Recommendation**: Not in v1, revisit based on security review

---

## Appendix: Error Codes

| Code | Description | User Message |
|------|-------------|--------------|
| `RATE_LIMITED` | Too many requests from this domain | "Please wait before sending more content" |
| `CONTENT_TOO_LONG` | Content exceeds 10KB limit | "Content is too long (max 10,000 characters)" |
| `DISABLED` | User has disabled this feature | "Content sharing is disabled in Cognito settings" |
| `BLOCKED_DOMAIN` | Domain is on user's blocklist | "This website is blocked from sending content" |
| `VALIDATION_ERROR` | Invalid payload format | "Invalid request format" |
| `TIMEOUT` | Request timed out | "Request timed out. Is Cognito running?" |
| `NOT_INSTALLED` | Extension not installed | "Please install Cognito to use this feature" |
