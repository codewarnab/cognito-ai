# Google Gen AI SDK Migration - Multi-Phase Implementation Plan

**Date Created**: November 12, 2025  
**Status**: Planning Phase  
**Priority**: CRITICAL - `@google/generative-ai` support ends April 30, 2025

---

## 📋 Executive Summary

### **The Problem**
- **Current State**: Codebase uses 3 different Google AI SDKs inconsistently
  - `@google/generative-ai` (YouTube, Browser agents) - **DEPRECATING April 30, 2025** ⚠️
  - `@ai-sdk/google` (PDF agent, Suggestions) - ✅ **NOT deprecated** but bypasses provider selection
- `@ai-sdk/google-vertex` - **installed** - needed for Vertex AI support in AI SDK
  - `@google/genai` (Live API) - ✅ Modern SDK but hardcoded to Google AI only
- **Impact**: Agents don't respect user's provider selection (Vertex AI vs Google AI)
- **Risk**: Legacy SDK deprecation will break YouTube and Browser agents

### **The Solution - Two-Track Approach**

**Track 1: Agents using deprecated SDK (`@google/generative-ai`)**
- Migrate YouTube & Browser agents → **`@google/genai`**
- Reason: Major API changes required anyway, use Google's recommended SDK

**Track 2: Agents already using AI SDK (`@ai-sdk/google`)**
- **KEEP** `@ai-sdk/google` for Google AI (NOT deprecated!)
- **ADD** `@ai-sdk/google-vertex` for Vertex AI support
- Update PDF agent & Suggestions to use **existing `modelFactory.ts`** pattern
- Reason: AI SDK is stable, already supports both providers, minimal changes needed

**Benefits:**
- ✅ Leverage existing `modelFactory.ts` infrastructure (already working!)
- ✅ AI SDK provides unified API for both providers via package switching
- ✅ Minimal code changes for PDF/Suggestions (just use modelFactory)
- ✅ All agents respect centralized provider selection via `getActiveProvider()`
- ✅ Future-proof: Both `@google/genai` and AI SDK are supported long-term

### **Migration Strategy**
1. **Add `@ai-sdk/google-vertex`** package for Vertex AI support in AI SDK
2. Create provider-aware initialization helper (`genAIFactory.ts`)
3. **Track 1**: Migrate YouTube & Browser agents → `@google/genai` (deprecated SDK)
4. **Track 2**: Update PDF & Suggestions → use `modelFactory.ts` (AI SDK - already exists!)
5. Update Live API → use `genAIFactory.ts`
6. Update YouTube-to-Notion implementation plan
7. Test all features with both providers
8. Remove only `@google/generative-ai` (keep AI SDK packages)

---

## 🎯 Migration Scope

### **Files Requiring Changes**

#### **Phase 1: Core Infrastructure (1-2 hours)**
1. **Install `@ai-sdk/google-vertex`** - 5 mins
   - Run: `pnpm add @ai-sdk/google-vertex`
   - Enables Vertex AI support for AI SDK agents
   
2. `src/ai/core/genAIFactory.ts` - NEW FILE
   - Provider-aware `GoogleGenAI` client initialization
   - For agents using `@google/genai` (YouTube, Browser, Live API)
   
3. `src/ai/core/modelFactory.ts` - VERIFY (Already exists!)
   - ✅ Already has provider-aware initialization for AI SDK
   - ✅ Supports both `@ai-sdk/google` and `@ai-sdk/google-vertex`
   - No changes needed - just ensure PDF & Suggestions use it

#### **Phase 2: Live API Migration (2-3 hours)**
3. `src/ai/geminiLive/client/sessionManager.ts` - MIGRATE
   - Replace hardcoded `new GoogleGenAI({ apiKey })`
   - Use provider-aware initialization from genAIFactory
   - Test audio transcription with both providers

4. `src/ai/geminiLive/client/toolHandler.ts` - VERIFY
   - Ensure tools work with both providers
   - Test function calling

#### **Phase 3: YouTube Agent Migration (4-5 hours)**
5. `src/ai/agents/youtube/youtubeAgent.ts` - MIGRATE
   - FROM: `@google/generative-ai` → `GoogleGenerativeAI`
   - TO: `@google/genai` → `GoogleGenAI` (client.models.generateContent)
   - Update `analyzeVideoChunk()` API calls
   - Update `analyzeYouTubeVideo()` orchestration
   - Test with long videos (chunking), short videos, transcripts

6. `src/ai/agents/youtube/youtubeAgentTool.ts` - MIGRATE
   - Same migration as youtubeAgent.ts
   - Ensure tool schema remains compatible

#### **Phase 4: Browser Agent Migration (3-4 hours)**
7. `src/ai/agents/browser/browserActionAgent.ts` - MIGRATE
   - FROM: `@google/generative-ai` with `SchemaType`
   - TO: `@google/genai` with function declarations
   - Update function calling from native SDK to Gen AI SDK
   - Test all browser actions (click, scroll, navigate, etc)

#### **Phase 5: PDF Agent - Use Existing modelFactory (30 mins - 1 hour)** ✨ SIMPLIFIED
8. `src/ai/agents/pdf/pdfAgent.ts` - UPDATE (NOT full migration!)
   - ✅ **KEEP** `@ai-sdk/google` and `@ai-sdk/google-vertex` (AI SDK)
   - ✅ **KEEP** `generateText()` from AI SDK (no API changes!)
   - ❌ **REMOVE**: `createGoogleGenerativeAI({ apiKey })` direct initialization
   - ✅ **ADD**: Import and use `initializeModel()` from `modelFactory.ts`
   - Result: Automatically supports both providers with minimal changes

9. `src/ai/agents/pdf/pdfAgentTool.ts` - UPDATE
   - Same as pdfAgent.ts - just use modelFactory

#### **Phase 6: Suggestion Generator - Use Existing modelFactory (30 mins)** ✨ SIMPLIFIED
10. `src/ai/suggestions/generator.ts` - UPDATE (NOT full migration!)
    - ✅ **KEEP** `@ai-sdk/google` and `@ai-sdk/google-vertex`
    - ❌ **REMOVE**: `createGoogleGenerativeAI({ apiKey })` direct initialization
    - ✅ **ADD**: Import and use `initializeModel()` from `modelFactory.ts`
    - Test suggestion generation with both providers

#### **Phase 7: YouTube-to-Notion Plan Update (1-2 hours)**
11. `plans/youtubetonotion-.md` - UPDATE
    - Replace all `@google/generative-ai` examples with `@google/genai`
    - Add provider-aware initialization examples
    - Update nested agent code samples
    - Document Vertex AI support in architecture

---

## 📦 SDK Comparison & Migration Patterns

### **Current SDKs → Target Approach**

| Current SDK | Usage | Migration Path | Complexity | Notes |
|------------|-------|----------------|------------|-------|
| `@google/generative-ai` | YouTube, Browser | → `@google/genai` | **HIGH** - Full API migration | ⚠️ Deprecated April 30, 2025 |
| `@ai-sdk/google` | PDF, Suggestions | **Keep** + use modelFactory | **LOW** - Just initialization | ✅ Not deprecated |
| `@ai-sdk/google-vertex` | None (not installed) | **Add** for Vertex support | **ZERO** - Auto via modelFactory | ✅ Stable |
| `@google/genai` | Live API | Keep + update init | **LOW** - Just initialization | ✅ Google's new SDK |

### **Why Keep AI SDK for PDF/Suggestions?**

✅ **Reasons to Keep:**
1. **Not Deprecated** - `@ai-sdk/google` is actively maintained by Vercel
2. **Already Works** - `modelFactory.ts` already supports provider switching
3. **Minimal Changes** - Just replace direct init with `initializeModel()`
4. **Unified API** - AI SDK has same API for both Google AI and Vertex AI
5. **Better Abstractions** - AI SDK's `generateText()` is cleaner than native SDKs

❌ **Why NOT Migrate Everything to `@google/genai`:**
1. Unnecessary work - AI SDK already solves the provider selection problem
2. `@google/genai` has different API - requires rewriting working code
3. AI SDK is framework-agnostic and well-tested

### **Key API Differences**

#### **1. Initialization (ALL AGENTS)**

**BEFORE** (Multiple patterns):
```typescript
// Pattern 1: @google/generative-ai
import { GoogleGenerativeAI } from '@google/generative-ai';
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// Pattern 2: @ai-sdk/google
import { createGoogleGenerativeAI } from '@ai-sdk/google';
const google = createGoogleGenerativeAI({ apiKey });
const model = google('gemini-2.0-flash');

// Pattern 3: @google/genai (current Live API)
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey }); // Hardcoded Google AI
```

**AFTER** (Unified pattern):
```typescript
// NEW: genAIFactory.ts
import { GoogleGenAI } from '@google/genai';
import { getActiveProvider, getVertexCredentials, getGoogleApiKey } from '@/utils/providerCredentials';

export async function initializeGenAIClient(): Promise<GoogleGenAI> {
    const activeProvider = await getActiveProvider();
    
    if (activeProvider === 'vertex') {
        const { projectId, location } = await getVertexCredentials();
        return new GoogleGenAI({
            vertexai: true,
            project: projectId,
            location: location,
        });
    } else {
        const apiKey = await getGoogleApiKey();
        return new GoogleGenAI({ apiKey });
    }
}

// Usage in any agent:
const client = await initializeGenAIClient();
```

#### **2. Content Generation**

**BEFORE** (`@google/generative-ai`):
```typescript
// Old YouTube/Browser agents
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
const result = await model.generateContent(parts);
const text = result.response.text();
```

**AFTER** (`@google/genai`):
```typescript
// New pattern
const client = await initializeGenAIClient();
const response = await client.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: parts
});
const text = response.text;
```

#### **3. Streaming**

**BEFORE** (`@google/generative-ai`):
```typescript
const result = await model.generateContentStream(parts);
for await (const chunk of result.stream) {
    const text = chunk.text();
}
```

**AFTER** (`@google/genai`):
```typescript
const client = await initializeGenAIClient();
for await (const chunk of client.models.generateContentStream({
    model: 'gemini-2.0-flash',
    contents: parts
})) {
    const text = chunk.text;
}
```

#### **4. Function Calling**

**BEFORE** (`@google/generative-ai`):
```typescript
import { SchemaType, type FunctionDeclaration } from '@google/generative-ai';

const tools: FunctionDeclaration[] = [{
    name: 'controlLight',
    description: 'Controls a light',
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            brightness: { type: SchemaType.NUMBER }
        }
    }
}];

const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash',
    tools: [{ functionDeclarations: tools }]
});
```

**AFTER** (`@google/genai`):
```typescript
import { GoogleGenAI } from '@google/genai';
import type { FunctionDeclaration } from '@google/genai/types';

const tools: FunctionDeclaration[] = [{
    name: 'controlLight',
    description: 'Controls a light',
    parametersJsonSchema: {
        type: 'object',
        properties: {
            brightness: { type: 'number' }
        }
    }
}];

const client = await initializeGenAIClient();
const response = await client.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: 'Dim the lights',
    config: {
        tools: [{ functionDeclarations: tools }]
    }
});
```

#### **5. Chat Sessions**

**BEFORE** (`@google/generative-ai`):
```typescript
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
const chat = model.startChat({ history: [] });
const result = await chat.sendMessage('Hello');
```

**AFTER** (`@google/genai`):
```typescript
const client = await initializeGenAIClient();
const chat = client.chats.create({ model: 'gemini-2.0-flash' });
const response = await chat.sendMessage({ message: 'Hello' });
```

#### **6. Live API**

**BEFORE** (Current - hardcoded Google AI):
```typescript
import { GoogleGenAI } from '@google/genai';
const client = new GoogleGenAI({ apiKey });
const session = await client.live.connect({ model: 'gemini-live-2.5-flash-preview' });
```

**AFTER** (Provider-aware):
```typescript
import { initializeGenAIClient } from '@/ai/core/genAIFactory';

const client = await initializeGenAIClient();

// Model name depends on provider
const activeProvider = await getActiveProvider();
const model = activeProvider === 'vertex' 
    ? 'gemini-2.0-flash-live-preview-04-09'  // Vertex AI model
    : 'gemini-live-2.5-flash-preview';        // Google AI model

const session = await client.live.connect({ 
    model,
    config: { responseModalities: ['audio'] }
});
```

---

## 🚀 Phase-by-Phase Implementation

### **PHASE 1: Core Infrastructure** ⏱️ 1-2 hours

#### **Goal**: Create centralized provider-aware Gen AI client initialization

#### **Tasks**:

**1.1 Install @ai-sdk/google-vertex** (5 mins)
```bash
pnpm add @ai-sdk/google-vertex
```

**1.2 Verify modelFactory.ts** (10 mins)
- Check that `src/ai/core/modelFactory.ts` exists
- Verify it imports from `@ai-sdk/google` and `@ai-sdk/google-vertex`
- Verify `initializeModel()` function switches based on `getActiveProvider()`
- No changes needed - it should already work!

**1.3 Create genAIFactory.ts** (30 mins)
```typescript
// src/ai/core/genAIFactory.ts
import { GoogleGenAI } from '@google/genai';
import { getActiveProvider, getVertexCredentials, getGoogleApiKey } from '../../utils/providerCredentials';
import { createLogger } from '../../logger';

const log = createLogger('GenAIFactory');

/**
 * Initialize GoogleGenAI client respecting user's provider selection
 * - If Vertex AI configured: uses service account credentials
 * - Otherwise: uses Google AI with API key
 */
export async function initializeGenAIClient(): Promise<GoogleGenAI> {
    const activeProvider = await getActiveProvider();
    
    log.info('Initializing Gen AI client', { provider: activeProvider });
    
    if (activeProvider === 'vertex') {
        const credentials = await getVertexCredentials();
        
        log.info('Using Vertex AI', { 
            project: credentials.projectId, 
            location: credentials.location 
        });
        
        return new GoogleGenAI({
            vertexai: true,
            project: credentials.projectId,
            location: credentials.location,
            // Authentication handled by google-auth-library
            // Uses service account JSON or Application Default Credentials
        });
    } else {
        const apiKey = await getGoogleApiKey();
        
        log.info('Using Google AI with API key');
        
        return new GoogleGenAI({ 
            apiKey,
            // Optional: use v1 stable API instead of beta
            // apiVersion: 'v1'
        });
    }
}

/**
 * Get appropriate model name for Live API based on provider
 */
export async function getLiveModelName(): Promise<string> {
    const activeProvider = await getActiveProvider();
    
    // Vertex AI and Google AI use different Live API model names
    return activeProvider === 'vertex'
        ? 'gemini-2.0-flash-live-preview-04-09'  // Vertex AI Live model
        : 'gemini-live-2.5-flash-preview';        // Google AI Live model
}
```

**1.4 Update providerCredentials.ts** (15 mins) - OPTIONAL
```typescript
// Add helper to get credentials for current provider
export async function getActiveProviderCredentials(): Promise<{
    provider: 'google' | 'vertex';
    credentials: { apiKey?: string; projectId?: string; location?: string; };
}> {
    const activeProvider = await getActiveProvider();
    
    if (activeProvider === 'vertex') {
        const { projectId, location, clientEmail, privateKey } = await getVertexCredentials();
        return {
            provider: 'vertex',
            credentials: { projectId, location }
        };
    } else {
        const apiKey = await getGoogleApiKey();
        return {
            provider: 'google',
            credentials: { apiKey }
        };
    }
}
```

**1.5 Testing** (30 mins)
- Test `initializeGenAIClient()` with Google AI API key
- Test `initializeGenAIClient()` with Vertex AI credentials
- Test `initializeModel()` from modelFactory with both providers
- Verify error handling for missing credentials
- Test `getLiveModelName()` returns correct model for each provider

---

### **PHASE 2: Live API Migration** ⏱️ 2-3 hours

#### **Goal**: Update Live API session manager to respect provider selection

#### **Tasks**:

**2.1 Update sessionManager.ts** (1.5 hours)

**File**: `src/ai/geminiLive/client/sessionManager.ts`

**Changes**:
1. Import `initializeGenAIClient` and `getLiveModelName` from genAIFactory
2. Remove hardcoded `new GoogleGenAI({ apiKey })` from constructor
3. Initialize client in `connect()` method using provider-aware factory
4. Use correct Live model name based on provider

```typescript
// BEFORE:
constructor(
    apiKey: string,
    private config: SessionConfig,
    private callbacks: SessionCallbacks = {}
) {
    this.client = new GoogleGenAI({ apiKey }); // ❌ Hardcoded Google AI
    this.toolHandler = new GeminiLiveToolHandler();
}

// AFTER:
import { initializeGenAIClient, getLiveModelName } from '../../core/genAIFactory';

constructor(
    private config: SessionConfig,
    private callbacks: SessionCallbacks = {}
) {
    // Don't initialize client here - do it in connect()
    this.toolHandler = new GeminiLiveToolHandler();
}

async connect(): Promise<void> {
    if (this.session) {
        log.warn('Session already connected');
        return;
    }

    log.info('Starting Live API session...');
    
    // Initialize provider-aware client
    this.client = await initializeGenAIClient();
    
    // Get correct model name for provider
    const liveModel = await getLiveModelName();
    const sessionConfig = await this.prepareSessionConfig();
    
    // Use provider-specific model name
    this.session = await this.client.live.connect({
        model: liveModel,  // Dynamic model name
        config: sessionConfig,
        callbacks: { /* ... */ }
    });
    
    log.info('Live API session connected', { model: liveModel });
}
```

**2.2 Update Callers of SessionManager** (30 mins)
- Find all places that instantiate `GeminiLiveSessionManager`
- Remove `apiKey` parameter from constructor calls
- Verify no breaking changes

**2.3 Testing** (1 hour)
- Test Live API connection with Google AI
- Test Live API connection with Vertex AI
- Test audio transcription with both providers
- Test tool calling (function declarations) with both providers
- Verify error handling for invalid credentials

---

### **PHASE 3: YouTube Agent Migration** ⏱️ 4-5 hours

#### **Goal**: Migrate YouTube agent from deprecated `@google/generative-ai` to `@google/genai`

#### **Tasks**:

**3.1 Update youtubeAgent.ts** (2.5 hours)

**File**: `src/ai/agents/youtube/youtubeAgent.ts`

**Current Issues**:
- Lines 342, 511, 722: `new GoogleGenerativeAI(apiKey)` - bypasses provider
- Uses deprecated SDK API: `model.generateContent()`

**Migration Steps**:

```typescript
// BEFORE (Line 8):
import { GoogleGenerativeAI } from '@google/generative-ai';

// AFTER:
import { GoogleGenAI } from '@google/genai';
import { initializeGenAIClient } from '../../core/genAIFactory';

// BEFORE (Line 342 - analyzeVideoChunk):
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ 
    model: GEMINI_MODEL,
    generationConfig: { temperature: 0.7 }
});

const result = await model.generateContent(parts);
const analysis = result.response.text();

// AFTER:
const client = await initializeGenAIClient();

const response = await client.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: parts,
    config: {
        temperature: 0.7,
        // Add other config as needed
    }
});

const analysis = response.text;
```

**Files to update**:
- `analyzeVideoChunk()` function - 3 places use GoogleGenerativeAI
- `analyzeYouTubeVideo()` function - orchestration logic
- `fetchTranscript()` function - no AI SDK usage, keep as-is

**3.2 Update youtubeAgentTool.ts** (1.5 hours)

**File**: `src/ai/agents/youtube/youtubeAgentTool.ts`

Same migration pattern as youtubeAgent.ts:
- Update imports
- Replace `GoogleGenerativeAI` with `initializeGenAIClient()`
- Update API calls to use `client.models.generateContent()`

**3.3 Testing** (1 hour)
- Test with short video (<5 mins) - single chunk
- Test with long video (>30 mins) - multiple chunks
- Test with video without transcript
- Test with both providers (Google AI + Vertex AI)
- Verify analysis quality matches previous implementation
- Test error handling

---

### **PHASE 4: Browser Agent Migration** ⏱️ 3-4 hours

#### **Goal**: Migrate browser action agent with function calling support

#### **Tasks**:

**4.1 Update browserActionAgent.ts** (2 hours)

**File**: `src/ai/agents/browser/browserActionAgent.ts`

**Current Issues**:
- Line 102: `new GoogleGenerativeAI(apiKey)` - bypasses provider
- Uses `SchemaType` from old SDK for function declarations

**Key Challenge**: Function calling API changed significantly

```typescript
// BEFORE:
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { FunctionDeclaration } from '@google/generative-ai';

const tools: FunctionDeclaration[] = [{
    name: 'click',
    description: 'Click an element',
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            selector: { type: SchemaType.STRING }
        },
        required: ['selector']
    }
}];

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash',
    tools: [{ functionDeclarations: tools }]
});

// AFTER:
import { initializeGenAIClient } from '../../core/genAIFactory';
import type { FunctionDeclaration } from '@google/genai/types';

const tools: FunctionDeclaration[] = [{
    name: 'click',
    description: 'Click an element',
    parametersJsonSchema: {  // Changed from 'parameters'
        type: 'object',       // Lowercase
        properties: {
            selector: { type: 'string' }  // Lowercase
        },
        required: ['selector']
    }
}];

const client = await initializeGenAIClient();
const response = await client.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: {
        tools: [{ functionDeclarations: tools }]
    }
});

// Access function calls
const functionCall = response.candidates[0].content.parts[0].function_call;
```

**4.2 Update Browser Actions** (1 hour)
- Update all browser action functions (click, scroll, navigate, type, etc)
- Ensure tool definitions match new SDK format
- Test function calling response parsing

**4.3 Testing** (1 hour)
- Test each browser action (click, scroll, type, navigate, wait)
- Test with both providers
- Verify function calls are executed correctly
- Test error handling and retry logic

---

### **PHASE 5: PDF Agent - Use modelFactory** ⏱️ 30 mins - 1 hour ✨ SIMPLIFIED

#### **Goal**: Update PDF agent to use existing modelFactory for provider selection

#### **Why This is Better**:
- ✅ `@ai-sdk/google` is NOT deprecated - no need to migrate
- ✅ `modelFactory.ts` already handles provider selection
- ✅ Keep existing `generateText()` API - no rewriting needed
- ✅ Just replace direct SDK init with `initializeModel()`

#### **Tasks**:

**5.1 Update pdfAgent.ts** (20 mins)

**File**: `src/ai/agents/pdf/pdfAgent.ts`

**Current Issue**: Line 98 bypasses provider selection

```typescript
// BEFORE:
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

const apiKey = await getGoogleApiKey(); // ❌ Hardcoded Google AI
const google = createGoogleGenerativeAI({ apiKey });
const model = google('gemini-2.0-flash');

const result = await generateText({
    model,
    messages: [{ role: 'user', content: prompt }]
});

// AFTER:
import { generateText } from 'ai';
import { initializeModel } from '../../core/modelFactory';

// ✅ Respects provider selection automatically
const { model } = await initializeModel('gemini-2.0-flash', 'remote');

const result = await generateText({
    model,  // This is now provider-aware!
    messages: [{ role: 'user', content: prompt }]
});
```

**Changes**:
- ❌ Remove: `import { createGoogleGenerativeAI } from '@ai-sdk/google'`
- ❌ Remove: `const google = createGoogleGenerativeAI({ apiKey })`
- ✅ Add: `import { initializeModel } from '../../core/modelFactory'`
- ✅ Replace: Model initialization with `initializeModel()`

**5.2 Update pdfAgentTool.ts** (10 mins)
- Same simple update as pdfAgent.ts
- Just replace initialization with `initializeModel()`

**5.3 Testing** (15 mins)
- Test PDF upload and analysis (Google AI)
- Test PDF upload and analysis (Vertex AI)
- Verify output quality matches previous implementation
- Test provider switching

---

### **PHASE 6: Suggestion Generator - Use modelFactory** ⏱️ 30 mins ✨ SIMPLIFIED

#### **Goal**: Update suggestion generator to use modelFactory for provider selection

**File**: `src/ai/suggestions/generator.ts`

**Changes**:
```typescript
// BEFORE:
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

const apiKey = await getGoogleApiKey(); // ❌ Hardcoded Google AI
const google = createGoogleGenerativeAI({ apiKey });
const model = google('gemini-2.0-flash');

// AFTER:
import { generateText } from 'ai';
import { initializeModel } from '../ai/core/modelFactory';

// ✅ Respects provider selection automatically
const { model } = await initializeModel('gemini-2.0-flash', 'remote');
```

**Testing** (15 mins):
- Test suggestion generation in chat UI (Google AI)
- Test suggestion generation in chat UI (Vertex AI)
- Verify suggestions are contextual
- Test provider switching

---

### **PHASE 7: YouTube-to-Notion Plan Update** ⏱️ 1-2 hours

#### **Goal**: Update implementation plan to use Gen AI SDK with provider support

**File**: `plans/youtubetonotion-.md`

**Updates Required**:

1. **Architecture Diagram** (15 mins)
   - Add note: "All agents use @google/genai with provider-aware initialization"
   - Document that provider selection is centralized

2. **Code Examples** (30 mins)
   - Replace all `@google/generative-ai` imports with `@google/genai`
   - Update initialization code in all agent examples
   - Add provider selection examples

3. **youtubeToNotionAgent Example** (15 mins)
```typescript
// BEFORE (in plan):
import { GoogleGenerativeAI } from '@google/generative-ai';
const genAI = new GoogleGenerativeAI(apiKey);

// AFTER (in plan):
import { initializeGenAIClient } from '@/ai/core/genAIFactory';
const client = await initializeGenAIClient();
```

4. **notionCreatorAgent Example** (15 mins)
   - Same updates as youtubeToNotionAgent

5. **Add Provider Documentation** (30 mins)
   - Document how nested agents inherit provider selection
   - Explain Vertex AI vs Google AI differences for Live API
   - Add troubleshooting section for provider issues

---

## 🧪 Testing Strategy

### **Test Matrix: All Agents × Both Providers**

| Agent | Google AI | Vertex AI | Features to Test |
|-------|-----------|-----------|------------------|
| **Live API** | ✅ | ✅ | Audio transcription, tool calling, session management |
| **YouTube** | ✅ | ✅ | Short videos, long videos (chunking), transcripts |
| **Browser** | ✅ | ✅ | Click, scroll, navigate, type, wait, function calling |
| **PDF** | ✅ | ✅ | Upload, analysis, multimodal (PDF + text) |
| **Suggestions** | ✅ | ✅ | Context-aware suggestions in chat |

### **Provider Switching Tests**
1. Start with Google AI provider
2. Generate content with all agents
3. Switch to Vertex AI in settings
4. Verify all agents now use Vertex AI
5. Switch back to Google AI
6. Verify agents switch back

### **Error Handling Tests**
- Missing API key for Google AI
- Missing Vertex credentials
- Invalid credentials for either provider
- Network errors during provider initialization
- Model not available on selected provider

### **Performance Tests**
- Compare response times: Google AI vs Vertex AI
- Test with large contexts (long videos, large PDFs)
- Measure memory usage with provider switching

---

## 📊 Success Criteria

### **Phase 1: Infrastructure**
- ✅ `initializeGenAIClient()` returns correct client for both providers
- ✅ `getLiveModelName()` returns correct model name for each provider
- ✅ Error handling works for missing credentials

### **Phase 2: Live API**
- ✅ Live sessions connect with Google AI
- ✅ Live sessions connect with Vertex AI
- ✅ Audio transcription works with both providers
- ✅ Tool calling works with both providers

### **Phase 3: YouTube**
- ✅ Video analysis works with both providers
- ✅ Chunking works for long videos
- ✅ Analysis quality matches previous implementation
- ✅ No regression in functionality

### **Phase 4: Browser**
- ✅ All browser actions work with both providers
- ✅ Function calling works correctly
- ✅ Error handling is robust

### **Phase 5: PDF**
- ✅ PDF upload and analysis work with both providers
- ✅ Multimodal features work
- ✅ Output quality matches previous implementation

### **Phase 6: Suggestions**
- ✅ Suggestions generate with both providers
- ✅ Suggestions are contextual

### **Phase 7: Documentation**
- ✅ YouTube-to-Notion plan updated with Gen AI SDK
- ✅ Provider selection documented
- ✅ All code examples updated

---

## ⚠️ Risk Mitigation

### **Risk 1: API Incompatibilities**
- **Mitigation**: Create comparison table of old vs new API before starting
- **Contingency**: Keep old SDK as fallback during migration (feature flag)

### **Risk 2: Function Calling Changes**
- **Mitigation**: Test browser agent function calling thoroughly
- **Contingency**: Document any differences in behavior for user notification

### **Risk 3: Provider-Specific Limitations**
- **Mitigation**: Test all features with both providers before final migration
- **Contingency**: Document provider-specific limitations in UI

### **Risk 4: Breaking YouTube-to-Notion**
- **Mitigation**: Update plan BEFORE implementing nested agents
- **Contingency**: Plan describes old SDK - create separate updated version

### **Risk 5: Vertex AI Authentication Issues**
- **Mitigation**: Test with both service account JSON and ADC
- **Contingency**: Provide clear error messages for auth failures

---

## 📅 Timeline Estimate

| Phase | Description | Time Estimate | Dependencies | Notes |
|-------|-------------|---------------|--------------|-------|
| **Phase 1** | Core Infrastructure | 1-2 hours | None | Install AI SDK Vertex + create genAIFactory |
| **Phase 2** | Live API Migration | 2-3 hours | Phase 1 | Update to genAIFactory |
| **Phase 3** | YouTube Agent | 4-5 hours | Phase 1 | Full migration to @google/genai |
| **Phase 4** | Browser Agent | 3-4 hours | Phase 1 | Full migration to @google/genai |
| **Phase 5** | PDF Agent | **30min-1hr** ✨ | Phase 1 | **SIMPLIFIED - Use modelFactory** |
| **Phase 6** | Suggestions | **30 mins** ✨ | Phase 1 | **SIMPLIFIED - Use modelFactory** |
| **Phase 7** | Documentation | 1-2 hours | None (parallel) | Update YouTube-to-Notion plan |
| **Testing** | Full E2E Testing | 3-4 hours | All phases | Test both providers |
| **TOTAL** | **End-to-End** | **15-21 hours** ✨ | Sequential + parallel | **Saved 3 hours!** |

**Recommended Approach**: 
- **Day 1**: Phase 1 (Infrastructure - install packages, create genAIFactory)
- **Day 2**: Phases 2 + 5 + 6 (Live API + PDF + Suggestions) ✨ Quick wins!
- **Day 3-4**: Phase 3 (YouTube Agent - most complex)
- **Day 5**: Phase 4 (Browser Agent)
- **Day 6**: Phase 7 + Testing (Documentation + E2E tests)

**OR Sequential (Focus Mode)**:
- **Week 1, Day 1-2**: Phases 1-2 (Infrastructure + Live API)
- **Week 1, Day 3**: Phases 5-6 (PDF + Suggestions - FAST! ✨)
- **Week 2**: Phases 3-4 (YouTube + Browser)
- **Week 3**: Phase 7 + Full Testing

---

## 🎯 Post-YouTube-to-Notion Update

### **When to Update This Plan**
After implementing YouTube-to-Notion notes feature:

1. **Review Nested Agent Implementation**
   - Verify all nested agents use `initializeGenAIClient()`
   - Test provider selection propagation through agent hierarchy

2. **Update Testing Matrix**
   - Add YouTube-to-Notion workflow to test matrix
   - Test with both providers
   - Verify Notion page creation works identically

3. **Document Real-World Findings**
   - Any unexpected provider differences
   - Performance characteristics (Google AI vs Vertex AI)
   - Cost implications for nested agents

4. **Refine Migration Patterns**
   - If nested agents reveal new patterns, document here
   - Update code examples with real implementations
   - Add troubleshooting section for common issues

---

## 📝 Implementation Checklist

### **Before Starting**
- [ ] Read full migration guide: https://ai.google.dev/gemini-api/docs/migrate
- [ ] Review Gen AI SDK docs: https://googleapis.github.io/js-genai/
- [ ] Backup current codebase
- [ ] Create feature branch: `feat/genai-sdk-migration`
- [ ] Set up testing environment with both providers

### **Phase 1: Infrastructure**
- [ ] Install `@ai-sdk/google-vertex` via `pnpm add @ai-sdk/google-vertex`
- [ ] Verify `src/ai/core/modelFactory.ts` exists and works
- [ ] Create `src/ai/core/genAIFactory.ts`
- [ ] Implement `initializeGenAIClient()`
- [ ] Implement `getLiveModelName()`
- [ ] Test modelFactory with Google AI
- [ ] Test modelFactory with Vertex AI
- [ ] Test genAIFactory with both providers

### **Phase 2: Live API**
- [ ] Update `sessionManager.ts` constructor
- [ ] Update `connect()` method
- [ ] Find and update all callers
- [ ] Test audio transcription (Google AI)
- [ ] Test audio transcription (Vertex AI)
- [ ] Test tool calling (both providers)

### **Phase 3: YouTube Agent**
- [ ] Update imports in `youtubeAgent.ts`
- [ ] Migrate `analyzeVideoChunk()` (line 342)
- [ ] Migrate `analyzeVideoChunk()` (line 511)
- [ ] Migrate `analyzeVideoChunk()` (line 722)
- [ ] Update `youtubeAgentTool.ts`
- [ ] Test short video (both providers)
- [ ] Test long video with chunking (both providers)

### **Phase 4: Browser Agent**
- [ ] Update imports in `browserActionAgent.ts`
- [ ] Convert function declarations to new format
- [ ] Update client initialization (line 102)
- [ ] Update all browser action handlers
- [ ] Test each action (both providers)

### **Phase 5: PDF Agent** ✨ SIMPLIFIED
- [ ] Update `pdfAgent.ts` - replace direct init with `initializeModel()`
- [ ] Update `pdfAgentTool.ts` - same simple change
- [ ] Test PDF upload (Google AI)
- [ ] Test PDF upload (Vertex AI)
- [ ] Test multimodal analysis (both providers)
- [ ] Verify no regression in functionality

### **Phase 6: Suggestions** ✨ SIMPLIFIED
- [ ] Update `generator.ts` - replace direct init with `initializeModel()`
- [ ] Test suggestions in chat UI (Google AI)
- [ ] Test suggestions in chat UI (Vertex AI)
- [ ] Verify suggestions remain contextual

### **Phase 7: Documentation**
- [ ] Update architecture diagram in `youtubetonotion-.md`
- [ ] Replace code examples with Gen AI SDK
- [ ] Add provider selection documentation
- [ ] Add troubleshooting section

### **Testing & Validation**
- [ ] Run full test suite with Google AI
- [ ] Run full test suite with Vertex AI
- [ ] Test provider switching
- [ ] Test error handling
- [ ] Performance benchmarks
- [ ] Code review

### **Cleanup**
- [ ] Remove `@google/generative-ai` dependency (deprecated)
- [ ] ✅ **KEEP** `@ai-sdk/google` (not deprecated - used by PDF & Suggestions)
- [ ] ✅ **KEEP** `@ai-sdk/google-vertex` (newly added - needed for Vertex support)
- [ ] Update `package.json` - verify correct dependencies
- [ ] Update README with SDK architecture:
  - `@google/genai` for YouTube, Browser, Live API
  - AI SDK (`@ai-sdk/google` + `@ai-sdk/google-vertex`) for PDF & Suggestions
- [ ] Merge feature branch

---

## 📚 References

### **Official Documentation**
- [Migration Guide](https://ai.google.dev/gemini-api/docs/migrate)
- [Gen AI SDK Docs](https://googleapis.github.io/js-genai/)
- [Vertex AI Quickstart](https://cloud.google.com/vertex-ai/generative-ai/docs/sdks/overview)
- [Gen AI SDK GitHub](https://github.com/googleapis/js-genai)

### **Internal Documentation**
- `src/ai/core/modelFactory.ts` - Existing provider selection logic (AI SDK)
- `src/utils/providerCredentials.ts` - Credential management
- `plans/youtubetonotion-.md` - YouTube-to-Notion nested agents plan

### **SDK Packages**
- `@google/genai` v1.29.0+ - For YouTube, Browser, Live API agents
- `@google/generative-ai` v0.24.1 - ❌ Deprecated (ends April 30, 2025) - REMOVE
- `@ai-sdk/google` v2.0.28 - ✅ Keep for PDF & Suggestions (not deprecated)
- `@ai-sdk/google-vertex` v3.0.59 - ✅ Add for Vertex AI support in AI SDK

---

## ✅ Final Notes

### **Why This Migration Matters**
1. **Deprecation Risk**: `@google/generative-ai` support ends April 30, 2025 ⚠️
2. **Provider Selection**: Current agents bypass user's provider choice
3. **Two Stable SDKs**: Use both `@google/genai` AND AI SDK (both supported long-term)
4. **Pragmatic Approach**: Migrate only what needs migration, keep what works

### **Success Metrics**
- ✅ All agents respect provider selection (Google AI vs Vertex AI)
- ✅ No functionality regression
- ✅ Improved code maintainability
- ✅ Zero deprecated dependencies (only remove `@google/generative-ai`)
- ✅ Leverage existing infrastructure (`modelFactory.ts`)
- ✅ YouTube-to-Notion ready for implementation with modern SDKs

### **Final SDK Architecture**
```
┌─────────────────────────────────────────────────────────┐
│                    CHROME AI EXTENSION                   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  @google/genai (NEW)              AI SDK (KEEP)          │
│  ├─ YouTube Agent                 ├─ PDF Agent           │
│  ├─ Browser Agent                 ├─ Suggestions         │
│  └─ Live API                      └─ (via modelFactory)  │
│                                                           │
│  Both support Google AI + Vertex AI via provider         │
│  selection through getActiveProvider()                   │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### **Next Steps After Completion**
1. Implement YouTube-to-Notion notes feature using Gen AI SDK
2. Monitor provider usage and costs
3. Optimize for performance differences between providers
4. Explore new Gen AI SDK features (batching, caching, etc)

---

**Created by**: GitHub Copilot  
**Last Updated**: November 12, 2025  
**Status**: Ready for Review & Implementation
