# Gemini Writer & Rewriter Architecture

## Overview

The Gemini Writer and Rewriter are two AI-powered text generation features in the Chrome extension that leverage Google's Gemini API. Both share similar architectural patterns but serve different use cases:

- **Writer**: Generates new content from scratch via `/write` command
- **Rewriter**: Transforms existing selected text with presets or custom instructions

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CONTENT SCRIPT LAYER                               │
│  (Runs in webpage context - src/contents/)                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────┐    ┌─────────────────────────────┐            │
│  │     WRITER FEATURE          │    │     REWRITER FEATURE        │            │
│  │  write-command.tsx          │    │  text-rewriter.tsx          │            │
│  │                             │    │                             │            │
│  │  ┌───────────────────────┐  │    │  ┌───────────────────────┐  │            │
│  │  │ useWriteCommandDetection│ │    │  │ useTextSelection      │  │            │
│  │  │ - Detects /write cmd  │  │    │  │ - Context menu trigger│  │            │
│  │  │ - Shadow DOM support  │  │    │  │ - Selection capture   │  │            │
│  │  └───────────────────────┘  │    │  └───────────────────────┘  │            │
│  │                             │    │                             │            │
│  │  ┌───────────────────────┐  │    │  ┌───────────────────────┐  │            │
│  │  │ WriterOverlay.tsx     │  │    │  │ RewriterTooltip.tsx   │  │            │
│  │  │ - Floating UI panel   │  │    │  │ - Floating tooltip    │  │            │
│  │  │ - Prompt input        │  │    │  │ - Preset buttons      │  │            │
│  │  │ - Attachment support  │  │    │  │ - Custom instruction  │  │            │
│  │  │ - Tool toggles        │  │    │  │ - Tool toggles        │  │            │
│  │  │ - Drag & drop         │  │    │  └───────────────────────┘  │            │
│  │  └───────────────────────┘  │    │                             │            │
│  │                             │    │  ┌───────────────────────┐  │            │
│  │  ┌───────────────────────┐  │    │  │ useRewriter.ts        │  │            │
│  │  │ useTextInsertion      │  │    │  │ - Port communication  │  │            │
│  │  │ - Insert generated    │  │    │  │ - State management    │  │            │
│  │  │   text into field     │  │    │  │ - Selection replace   │  │            │
│  │  └───────────────────────┘  │    │  └───────────────────────┘  │            │
│  └─────────────────────────────┘    └─────────────────────────────┘            │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                    │                              │
                    │ chrome.runtime.connect()     │ chrome.runtime.connect()
                    │ Port: 'write-command'        │ Port: 'text-rewriter'
                    ▼                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           BACKGROUND SERVICE WORKER                             │
│  (src/background/)                                                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                    MESSAGE ROUTER (messaging/router.ts)                  │   │
│  │  - initializeWriterPortListener()                                        │   │
│  │  - initializeRewriterPortListener()                                      │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                    │                              │                             │
│                    ▼                              ▼                             │
│  ┌─────────────────────────────┐    ┌─────────────────────────────┐            │
│  │   WRITER MODULE             │    │   REWRITER MODULE           │            │
│  │   (writer/)                 │    │   (rewriter/)               │            │
│  │                             │    │                             │            │
│  │  ┌───────────────────────┐  │    │  ┌───────────────────────┐  │            │
│  │  │ handler.ts            │  │    │  │ handler.ts            │  │            │
│  │  │ - handleWriteGenerate │  │    │  │ - handleRewriteRequest│  │            │
│  │  │ - Error handling      │  │    │  │ - Error handling      │  │            │
│  │  │ - Port messaging      │  │    │  │ - Port messaging      │  │            │
│  │  └───────────────────────┘  │    │  └───────────────────────┘  │            │
│  │            │                │    │            │                │            │
│  │            ▼                │    │            ▼                │            │
│  │  ┌───────────────────────┐  │    │  ┌───────────────────────┐  │            │
│  │  │ geminiWriter.ts       │  │    │  │ geminiRewriter.ts     │  │            │
│  │  │ - GeminiWriter class  │  │    │  │ - GeminiRewriter class│  │            │
│  │  │ - generate()          │  │    │  │ - rewrite()           │  │            │
│  │  │ - generateStream()    │  │    │  │ - Non-streaming only  │  │            │
│  │  │ - Function calling    │  │    │  │ - Function calling    │  │            │
│  │  └───────────────────────┘  │    │  └───────────────────────┘  │            │
│  │            │                │    │            │                │            │
│  │            ▼                │    │            ▼                │            │
│  │  ┌───────────────────────┐  │    │                             │            │
│  │  │ contextBuilder.ts     │  │    │                             │            │
│  │  │ - Platform detection  │  │    │                             │            │
│  │  │ - Tone suggestions    │  │    │                             │            │
│  │  └───────────────────────┘  │    │                             │            │
│  │            │                │    │                             │            │
│  │            ▼                │    │                             │            │
│  │  ┌───────────────────────┐  │    │                             │            │
│  │  │ streamParser.ts       │  │    │                             │            │
│  │  │ - parseGeminiSSE()    │  │    │                             │            │
│  │  │ - SSE chunk parsing   │  │    │                             │            │
│  │  └───────────────────────┘  │    │                             │            │
│  └─────────────────────────────┘    └─────────────────────────────┘            │
│                    │                              │                             │
│                    └──────────────┬───────────────┘                             │
│                                   ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                    SUPERMEMORY MODULE (supermemory/)                     │   │
│  │  - searchMemories() - Semantic search in user's knowledge base           │   │
│  │  - getMemorySearchTool() - Function declaration for Gemini               │   │
│  │  - executeMemorySearch() - Execute AI-requested searches                 │   │
│  │  - formatMemoriesForPrompt() - Format results for context                │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ HTTPS API Calls
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL SERVICES                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────┐    ┌─────────────────────────────┐            │
│  │   GOOGLE AI (Gemini API)    │    │   VERTEX AI                 │            │
│  │   - Primary provider        │    │   - Fallback provider       │            │
│  │   - API key auth            │    │   - Service account auth    │            │
│  │   - generativelanguage.     │    │   - {location}-aiplatform.  │            │
│  │     googleapis.com          │    │     googleapis.com          │            │
│  └─────────────────────────────┘    └─────────────────────────────┘            │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         GEMINI TOOLS (Optional)                          │   │
│  │  - url_context: Fetch and analyze URLs                                   │   │
│  │  - google_search: Real-time web search grounding                         │   │
│  │  - function_declarations: Custom function calling (memory search)        │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```


---

## Component Details

### 1. Writer Feature

#### Trigger Mechanism
- User types `/write` followed by a prompt in any editable field
- `useWriteCommandDetection` hook monitors input events
- Supports Shadow DOM, iframes, and contenteditable elements
- Command is removed from input after detection

#### UI Component (WriterOverlay)
```
┌────────────────────────────────────────┐
│ ≡  Writer                          ✕  │  ← Draggable header
├────────────────────────────────────────┤
│ [Attachment Preview - if any]          │
├────────────────────────────────────────┤
│ [What would you like me to write?] 📎 ➤│  ← Input + attach + send
├────────────────────────────────────────┤
│ ☐ URL Context  ☐ Search  ☐ Memory     │  ← Tool toggles
├────────────────────────────────────────┤
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← Loading skeleton
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
├────────────────────────────────────────┤
│ Generated text appears here...         │  ← Output area
│                                        │
├────────────────────────────────────────┤
│ [Copy] [Regenerate] [Insert ▶]         │  ← Action buttons
└────────────────────────────────────────┘
```

#### Features
- **Multimodal Support**: Images and PDFs via attachment
- **Platform Detection**: Gmail, LinkedIn, Twitter, Slack, etc.
- **Tone Customization**: Professional, casual, formal, friendly
- **Tool Integration**: URL context, Google Search, Supermemory
- **Streaming**: Real-time text generation display

### 2. Rewriter Feature

#### Trigger Mechanism
- User selects text on any webpage
- Right-click → Context menu "Rewrite with Cognito AI"
- Background sends `SHOW_REWRITER` message to content script
- Tooltip appears near selection

#### UI Component (RewriterTooltip)
```
┌────────────────────────────────────────┐
│ ✎  Rewrite                         ✕  │  ← Header
├────────────────────────────────────────┤
│ [Shorter][Expand][Professional]        │  ← Preset buttons
│ [Friendly][Improve][Simplify]          │
├────────────────────────────────────────┤
│ [Custom instruction...]            ➤   │  ← Custom input
├────────────────────────────────────────┤
│ ☐ URL Context  ☐ Search  ☐ Memory     │  ← Tool toggles
├────────────────────────────────────────┤
│ Rewritten text appears here...         │  ← Output area
├────────────────────────────────────────┤
│ [Copy]                    [Apply ✓]    │  ← Action buttons
└────────────────────────────────────────┘
```

#### Presets
| Preset | Description |
|--------|-------------|
| `shorter` | Condense while preserving meaning |
| `longer` | Expand with more detail |
| `professional` | Formal business tone |
| `casual` | Friendly, relaxed tone |
| `improve` | Fix grammar, clarity, flow |
| `simplify` | Easier to understand |
| `enthusiastic` | Positive, energetic tone |
| `conversational` | Natural speaking style |

---

## Data Flow Diagrams

### Writer Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   User       │     │  Content     │     │  Background  │     │  Gemini API  │
│   Action     │     │  Script      │     │  Worker      │     │              │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │                    │
       │ Type "/write       │                    │                    │
       │ draft email"       │                    │                    │
       │───────────────────>│                    │                    │
       │                    │                    │                    │
       │                    │ Detect command     │                    │
       │                    │ Remove from input  │                    │
       │                    │ Show WriterOverlay │                    │
       │                    │                    │                    │
       │ Enter prompt       │                    │                    │
       │ + attachments      │                    │                    │
       │───────────────────>│                    │                    │
       │                    │                    │                    │
       │                    │ Connect port       │                    │
       │                    │ 'write-command'    │                    │
       │                    │───────────────────>│                    │
       │                    │                    │                    │
       │                    │ WRITE_GENERATE     │                    │
       │                    │ {prompt, context,  │                    │
       │                    │  settings, attach} │                    │
       │                    │───────────────────>│                    │
       │                    │                    │                    │
       │                    │                    │ Build system prompt│
       │                    │                    │ Get provider info  │
       │                    │                    │                    │
       │                    │                    │ POST /generateContent
       │                    │                    │───────────────────>│
       │                    │                    │                    │
       │                    │                    │    [If function call]
       │                    │                    │<───────────────────│
       │                    │                    │                    │
       │                    │                    │ Execute memory     │
       │                    │                    │ search             │
       │                    │                    │                    │
       │                    │                    │ POST with function │
       │                    │                    │ response           │
       │                    │                    │───────────────────>│
       │                    │                    │                    │
       │                    │                    │    Generated text  │
       │                    │                    │<───────────────────│
       │                    │                    │                    │
       │                    │ WRITE_STREAM_CHUNK │                    │
       │                    │ {text, done}       │                    │
       │                    │<───────────────────│                    │
       │                    │                    │                    │
       │ Display text       │                    │                    │
       │<───────────────────│                    │                    │
       │                    │                    │                    │
       │ Click "Insert"     │                    │                    │
       │───────────────────>│                    │                    │
       │                    │                    │                    │
       │                    │ Insert into field  │                    │
       │                    │ Close overlay      │                    │
       │                    │                    │                    │
       ▼                    ▼                    ▼                    ▼
```


### Rewriter Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   User       │     │  Content     │     │  Background  │     │  Gemini API  │
│   Action     │     │  Script      │     │  Worker      │     │              │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │                    │
       │ Select text        │                    │                    │
       │ Right-click        │                    │                    │
       │───────────────────>│                    │                    │
       │                    │                    │                    │
       │                    │                    │ Context menu click │
       │                    │                    │ SHOW_REWRITER msg  │
       │                    │<───────────────────│                    │
       │                    │                    │                    │
       │                    │ Capture selection  │                    │
       │                    │ Show RewriterTooltip                    │
       │                    │                    │                    │
       │ Click preset       │                    │                    │
       │ (e.g., "Shorter")  │                    │                    │
       │───────────────────>│                    │                    │
       │                    │                    │                    │
       │                    │ Connect port       │                    │
       │                    │ 'text-rewriter'    │                    │
       │                    │───────────────────>│                    │
       │                    │                    │                    │
       │                    │ REWRITE_REQUEST    │                    │
       │                    │ {text, preset,     │                    │
       │                    │  toolSettings}     │                    │
       │                    │───────────────────>│                    │
       │                    │                    │                    │
       │                    │                    │ Build rewrite prompt
       │                    │                    │                    │
       │                    │                    │ POST /generateContent
       │                    │                    │───────────────────>│
       │                    │                    │                    │
       │                    │                    │    Rewritten text  │
       │                    │                    │<───────────────────│
       │                    │                    │                    │
       │                    │ REWRITE_COMPLETE   │                    │
       │                    │ {text}             │                    │
       │                    │<───────────────────│                    │
       │                    │                    │                    │
       │ Display result     │                    │                    │
       │<───────────────────│                    │                    │
       │                    │                    │                    │
       │ Click "Apply"      │                    │                    │
       │───────────────────>│                    │                    │
       │                    │                    │                    │
       │                    │ Replace selection  │                    │
       │                    │ (execCommand or    │                    │
       │                    │  DOM manipulation) │                    │
       │                    │                    │                    │
       ▼                    ▼                    ▼                    ▼
```

---

## Core Classes

### GeminiWriter Class

```typescript
class GeminiWriter {
    private model = 'gemini-2.5-flash-lite';
    
    // Provider selection (Google AI preferred, Vertex AI fallback)
    private async getProviderInfo(streaming?: boolean): Promise<ProviderInfo>;
    
    // Build context-aware system prompt
    private buildSystemPrompt(options?: WriterOptions): string;
    
    // Build multimodal request parts (attachments + text)
    private buildRequestParts(prompt: string, options?: WriterOptions): GeminiRequestPart[];
    
    // Non-streaming generation with function calling loop
    async generate(prompt: string, options?: WriterOptions): Promise<string>;
    
    // Streaming generation (SSE)
    async *generateStream(prompt: string, options?: WriterOptions): AsyncGenerator<string>;
}
```

### GeminiRewriter Class

```typescript
class GeminiRewriter {
    private model = 'gemini-2.5-flash-lite';
    
    // Provider selection
    private async getProviderInfo(): Promise<ProviderInfo>;
    
    // Non-streaming rewrite with function calling loop
    async rewrite(text: string, options?: RewriterOptions): Promise<string>;
}
```

---

## Tool Integration

### Available Tools

| Tool | Description | API Parameter |
|------|-------------|---------------|
| URL Context | Fetch and analyze web pages | `{ url_context: {} }` |
| Google Search | Real-time web search grounding | `{ google_search: {} }` |
| Memory Search | Search user's Supermemory knowledge base | `{ function_declarations: [...] }` |

### Tool Limitation

**Important**: Gemini API cannot mix built-in tools (`url_context`, `google_search`) with function calling in the same request.

**Solution**:
- If built-in tools enabled → Pre-search memories and inject into prompt
- If no built-in tools → Use function calling loop for AI-driven memory search

```
┌─────────────────────────────────────────────────────────────────┐
│                    TOOL SELECTION LOGIC                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  enableSupermemorySearch = true?                                │
│           │                                                     │
│           ├── YES ──► hasBuiltInTools (URL/Search)?             │
│           │                    │                                │
│           │                    ├── YES ──► PRE-SEARCH MODE      │
│           │                    │           Search memories first │
│           │                    │           Add to prompt context │
│           │                    │           Use built-in tools   │
│           │                    │                                │
│           │                    └── NO ───► FUNCTION CALLING MODE│
│           │                                AI decides when to   │
│           │                                search memories      │
│           │                                Loop up to 3 calls   │
│           │                                                     │
│           └── NO ───► Standard generation (no memory)           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```


---

## Function Calling Loop (Memory Search)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     FUNCTION CALLING LOOP (Max 3 iterations)                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐                                                            │
│  │ User Prompt │                                                            │
│  └──────┬──────┘                                                            │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Initial Request to Gemini                                            │   │
│  │ - System prompt + user prompt                                        │   │
│  │ - Tools: [function_declarations: search_memories]                    │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                           │
│                                 ▼                                           │
│                    ┌────────────────────────┐                               │
│                    │ Response has           │                               │
│                    │ functionCall?          │                               │
│                    └───────────┬────────────┘                               │
│                                │                                            │
│              ┌─────────────────┴─────────────────┐                          │
│              │ YES                               │ NO                       │
│              ▼                                   ▼                          │
│  ┌───────────────────────────┐      ┌───────────────────────────┐          │
│  │ Extract function call     │      │ Extract text response     │          │
│  │ name: "search_memories"   │      │ Return to user            │          │
│  │ args: {query, limit}      │      └───────────────────────────┘          │
│  └─────────────┬─────────────┘                                              │
│                │                                                            │
│                ▼                                                            │
│  ┌───────────────────────────┐                                              │
│  │ executeMemorySearch()     │                                              │
│  │ - Call Supermemory API    │                                              │
│  │ - Format results          │                                              │
│  └─────────────┬─────────────┘                                              │
│                │                                                            │
│                ▼                                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ Add to conversation:                                                   │ │
│  │ 1. Model's function call (role: model)                                 │ │
│  │ 2. Function response with results (role: user, functionResponse)       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                │                                                            │
│                │ Loop back (increment counter)                              │
│                └────────────────────────────────────────────────────────────┘
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Memory Search Function Declaration

```typescript
const MEMORY_SEARCH_FUNCTION = {
    name: 'search_memories',
    description: `Search the user's personal knowledge base for relevant information...`,
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'The search query to find relevant memories.'
            },
            limit: {
                type: 'number',
                description: 'Maximum results (1-10). Default: 5.'
            }
        },
        required: ['query']
    }
};
```

---

## Platform Detection (Writer)

The Writer uses intelligent platform detection to customize prompts:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLATFORM DETECTION                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  URL Pattern              Platform        Suggested Tone        │
│  ─────────────────────────────────────────────────────────────  │
│  mail.google.com          Gmail           professional          │
│  outlook.live.com         Outlook         professional          │
│  linkedin.com             LinkedIn        professional          │
│  twitter.com / x.com      Twitter         casual                │
│  github.com               GitHub          professional          │
│  slack.com                Slack           casual                │
│  discord.com              Discord         casual                │
│  notion.so                Notion          professional          │
│  docs.google.com          Google Docs     professional          │
│  medium.com               Medium          professional          │
│  *                        Web (default)   professional          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Error Handling

### Error Codes

| Code | Description | User Message |
|------|-------------|--------------|
| `NO_API_KEY` | No API key configured | "Please configure your API key in settings" |
| `RATE_LIMITED` | 429 response | "Too many requests. Please wait..." |
| `NETWORK_ERROR` | Connection failed | "Network error. Check your connection" |
| `INVALID_RESPONSE` | Malformed API response | "Invalid response from AI service" |
| `PORT_DISCONNECTED` | Chrome port closed | "Connection lost. Please try again" |
| `WRITE_FAILED` / `REWRITE_FAILED` | Generic failure | Error message or "Unexpected error" |

### Error Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      ERROR HANDLING FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  try {                                                          │
│      const response = await fetch(geminiUrl, options);          │
│                                                                 │
│      if (!response.ok) {                                        │
│          // Parse status code → map to error code               │
│          // 401/403 → NO_API_KEY                                │
│          // 429 → RATE_LIMITED                                  │
│          // 5xx → Service unavailable                           │
│          throw new Error(`API error: ${status}`);               │
│      }                                                          │
│                                                                 │
│      // Process response...                                     │
│                                                                 │
│  } catch (error) {                                              │
│      const { message, code } = getErrorDetails(error);          │
│                                                                 │
│      if (isPortConnected) {                                     │
│          port.postMessage({                                     │
│              action: 'WRITE_ERROR' | 'REWRITE_ERROR',           │
│              error: message,  // User-friendly                  │
│              code: code       // For programmatic handling      │
│          });                                                    │
│      }                                                          │
│  }                                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```


---

## Message Types

### Writer Messages

```typescript
// Request (Content → Background)
interface WriteGenerateRequest {
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
        attachment?: WriteAttachmentPayload;
    };
}

// Response chunk (Background → Content)
interface WriteStreamChunk {
    action: 'WRITE_STREAM_CHUNK';
    text: string;
    done: boolean;
}

// Error (Background → Content)
interface WriteError {
    action: 'WRITE_ERROR';
    error: string;
    code?: string;
}
```

### Rewriter Messages

```typescript
// Request (Content → Background)
interface RewriteRequest {
    action: 'REWRITE_REQUEST';
    payload: {
        selectedText: string;
        instruction: string;
        preset?: RewritePreset;
        enableUrlContext?: boolean;
        enableGoogleSearch?: boolean;
        enableSupermemorySearch?: boolean;
    };
}

// Response (Background → Content)
interface RewriteResponse {
    action: 'REWRITE_COMPLETE';
    text: string;
}

// Error (Background → Content)
interface RewriteError {
    action: 'REWRITE_ERROR';
    error: string;
    code?: string;
}
```

---

## Port Communication

Both features use Chrome's `runtime.connect()` for reliable bidirectional messaging:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PORT LIFECYCLE                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Content Script                    Background Worker            │
│  ──────────────                    ─────────────────            │
│                                                                 │
│  const port = chrome.runtime       chrome.runtime.onConnect     │
│    .connect({                        .addListener((port) => {   │
│      name: 'write-command'           if (port.name === '...') { │
│    });                                 // Handle messages       │
│                                      }                          │
│  port.onMessage.addListener(...)   });                          │
│                                                                 │
│  port.postMessage({                port.postMessage({           │
│    action: 'WRITE_GENERATE',         action: 'WRITE_STREAM_CHUNK'
│    payload: {...}                    text: '...',               │
│  });                                 done: false                │
│                                    });                          │
│                                                                 │
│  port.onDisconnect.addListener     port.onDisconnect.addListener│
│    (() => {                          (() => {                   │
│      // Cleanup                        // Cleanup               │
│    });                               });                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
src/
├── background/
│   ├── writer/
│   │   ├── index.ts              # Exports
│   │   ├── geminiWriter.ts       # GeminiWriter class
│   │   ├── handler.ts            # handleWriteGenerate()
│   │   ├── contextBuilder.ts     # Platform detection, tone
│   │   └── streamParser.ts       # SSE parsing utilities
│   │
│   ├── rewriter/
│   │   ├── index.ts              # Exports
│   │   ├── geminiRewriter.ts     # GeminiRewriter class
│   │   └── handler.ts            # handleRewriteRequest()
│   │
│   ├── supermemory/
│   │   ├── index.ts              # Exports
│   │   ├── searchService.ts      # searchMemories()
│   │   ├── functionDeclaration.ts # MEMORY_SEARCH_FUNCTION
│   │   └── functionHandler.ts    # Function calling utilities
│   │
│   ├── contextMenu/
│   │   └── rewriterContextMenu.ts # Right-click menu setup
│   │
│   └── messaging/
│       └── router.ts             # Port listeners initialization
│
├── contents/
│   ├── write-command.tsx         # Writer content script entry
│   ├── write-command/
│   │   ├── index.ts
│   │   ├── WriterOverlay.tsx     # Main UI component
│   │   ├── WritingAnimation.tsx  # Loading skeleton
│   │   ├── WriterAttachmentPreview.tsx
│   │   ├── useWriteCommandDetection.ts
│   │   ├── useTextInsertion.ts
│   │   ├── useWriterAttachment.ts
│   │   ├── writerAttachmentUtils.ts
│   │   ├── platformDetector.ts
│   │   └── ErrorBoundary.tsx
│   │
│   ├── text-rewriter.tsx         # Rewriter content script entry
│   ├── text-rewriter/
│   │   ├── index.ts
│   │   ├── RewriterTooltip.tsx   # Main UI component
│   │   ├── RewriterPresets.tsx   # Preset buttons
│   │   ├── useRewriter.ts        # Port communication hook
│   │   └── useTextRewriterSelection.ts
│   │
│   └── shared/
│       └── ToolsToggle.tsx       # Shared tool settings UI
│
├── types/
│   ├── writeCommand.ts           # Writer type definitions
│   └── rewriteCommand.ts         # Rewriter type definitions
│
└── utils/settings/
    ├── writeCommandSettings.ts   # Writer settings storage
    └── rewriteSettings.ts        # Rewriter settings storage

# Note: Component styles use Tailwind CSS classes inline.
# See TAILWIND_MIGRATION_GUIDE.md for styling standards.
```

---

## Configuration & Settings

### Writer Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enabled` | boolean | true | Feature toggle |
| `defaultTone` | WriteTone | 'professional' | Default writing tone |
| `maxOutputTokens` | number | 1024 | Max generation length |
| `includePageContext` | boolean | true | Send page info to AI |
| `enableUrlContext` | boolean | false | URL analysis tool |
| `enableGoogleSearch` | boolean | false | Web search grounding |
| `enableSupermemorySearch` | boolean | false | Memory search |

### Rewriter Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enabled` | boolean | true | Feature toggle |
| `enableUrlContext` | boolean | false | URL analysis tool |
| `enableGoogleSearch` | boolean | false | Web search grounding |
| `enableSupermemorySearch` | boolean | false | Memory search |

---

## Security Considerations

1. **API Key Protection**: Keys stored in Chrome storage, never logged
2. **No PII Logging**: Error objects sanitized before logging
3. **Content Script Isolation**: Runs in isolated world, uses Shadow DOM
4. **Port Validation**: Check `chrome.runtime.id` before operations
5. **Input Sanitization**: User prompts passed directly to API (Gemini handles)

---

## Performance Optimizations

1. **Singleton Instances**: `geminiWriter` and `geminiRewriter` are singletons
2. **Port Reuse**: Single port per operation, cleaned up on completion
3. **Debounced Detection**: 200ms debounce on `/write` command detection
4. **Lazy Tool Loading**: Tools only added to request when enabled
5. **Pre-search vs Function Calling**: Avoids multiple API round-trips when possible


---

## Complete System Block Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                         BROWSER TAB                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                                    WEB PAGE (any URL)                                          │ │
│  │                                                                                                │ │
│  │   ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │ │
│  │   │                              WXT SHADOW DOM                                             │ │ │
│  │   │                                                                                          │ │ │
│  │   │   ┌─────────────────────────────┐      ┌─────────────────────────────┐                  │ │ │
│  │   │   │      WRITER OVERLAY         │      │     REWRITER TOOLTIP        │                  │ │ │
│  │   │   │                             │      │                             │                  │ │ │
│  │   │   │  ┌───────────────────────┐  │      │  ┌───────────────────────┐  │                  │ │ │
│  │   │   │  │ Prompt Input          │  │      │  │ Preset Buttons        │  │                  │ │ │
│  │   │   │  │ [________________] 📎➤│  │      │  │ [S][E][P][F][I][Si]   │  │                  │ │ │
│  │   │   │  └───────────────────────┘  │      │  └───────────────────────┘  │                  │ │ │
│  │   │   │                             │      │                             │                  │ │ │
│  │   │   │  ┌───────────────────────┐  │      │  ┌───────────────────────┐  │                  │ │ │
│  │   │   │  │ Tool Toggles          │  │      │  │ Custom Instruction    │  │                  │ │ │
│  │   │   │  │ ☐URL ☐Search ☐Memory  │  │      │  │ [________________] ➤  │  │                  │ │ │
│  │   │   │  └───────────────────────┘  │      │  └───────────────────────┘  │                  │ │ │
│  │   │   │                             │      │                             │                  │ │ │
│  │   │   │  ┌───────────────────────┐  │      │  ┌───────────────────────┐  │                  │ │ │
│  │   │   │  │ Generated Output      │  │      │  │ Rewritten Output      │  │                  │ │ │
│  │   │   │  │ Lorem ipsum dolor...  │  │      │  │ Improved text here... │  │                  │ │ │
│  │   │   │  └───────────────────────┘  │      │  └───────────────────────┘  │                  │ │ │
│  │   │   │                             │      │                             │                  │ │ │
│  │   │   │  [Copy][Regen][Insert ▶]   │      │  [Copy]        [Apply ✓]   │                  │ │ │
│  │   │   └─────────────────────────────┘      └─────────────────────────────┘                  │ │ │
│  │   │                                                                                          │ │ │
│  │   └──────────────────────────────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                                                │ │
│  │   ┌────────────────────────────────────────────────────────────────────────────────────────┐  │ │
│  │   │                              CONTENT SCRIPTS                                            │  │ │
│  │   │                                                                                         │  │ │
│  │   │   write-command.tsx                        text-rewriter.tsx                            │  │ │
│  │   │   ├── useWriteCommandDetection()           ├── useRewriter()                            │  │ │
│  │   │   │   └── Monitors input events            │   └── Port communication                   │  │ │
│  │   │   │   └── Detects /write pattern           │   └── State management                     │  │ │
│  │   │   │   └── Shadow DOM support               │                                            │  │ │
│  │   │   │                                        ├── Context menu listener                    │  │ │
│  │   │   ├── useTextInsertion()                   │   └── SHOW_REWRITER message               │  │ │
│  │   │   │   └── execCommand fallback             │                                            │  │ │
│  │   │   │   └── DOM manipulation                 ├── replaceSelection()                       │  │ │
│  │   │   │                                        │   └── execCommand / DOM                    │  │ │
│  │   │   └── useWriterAttachment()                │                                            │  │ │
│  │   │       └── File processing                  └── Selection capture                        │  │ │
│  │   │       └── Base64 encoding                                                               │  │ │
│  │   │                                                                                         │  │ │
│  │   └────────────────────────────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                                                │ │
│  └───────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                              │                                                     │
│                                              │ chrome.runtime.connect()                            │
│                                              │ Ports: 'write-command', 'text-rewriter'             │
│                                              ▼                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                               │
                                               │
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    BACKGROUND SERVICE WORKER                                        │
│                                                                                                     │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │                                    MESSAGE ROUTER                                            │  │
│   │                                  (messaging/router.ts)                                       │  │
│   │                                                                                              │  │
│   │   initializeWriterPortListener()              initializeRewriterPortListener()               │  │
│   │   └── Port: 'write-command'                   └── Port: 'text-rewriter'                      │  │
│   │   └── Action: WRITE_GENERATE                  └── Action: REWRITE_REQUEST                    │  │
│   │                                                                                              │  │
│   └─────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                          │                                        │                                │
│                          ▼                                        ▼                                │
│   ┌──────────────────────────────────────┐    ┌──────────────────────────────────────┐            │
│   │           WRITER MODULE              │    │          REWRITER MODULE             │            │
│   │                                      │    │                                      │            │
│   │   handler.ts                         │    │   handler.ts                         │            │
│   │   ├── handleWriteGenerate()          │    │   ├── handleRewriteRequest()         │            │
│   │   ├── getErrorDetails()              │    │   ├── getErrorDetails()              │            │
│   │   └── Port message handling          │    │   └── Port message handling          │            │
│   │              │                       │    │              │                       │            │
│   │              ▼                       │    │              ▼                       │            │
│   │   geminiWriter.ts                    │    │   geminiRewriter.ts                  │            │
│   │   ├── GeminiWriter class             │    │   ├── GeminiRewriter class           │            │
│   │   ├── generate() - non-streaming     │    │   ├── rewrite() - non-streaming      │            │
│   │   ├── generateStream() - SSE         │    │   ├── PRESET_PROMPTS mapping         │            │
│   │   ├── buildSystemPrompt()            │    │   └── Function calling loop          │            │
│   │   ├── buildRequestParts()            │    │                                      │            │
│   │   └── Function calling loop          │    │                                      │            │
│   │              │                       │    │                                      │            │
│   │              ▼                       │    │                                      │            │
│   │   contextBuilder.ts                  │    │                                      │            │
│   │   ├── detectPlatform()               │    │                                      │            │
│   │   ├── PLATFORM_PATTERNS              │    │                                      │            │
│   │   └── buildPageContext()             │    │                                      │            │
│   │              │                       │    │                                      │            │
│   │              ▼                       │    │                                      │            │
│   │   streamParser.ts                    │    │                                      │            │
│   │   ├── parseGeminiSSE()               │    │                                      │            │
│   │   ├── parseSSELine()                 │    │                                      │            │
│   │   └── collectGeminiSSE()             │    │                                      │            │
│   │                                      │    │                                      │            │
│   └──────────────────────────────────────┘    └──────────────────────────────────────┘            │
│                          │                                        │                                │
│                          └────────────────────┬───────────────────┘                                │
│                                               │                                                    │
│                                               ▼                                                    │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │                                   SUPERMEMORY MODULE                                         │  │
│   │                                                                                              │  │
│   │   searchService.ts                    functionDeclaration.ts      functionHandler.ts         │  │
│   │   ├── searchMemories()                ├── MEMORY_SEARCH_FUNCTION  ├── hasFunctionCall()      │  │
│   │   ├── formatMemoriesForPrompt()       ├── parseMemorySearchParams ├── extractFunctionCall()  │  │
│   │   └── isMemorySearchAvailable()       └── MemorySearchFunctionParams                         │  │
│   │                                                                   ├── executeMemorySearch()  │  │
│   │                                                                   └── getMemorySearchTool()  │  │
│   │                                                                                              │  │
│   └─────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                               │                                                    │
│                                               │                                                    │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │                                   PROVIDER SELECTION                                         │  │
│   │                                                                                              │  │
│   │   getProviderInfo()                                                                          │  │
│   │   ├── Check hasGoogleApiKey() ──► YES ──► Google AI (Gemini API)                             │  │
│   │   │                                       generativelanguage.googleapis.com                  │  │
│   │   │                                                                                          │  │
│   │   └── Check hasVertexCredentials() ──► YES ──► Vertex AI                                     │  │
│   │                                               {location}-aiplatform.googleapis.com           │  │
│   │                                                                                              │  │
│   └─────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                               │
                                               │ HTTPS
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      GOOGLE CLOUD SERVICES                                          │
│                                                                                                     │
│   ┌──────────────────────────────────────┐    ┌──────────────────────────────────────┐             │
│   │         GOOGLE AI (Gemini API)       │    │            VERTEX AI                 │             │
│   │                                      │    │                                      │             │
│   │   Endpoint:                          │    │   Endpoint:                          │             │
│   │   generativelanguage.googleapis.com  │    │   {location}-aiplatform.googleapis.com             │
│   │   /v1beta/models/{model}:            │    │   /v1/projects/{project}/locations/  │             │
│   │     generateContent                  │    │   {location}/publishers/google/      │             │
│   │     streamGenerateContent            │    │   models/{model}:generateContent     │             │
│   │                                      │    │                                      │             │
│   │   Auth: API Key (query param)        │    │   Auth: Bearer token (header)        │             │
│   │                                      │    │                                      │             │
│   │   Model: gemini-2.0-flash-lite       │    │   Model: gemini-2.0-flash-lite       │             │
│   │                                      │    │                                      │             │
│   └──────────────────────────────────────┘    └──────────────────────────────────────┘             │
│                                                                                                     │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │                                    GEMINI TOOLS                                              │  │
│   │                                                                                              │  │
│   │   Built-in Tools (cannot mix with function calling):                                         │  │
│   │   ├── url_context: {} ──► Fetch and analyze web page content                                 │  │
│   │   └── google_search: {} ──► Real-time web search for grounding                               │  │
│   │                                                                                              │  │
│   │   Function Calling (custom tools):                                                           │  │
│   │   └── function_declarations: [search_memories] ──► AI-driven memory search                   │  │
│   │                                                                                              │  │
│   └─────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

The Gemini Writer and Rewriter are sophisticated AI-powered text generation features that:

1. **Share Common Infrastructure**: Both use the same provider selection, error handling, and Supermemory integration patterns
2. **Differ in Trigger & Purpose**: Writer generates new content via `/write` command; Rewriter transforms selected text via context menu
3. **Support Multiple Tools**: URL context, Google Search, and AI-driven memory search
4. **Handle Edge Cases**: Shadow DOM, iframes, rich text editors, network failures
5. **Prioritize UX**: Streaming output, loading states, error recovery, clipboard fallbacks
