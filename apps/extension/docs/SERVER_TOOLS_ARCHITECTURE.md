# Server-Side Tools Architecture

This document explains how **server-executed tools** work in the Cognito AI extension when using **backend mode**. These tools run on the Vercel backend instead of the browser extension, providing benefits like API key security, caching, and rate limiting.

## Overview

In backend mode, certain tools are executed on the server rather than in the browser:

- **Search Tools** (`webSearch`, `retrieve`, `deepWebSearch`) - Controlled by the `searchEnabled` flag
- **YouTube Tool** (`getYouTubeTranscript`) - Controlled by the `youtubeEnabled` flag

| Mode | Feature Enabled | Tool Execution | API Keys |
|------|----------------|----------------|----------|
| Backend | ✅ searchEnabled | Server-side (Tavily/Jina) | Backend manages |
| Backend | ✅ youtubeEnabled | Server-side (Supadata) | Backend manages |
| Backend | ❌ Disabled | N/A | N/A |
| BYOK | ✅ Enabled | Frontend (local) | User provides |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COGNITO AI EXTENSION                               │
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │  Chat UI        │    │  useAIChat      │    │  aiLogic.ts     │         │
│  │  (Sidepanel)    │◄──►│  (Hook)         │◄──►│  (Router)       │         │
│  └─────────────────┘    └─────────────────┘    └────────┬────────┘         │
│                                                          │                   │
│                              Backend Mode?               │                   │
│                         ┌────────┴────────┐              │                   │
│                         ▼                 ▼              │                   │
│                    ┌────────┐        ┌────────┐         │                   │
│                    │  YES   │        │   NO   │         │                   │
│                    └───┬────┘        └───┬────┘         │                   │
│                        │                 │               │                   │
│  ┌─────────────────────▼─────┐    ┌─────▼───────────────────────┐          │
│  │ backendChatWithTools.ts   │    │ BYOK Mode (local execution) │          │
│  │                           │    │ - Uses user's API key       │          │
│  │ - Sends searchEnabled     │    │ - Executes tools locally    │          │
│  │ - Excludes server tools   │    │ - Direct API calls          │          │
│  │   from schemas            │    └─────────────────────────────┘          │
│  │ - Forwards tool results   │                                              │
│  └───────────┬───────────────┘                                              │
└──────────────┼──────────────────────────────────────────────────────────────┘
               │
               │ HTTP POST /api/ai/chat-with-tools
               │ { searchEnabled: true, tools: {...}, messages: [...] }
               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        VERCEL BACKEND (backend-vercel)                       │
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │ routes/ai/      │    │ getServerTools  │    │ External APIs   │         │
│  │ chat.ts         │───►│ (serverTools.ts)│───►│                 │         │
│  │                 │    │                 │    │ - Tavily        │         │
│  │ Merges frontend │    │ Returns:        │    │ - Jina Reader   │         │
│  │ + server tools  │    │ - webSearch     │    │                 │         │
│  └─────────────────┘    │ - retrieve      │    └─────────────────┘         │
│                         │ - deepWebSearch │                                 │
│                         └─────────────────┘                                 │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                        AI SDK streamText                         │       │
│  │  - Model calls tool → execute function runs on backend           │       │
│  │  - Streams tool-input-available, tool-output-available           │       │
│  │  - Continues to generate response using tool results             │       │
│  └─────────────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Sequence Diagram

```
┌──────────┐          ┌───────────────────┐          ┌──────────────┐          ┌──────────┐
│  User    │          │   Extension       │          │   Backend    │          │  Tavily  │
│          │          │   (Frontend)      │          │   (Vercel)   │          │   API    │
└────┬─────┘          └─────────┬─────────┘          └──────┬───────┘          └────┬─────┘
     │                          │                           │                       │
     │ "Search for AI news"     │                           │                       │
     │────────────────────────►│                           │                       │
     │                          │                           │                       │
     │                          │ Check: Backend mode?      │                       │
     │                          │ Check: Search enabled?    │                       │
     │                          │                           │                       │
     │                          │ getToolSchemas(true)      │                       │
     │                          │ → Excludes webSearch      │                       │
     │                          │                           │                       │
     │                          │ POST /api/ai/chat-with-tools                      │
     │                          │ { searchEnabled: true,    │                       │
     │                          │   tools: {...},           │                       │
     │                          │   messages: [...] }       │                       │
     │                          │─────────────────────────►│                       │
     │                          │                           │                       │
     │                          │                           │ getServerTools()      │
     │                          │                           │ → webSearch, retrieve │
     │                          │                           │ → deepWebSearch       │
     │                          │                           │                       │
     │                          │                           │ streamText({          │
     │                          │                           │   tools: allTools     │
     │                          │                           │ })                    │
     │                          │                           │                       │
     │                          │                           │ AI decides to call    │
     │                          │                           │ webSearch             │
     │                          │                           │                       │
     │                          │◄─ SSE: tool-input-available                       │
     │                          │   { toolName: webSearch,  │                       │
     │                          │     input: {query: "..."} │                       │
     │                          │   }                       │                       │
     │                          │                           │                       │
     │ [Shows search spinner]   │                           │ execute webSearch     │
     │◄─────────────────────────│                           │───────────────────────►
     │                          │                           │                       │
     │                          │                           │◄──────────────────────│
     │                          │                           │  { results: [...] }   │
     │                          │                           │                       │
     │                          │◄─ SSE: tool-output-available                      │
     │                          │   { output: {results} }   │                       │
     │                          │                           │                       │
     │ [Shows search results]   │                           │                       │
     │◄─────────────────────────│                           │                       │
     │                          │                           │                       │
     │                          │◄─ SSE: text-delta         │                       │
     │                          │   "Based on search..."    │                       │
     │                          │                           │                       │
     │ [Shows AI response]      │                           │                       │
     │◄─────────────────────────│                           │                       │
     │                          │                           │                       │
```

---

## Data Flow

### 1. Frontend → Backend Request

```typescript
// apps/extension/src/ai/backend/backendChatWithTools.ts

// Step 1: Get tool schemas, EXCLUDING server-executed tools
const toolSchemas = await getToolSchemas(searchEnabled); // true = exclude server tools

// Step 2: Send request with searchEnabled flag
fetch('/api/ai/chat-with-tools', {
    body: JSON.stringify({
        messages: [...],
        tools: toolSchemas,      // Does NOT include webSearch, retrieve, deepWebSearch
        searchEnabled: true,     // Tells backend to add server tools
        // ...
    })
})
```

### 2. Backend Adds Server Tools

```typescript
// packages/backend-vercel/src/routes/ai/chat.ts

// Extract searchEnabled from request body
const { searchEnabled } = req.body;

// Get frontend tools (no execute function)
const frontendTools = createFrontendTools(toolSchemas);

// Get server tools (WITH execute function)
const serverTools = getServerTools({ searchEnabled: !!searchEnabled });
// Returns: { webSearch, retrieve, deepWebSearch }

// Merge: server tools override frontend tools with same name
const allTools = { ...frontendTools, ...serverTools };

// Pass to AI SDK
streamText({
    tools: allTools,  // Server tools have execute functions
});
```

### 3. Backend Executes Tool

When the AI model calls a server tool, AI SDK automatically runs its `execute` function:

```typescript
// packages/backend-vercel/src/services/serverTools.ts

export function createWebSearchTool() {
    return tool({
        description: `Search the web...`,
        inputSchema: z.object({
            query: z.string(),
            // ...
        }),
        execute: async ({ query, max_results, search_depth }) => {
            // This runs on the backend!
            const response = await axios.post(TAVILY_API_URL, {
                api_key: config.tavilyApiKey,  // Server-side API key
                query,
                // ...
            });
            return { results: [...], images: [...] };
        },
    });
}
```

### 4. Frontend Receives Tool Result

```typescript
// apps/extension/src/ai/backend/backendChatWithTools.ts

case 'tool_result':
    // Server-executed tool result from backend
    writer.write({
        type: 'tool-output-available',
        toolCallId: resultData.toolCallId,
        output: resultData.output,
    });
    // UI updates: spinner stops, results shown
    break;
```

---

## Available Server Tools

### Search Tools (searchEnabled)

| Tool | Description | External API | Environment Variable |
|------|-------------|--------------|---------------------|
| `webSearch` | Single query web search | Tavily | `TAVILY_API_KEY` |
| `retrieve` | Extract content from URL | Jina Reader | `JINA_API_KEY` |
| `deepWebSearch` | Parallel multi-query search | Tavily | `TAVILY_API_KEY` |

### YouTube Tool (youtubeEnabled)

| Tool | Description | External API | Environment Variable |
|------|-------------|--------------|---------------------|
| `getYouTubeTranscript` | Fetch video transcript and metadata | Supadata | `SUPADATA_API_KEY` |

**Benefits of server-side YouTube transcript:**
- Redis caching (24h TTL) - faster responses for frequently requested videos
- No client-side API tokens needed
- Centralized rate limiting
- Consistent response format across users

---

## Adding a New Server Tool

### Step 1: Define the Tool in Backend

Edit `packages/backend-vercel/src/services/serverTools.ts`:

```typescript
// =============================================================================
// Your New Tool
// =============================================================================

interface MyToolParams {
    param1: string;
    param2?: number;
}

interface MyToolResult {
    data: string;
    error?: string;
}

async function executeMyTool(params: MyToolParams): Promise<MyToolResult> {
    const { param1, param2 = 10 } = params;
    
    console.log('[ServerTools] Executing myTool:', { param1, param2 });
    
    // Check for required API key
    if (!config.myApiKey) {
        return { data: '', error: 'API key not configured' };
    }
    
    try {
        // Call external API
        const response = await axios.post('https://api.example.com', {
            api_key: config.myApiKey,
            param1,
            param2,
        });
        
        return { data: response.data };
    } catch (error) {
        console.error('[ServerTools] MyTool error:', error);
        return { data: '', error: 'Failed to execute' };
    }
}

export function createMyTool() {
    return tool({
        description: `Description of what this tool does.

USE: When to use this tool.

REQUIRES:
- param1: Description (required)
- param2: Description (optional, default 10)

RETURNS: Object with data field.`,
        
        inputSchema: z.object({
            param1: z.string().describe('Parameter 1'),
            param2: z.number().optional().default(10),
        }),
        
        execute: executeMyTool,
    });
}
```

### Step 2: Register in getServerTools

```typescript
// packages/backend-vercel/src/services/serverTools.ts

export interface ServerToolsOptions {
    searchEnabled?: boolean;
    myToolEnabled?: boolean;  // Add new flag if needed
}

export function getServerTools(options: ServerToolsOptions = {}) {
    const tools: Record<string, any> = {};

    if (options.searchEnabled) {
        tools.webSearch = createWebSearchTool();
        tools.retrieve = createRetrieveTool();
        tools.deepWebSearch = createDeepWebSearchTool();
    }
    
    // Add your tool
    if (options.myToolEnabled || options.searchEnabled) {
        tools.myTool = createMyTool();
    }

    return tools;
}
```

### Step 3: Add to Frontend Exclusion List

Edit `apps/extension/src/ai/backend/frontendToolExecutor.ts`:

```typescript
/**
 * Tools that are executed on the backend when search is enabled.
 * These should NOT be included in schemas sent to backend.
 */
export const SERVER_EXECUTED_TOOLS = [
    'webSearch', 
    'retrieve', 
    'deepWebSearch',
    'getYouTubeTranscript',
    'myTool',  // Add your tool name
];
```

### Step 4: (Optional) Add Enable Flag

If your tool needs a separate enable flag, update:

1. **Frontend** - Pass the flag in `aiLogic.ts`:
   ```typescript
   return streamBackendChatWithTools({
       // ...
       searchEnabled,
       myToolEnabled: someCondition,  // Add new flag
   });
   ```

2. **Backend** - Accept it in `chat.ts`:
   ```typescript
   const { searchEnabled, myToolEnabled } = req.body;
   const serverTools = getServerTools({ searchEnabled, myToolEnabled });
   ```

### Step 5: Add Environment Variable

Edit `packages/backend-vercel/src/config/config.ts`:

```typescript
export const config = {
    // ...
    myApiKey: process.env.MY_API_KEY,
};
```

And add to `.env`:
```
MY_API_KEY=your_key_here
```

---

## Files to Edit Summary

| File | Location | Purpose |
|------|----------|---------|
| `serverTools.ts` | `packages/backend-vercel/src/services/` | Define tool with execute function |
| `frontendToolExecutor.ts` | `apps/extension/src/ai/backend/` | Add to `SERVER_EXECUTED_TOOLS` |
| `config.ts` | `packages/backend-vercel/src/config/` | Add API key config |
| `chat.ts` | `packages/backend-vercel/src/routes/ai/` | (Optional) Accept new enable flags |
| `aiLogic.ts` | `apps/extension/src/ai/core/` | (Optional) Pass new enable flags |
| `backendChatWithTools.ts` | `apps/extension/src/ai/backend/` | (Optional) Add new param to interface |

---

## Benefits of Server-Side Tools

1. **API Key Security** - Keys stay on the server, never exposed to clients
2. **Caching** - Redis caching benefits all users (1-hour TTL for search results)
3. **Rate Limiting** - Centralized control over API usage
4. **No CORS Issues** - Backend makes direct API calls
5. **Lower Client Bundle** - External SDK code stays on server
6. **Consistent Behavior** - Same execution environment for all users

---

## Debugging Tips

### Backend Logs

```
[ServerTools] Added search tools (searchEnabled=true): ['webSearch', 'retrieve', 'deepWebSearch']
[ServerTools] Executing webSearch: { query: '...', max_results: 10 }
[ServerTools] WebSearch cache hit: ...  // or "WebSearch success"
```

### Frontend Logs

```
🔍 Backend search mode: { searchEnabled: true }
Tool schemas prepared: { count: 5, excludedServerTools: true }
🔄 Server tool result received: { toolCallId: '...', hasOutput: true }
```

### Verify Tool Registration

Check backend logs for:
```
[AI Chat+Tools] Tools configured: {
    frontendToolCount: 5,
    serverToolCount: 3,
    totalToolCount: 8,
    searchEnabled: true
}
```
