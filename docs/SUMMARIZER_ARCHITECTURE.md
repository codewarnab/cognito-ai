# Text Summarizer Architecture Documentation

## Overview

This document provides a comprehensive analysis of the **Text Summarizer** feature in the Cognito AI Chrome Extension. This feature enables users to select text on any webpage and get AI-powered summaries using Gemini AI.

| Feature | Purpose | Response Type | Trigger |
|---------|---------|---------------|---------|
| **Summarizer** | Condense selected text into key points/TL;DR | Streaming | Text selection → Button click |

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CHROME EXTENSION                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     CONTENT SCRIPTS (Per Tab)                        │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │                    Text Summarizer                           │    │   │
│  │  │  ┌───────────────┐                                          │    │   │
│  │  │  │useTextSelection│                                          │    │   │
│  │  │  │   Selection   │                                          │    │   │
│  │  │  └───────┬───────┘                                          │    │   │
│  │  │          │                                                   │    │   │
│  │  │  ┌───────▼───────┐                                          │    │   │
│  │  │  │SummarizeButton│                                          │    │   │
│  │  │  └───────┬───────┘                                          │    │   │
│  │  │          │                                                   │    │   │
│  │  │  ┌───────▼───────┐                                          │    │   │
│  │  │  │ SummaryPopup  │                                          │    │   │
│  │  │  └───────┬───────┘                                          │    │   │
│  │  │          │                                                   │    │   │
│  │  │  ┌───────▼───────┐                                          │    │   │
│  │  │  │ useSummarizer │                                          │    │   │
│  │  │  └───────┬───────┘                                          │    │   │
│  │  └──────────┼──────────────────────────────────────────────────┘    │   │
│  └─────────────┼────────────────────────────────────────────────────────┘   │
│                │                                                            │
│                │ chrome.runtime.connect()                                   │
│                │ Port: "text-summarizer"                                    │
│                │                                                            │
│  ┌─────────────▼────────────────────────────────────────────────────────┐   │
│  │                    BACKGROUND SERVICE WORKER                          │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │                    Message Router (router.ts)                    │ │   │
│  │  │  ┌─────────────────────────┐                                    │ │   │
│  │  │  │initializeSummarizerPort │                                    │ │   │
│  │  │  │      Listener           │                                    │ │   │
│  │  │  └───────────┬─────────────┘                                    │ │   │
│  │  └──────────────┼──────────────────────────────────────────────────┘ │   │
│  │                 │                                                     │   │
│  │  ┌──────────────▼──────────────┐                                     │   │
│  │  │   Summarizer Module         │                                     │   │
│  │  │  ┌────────────────────────┐ │                                     │   │
│  │  │  │ handleSummarizeRequest │ │                                     │   │
│  │  │  └───────────┬────────────┘ │                                     │   │
│  │  │              │              │                                     │   │
│  │  │  ┌───────────▼────────────┐ │                                     │   │
│  │  │  │   GeminiSummarizer     │ │                                     │   │
│  │  │  │  (Streaming SSE)       │ │                                     │   │
│  │  │  └───────────┬────────────┘ │                                     │   │
│  │  └──────────────┼──────────────┘                                     │   │
│  │                 │                                                     │   │
│  │  ┌──────────────▼────────────────────────────────────────────────┐   │   │
│  │  │                    Shared Auth (vertexAuth.ts)                 │   │   │
│  │  │         Google AI (API Key) │ Vertex AI (Service Account)      │   │   │
│  │  └─────────────────────────────┬──────────────────────────────────┘   │   │
│  └────────────────────────────────┼──────────────────────────────────────┘   │
│                                   │                                         │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │      EXTERNAL SERVICES        │
                    │  ┌─────────────────────────┐  │
                    │  │   Google AI (Gemini)    │  │
                    │  │   generativelanguage.   │  │
                    │  │   googleapis.com        │  │
                    │  └─────────────────────────┘  │
                    │  ┌─────────────────────────┐  │
                    │  │   Vertex AI             │  │
                    │  │   {location}-aiplatform │  │
                    │  │   .googleapis.com       │  │
                    │  └─────────────────────────┘  │
                    └───────────────────────────────┘
```

---

## Text Summarizer - Detailed Flow


### Summarizer Sequence Diagram

```
┌──────────┐     ┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌────────────┐
│   User   │     │  Content Script │     │   Background │     │GeminiSummarizer │     │ Gemini API │
└────┬─────┘     └────────┬────────┘     └──────┬───────┘     └────────┬────────┘     └─────┬──────┘
     │                    │                     │                      │                    │
     │ 1. Select text     │                     │                      │                    │
     │ ──────────────────>│                     │                      │                    │
     │                    │                     │                      │                    │
     │                    │ 2. useTextSelection │                      │                    │
     │                    │    detects selection│                      │                    │
     │                    │    (min 100 chars)  │                      │                    │
     │                    │                     │                      │                    │
     │ 3. See floating    │                     │                      │                    │
     │    button          │                     │                      │                    │
     │ <──────────────────│                     │                      │                    │
     │                    │                     │                      │                    │
     │ 4. Click button    │                     │                      │                    │
     │ ──────────────────>│                     │                      │                    │
     │                    │                     │                      │                    │
     │                    │ 5. useSummarizer    │                      │                    │
     │                    │    connects port    │                      │                    │
     │                    │ ───────────────────>│                      │                    │
     │                    │  "text-summarizer"  │                      │                    │
     │                    │                     │                      │                    │
     │                    │ 6. SUMMARIZE_REQUEST│                      │                    │
     │                    │ ───────────────────>│                      │                    │
     │                    │                     │                      │                    │
     │                    │                     │ 7. handleSummarize   │                    │
     │                    │                     │    Request()         │                    │
     │                    │                     │ ───────────────────> │                    │
     │                    │                     │                      │                    │
     │                    │                     │                      │ 8. getProviderInfo │
     │                    │                     │                      │    (API key check) │
     │                    │                     │                      │                    │
     │                    │                     │                      │ 9. POST /stream    │
     │                    │                     │                      │    GenerateContent │
     │                    │                     │                      │ ──────────────────>│
     │                    │                     │                      │                    │
     │                    │                     │                      │ 10. SSE chunks     │
     │                    │                     │                      │ <──────────────────│
     │                    │                     │                      │                    │
     │                    │                     │ 11. yield chunk      │                    │
     │                    │                     │ <─────────────────── │                    │
     │                    │                     │                      │                    │
     │                    │ 12. SUMMARIZE_      │                      │                    │
     │                    │     STREAM_CHUNK    │                      │                    │
     │                    │ <───────────────────│                      │                    │
     │                    │                     │                      │                    │
     │ 13. See streaming  │                     │                      │                    │
     │     summary        │                     │                      │                    │
     │ <──────────────────│                     │                      │                    │
     │                    │                     │                      │                    │
     │                    │ 14. done: true      │                      │                    │
     │                    │ <───────────────────│                      │                    │
     │                    │                     │                      │                    │
     │ 15. Copy summary   │                     │                      │                    │
     │ ──────────────────>│                     │                      │                    │
     │                    │                     │                      │                    │
└────┴─────┘     └────────┴────────┘     └──────┴───────┘     └────────┴────────┘     └─────┴──────┘
```

### Summarizer Component Structure

```
src/contents/text-summarizer.tsx (Entry Point)
│
├── useTextSelection.ts
│   ├── Monitors document mouseup events
│   ├── Validates minimum text length (100 chars default)
│   ├── Calculates button position (end of selection)
│   └── Debounces selection (150ms)
│
├── SummarizeButton.tsx
│   └── Floating button positioned near selection
│
├── SummaryPopup.tsx
│   ├── Displays streaming summary with cursor animation
│   ├── Loading shimmer state
│   ├── Error display with icon
│   ├── Copy to clipboard action
│   └── Click-outside and Escape key handling
│
└── useSummarizer.ts
    ├── Manages port connection to background
    ├── Handles SUMMARIZE_STREAM_CHUNK messages
    ├── Handles SUMMARIZE_ERROR messages
    ├── Truncates text > 10,000 chars
    └── Tracks isLoading, isStreaming, error states
```

### Summarizer Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enabled` | boolean | `true` | Feature toggle |
| `minTextLength` | number | `100` | Minimum chars to show button |
| `summaryType` | enum | `'tl-dr'` | `key-points`, `tl-dr`, `headline`, `teaser` |
| `summaryLength` | enum | `'medium'` | `short` (100), `medium` (250), `long` (500) tokens |

---

## AI Provider Architecture


### Provider Selection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROVIDER SELECTION LOGIC                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  getProviderInfo()                                              │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────────┐                                        │
│  │ hasGoogleApiKey()?  │                                        │
│  └──────────┬──────────┘                                        │
│             │                                                   │
│     ┌───────┴───────┐                                           │
│     │ YES           │ NO                                        │
│     ▼               ▼                                           │
│  ┌─────────────┐  ┌─────────────────────┐                       │
│  │ GOOGLE AI   │  │ hasVertexCredentials?│                       │
│  │ (Preferred) │  └──────────┬──────────┘                       │
│  │             │             │                                  │
│  │ URL:        │     ┌───────┴───────┐                          │
│  │ generative  │     │ YES           │ NO                       │
│  │ language.   │     ▼               ▼                          │
│  │ googleapis  │  ┌─────────────┐  ┌─────────────┐              │
│  │ .com        │  │ VERTEX AI   │  │ ERROR:      │              │
│  │             │  │ (Fallback)  │  │ No provider │              │
│  │ Auth:       │  │             │  │ configured  │              │
│  │ API Key     │  │ URL:        │  └─────────────┘              │
│  │ in URL      │  │ {location}- │                               │
│  └─────────────┘  │ aiplatform. │                               │
│                   │ googleapis  │                               │
│                   │ .com        │                               │
│                   │             │                               │
│                   │ Auth:       │                               │
│                   │ OAuth2 JWT  │                               │
│                   │ Bearer token│                               │
│                   └─────────────┘                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### GeminiSummarizer Class

```typescript
class GeminiSummarizer {
    private model = 'gemini-2.5-flash-lite';
    
    // Google AI base URL (preferred provider)
    private googleBaseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    
    // Vertex AI base URL template
    private vertexBaseUrlTemplate = 'https://{location}-aiplatform.googleapis.com/v1';
    
    // Provider selection (Google AI preferred, Vertex AI fallback)
    private async getProviderInfo(): Promise<ProviderInfo>;
    
    // Build context-aware system prompt based on summary type
    private buildSystemPrompt(options: SummarizerOptions): string;
    
    // Streaming summarization using SSE
    async *summarizeStream(text: string, options: SummarizerOptions): AsyncGenerator<string>;
    
    // Non-streaming summarization (convenience wrapper)
    async summarize(text: string, options: SummarizerOptions): Promise<string>;
}
```

### Summary Type Instructions

| Type | Instruction |
|------|-------------|
| `key-points` | Extract the key points from the text as a bulleted list. Focus on the main ideas and important details. |
| `tl-dr` | Provide a concise TL;DR summary of the text. Capture the essence in 2-3 sentences. |
| `headline` | Create a single headline that captures the main idea of the text. |
| `teaser` | Write a brief teaser that would make someone want to read the full text. |

### Summary Length Configuration

| Length | Max Tokens |
|--------|------------|
| `short` | 100 |
| `medium` | 250 |
| `long` | 500 |

---

## Vertex AI Authentication

When using Vertex AI as the provider, the extension uses JWT assertion flow (RFC 7523) for authentication:

```
┌─────────────────────────────────────────────────────────────────┐
│                    VERTEX AI AUTH FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Build JWT Header                                            │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ { alg: 'RS256', typ: 'JWT', kid: privateKeyId }     │     │
│     └─────────────────────────────────────────────────────┘     │
│                          │                                      │
│                          ▼                                      │
│  2. Build JWT Payload (Claims)                                  │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ { iss: clientEmail, sub: clientEmail,               │     │
│     │   aud: 'https://oauth2.googleapis.com/token',       │     │
│     │   iat: now, exp: now + 3600,                        │     │
│     │   scope: 'https://www.googleapis.com/auth/cloud-    │     │
│     │          platform' }                                │     │
│     └─────────────────────────────────────────────────────┘     │
│                          │                                      │
│                          ▼                                      │
│  3. Sign with Private Key (Web Crypto API)                      │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ RSASSA-PKCS1-v1_5 with SHA-256                      │     │
│     └─────────────────────────────────────────────────────┘     │
│                          │                                      │
│                          ▼                                      │
│  4. Exchange JWT for Access Token                               │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ POST https://oauth2.googleapis.com/token            │     │
│     │ grant_type: urn:ietf:params:oauth:grant-type:       │     │
│     │             jwt-bearer                              │     │
│     │ assertion: {signed_jwt}                             │     │
│     └─────────────────────────────────────────────────────┘     │
│                          │                                      │
│                          ▼                                      │
│  5. Use Access Token in API Requests                            │
│     ┌─────────────────────────────────────────────────────┐     │
│     │ Authorization: Bearer {access_token}                │     │
│     └─────────────────────────────────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Message Types

### Request Messages

| Message | Direction | Payload |
|---------|-----------|---------|
| `SUMMARIZE_REQUEST` | Content → Background | `{ text, pageContext, settings }` |

### Response Messages

| Message | Direction | Payload |
|---------|-----------|---------|
| `SUMMARIZE_STREAM_CHUNK` | Background → Content | `{ text, done }` |
| `SUMMARIZE_ERROR` | Background → Content | `{ error, code }` |

### Error Codes

| Code | Description |
|------|-------------|
| `NO_API_KEY` | No API key configured or invalid credentials |
| `RATE_LIMITED` | Too many requests (429 status) |
| `NETWORK_ERROR` | Network connectivity issues |
| `INVALID_RESPONSE` | Malformed API response |
| `PORT_DISCONNECTED` | Chrome port disconnected during streaming |
| `SUMMARIZE_FAILED` | Generic summarization failure |

---

## File Structure

```
src/
├── contents/
│   └── text-summarizer.tsx          # Content script entry point
│       ├── components/
│       │   ├── SummarizeButton.tsx  # Floating trigger button
│       │   └── SummaryPopup.tsx     # Summary display popup
│       └── hooks/
│           ├── useTextSelection.ts  # Text selection detection
│           └── useSummarizer.ts     # Summarization state & port
│
├── background/
│   ├── messaging/
│   │   └── router.ts                # Port listener initialization
│   └── summarizer/
│       ├── index.ts                 # Module exports
│       ├── handler.ts               # Request handler with streaming
│       ├── geminiSummarizer.ts      # GeminiSummarizer class
│       └── vertexAuth.ts            # Vertex AI JWT authentication
│
└── utils/
    └── credentials/
        └── index.ts                 # API key & credential management
```

---

## Configuration

### Generation Config

```typescript
{
    temperature: 0.3,      // Low temperature for consistent summaries
    maxOutputTokens: 250,  // Based on summaryLength setting
    topP: 0.9,             // Nucleus sampling
}
```

### API Endpoints

| Provider | Endpoint |
|----------|----------|
| Google AI | `https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={apiKey}` |
| Vertex AI | `https://{location}-aiplatform.googleapis.com/v1/projects/{projectId}/locations/{location}/publishers/google/models/{model}:streamGenerateContent?alt=sse` |

---

## SSE Stream Processing

The summarizer uses Server-Sent Events (SSE) for streaming responses:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SSE STREAM PROCESSING                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  API Response Stream                                            │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ data: {"candidates":[{"content":{"parts":[{"text":"The │    │
│  │ data: {"candidates":[{"content":{"parts":[{"text":" key│    │
│  │ data: {"candidates":[{"content":{"parts":[{"text":" poi│    │
│  │ data: [DONE]                                            │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 1. Read chunks with TextDecoder                         │    │
│  │ 2. Buffer incomplete lines                              │    │
│  │ 3. Split on newlines                                    │    │
│  │ 4. Parse lines starting with "data: "                   │    │
│  │ 5. Extract text from JSON:                              │    │
│  │    parsed.candidates[0].content.parts[0].text           │    │
│  │ 6. Yield text chunks via AsyncGenerator                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                         │
│       ▼                                                         │
│  Port.postMessage({ action: 'SUMMARIZE_STREAM_CHUNK', ... })    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```
