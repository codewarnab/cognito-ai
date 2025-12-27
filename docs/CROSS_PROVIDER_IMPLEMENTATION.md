# Cross-Provider AI Implementation Plan

> **Goal**: Enable the Cognito extension to use multiple AI providers (OpenAI, Anthropic, xAI, DeepSeek, Groq, Ollama) beyond the current Google-only support.

## Current State Analysis

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           WEBAPP (/providers page)                            │
│  ✅ Supports: OpenAI, Anthropic, Google Gemini, Vertex, xAI, DeepSeek, Groq  │
└──────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         EXTENSION (chrome storage)                            │
│  ✅ Stores all provider configs via `providerService.ts` → IndexedDB         │
│  ❌ BUT: Only USES Google/Vertex credentials for AI calls                    │
└──────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    AI MODULES (hardcoded to Google)                           │
│  ❌ modelFactory.ts, modelSetup.ts, genAIFactory.ts                          │
│  ❌ geminiSummarizer.ts, geminiWriter.ts, geminiRewriter.ts                  │
│  ❌ extractionService.ts, contentMemory/processor.ts                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Files Using Google-Only APIs

| File | Module | Current Provider |
|------|--------|------------------|
| `src/ai/core/modelFactory.ts` | Main chat model initialization | `@ai-sdk/google`, `@ai-sdk/google-vertex` |
| `src/ai/core/modelSetup.ts` | Remote model setup | `@ai-sdk/google` only |
| `src/ai/core/genAIFactory.ts` | Native GenAI client (Live API) | `@google/genai` |
| `src/background/summarizer/geminiSummarizer.ts` | Text summarization | Direct Gemini HTTP API |
| `src/background/writer/geminiWriter.ts` | Text generation | Direct Gemini HTTP API |
| `src/background/rewriter/geminiRewriter.ts` | Text rewriting | Direct Gemini HTTP API |
| `src/background/supermemory/extraction/extractionService.ts` | Memory extraction | Direct Gemini HTTP API |
| `src/background/supermemory/contentMemory/processor.ts` | Content processing | `getGoogleApiKey()` |
| `src/ai/fileApi/client.ts` | File API client | `getGoogleApiKey()` |
| `src/components/features/chat/components/buttons/VoiceButton.tsx` | Voice mode | `getGoogleApiKey()` |

### Current Type Definitions

```typescript
// providerTypes.ts
export type AIProvider = 'google' | 'vertex'; // ❌ Too restrictive

// ProviderInfo interface (used in summarizer, writer, rewriter)
interface ProviderInfo {
    type: 'google' | 'vertex'; // ❌ Hardcoded
    url: string;
    headers: Record<string, string>;
}
```

---

## Implementation Phases

### Phase 0: Foundation (Prerequisites)

#### 0.1 Install AI SDK Packages

Add to `apps/extension/package.json`:

```json
{
  "dependencies": {
    "@ai-sdk/openai": "catalog:",
    "@ai-sdk/anthropic": "catalog:"
  }
}
```

> **Note**: xAI, DeepSeek, Groq, and Ollama can use `@ai-sdk/openai` with custom base URLs (OpenAI-compatible).

#### 0.2 Update Workspace Catalog

Add to `pnpm-workspace.yaml`:

```yaml
catalog:
  "@ai-sdk/openai": ^1.3.22
  "@ai-sdk/anthropic": ^1.3.22
```

---

### Phase 1: Type System Updates

#### 1.1 Extend AIProvider Type

**File**: `src/utils/credentials/providerTypes.ts`

```typescript
// Before
export type AIProvider = 'google' | 'vertex';

// After
export type AIProvider = 
  | 'google' 
  | 'vertex' 
  | 'openai' 
  | 'anthropic' 
  | 'xai' 
  | 'deepseek' 
  | 'groq' 
  | 'ollama';
```

#### 1.2 Update ProviderConfig Interface

**File**: `src/utils/credentials/providerTypes.ts`

```typescript
export interface ProviderConfig {
  activeProvider?: AIProvider;
  googleApiKey?: string;
  vertexCredentials?: VertexCredentials;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  xaiApiKey?: string;
  deepseekApiKey?: string;
  groqApiKey?: string;
  ollamaBaseUrl?: string;
}
```

#### 1.3 Update @cognito/shared Types

**File**: `packages/shared/src/types/provider.ts`

Ensure consistency with extension types for API contracts.

---

### Phase 2: Credential Management

#### 2.1 Add Credential Getters/Setters

**File**: `src/utils/credentials/providerCredentials.ts`

Add functions:
- `getOpenAIApiKey() / setOpenAIApiKey()`
- `getAnthropicApiKey() / setAnthropicApiKey()`
- `getXAIApiKey() / setXAIApiKey()`
- `getDeepSeekApiKey() / setDeepSeekApiKey()`
- `getGroqApiKey() / setGroqApiKey()`
- `getOllamaConfig() / setOllamaConfig()`

#### 2.2 Update getActiveProvider()

Modify to read from `providersConfig` (new multi-provider system) instead of legacy single-provider storage.

---

### Phase 3: Model Factory Refactor (Main Chat)

> **Priority: HIGH** - This affects the main chat functionality.

#### 3.1 Create Provider Adapters

**New File**: `src/ai/providers/index.ts`

```typescript
export * from './openaiProvider';
export * from './anthropicProvider';
export * from './googleProvider';
export * from './ollamaProvider';
```

**New File**: `src/ai/providers/openaiProvider.ts`

```typescript
import { createOpenAI } from '@ai-sdk/openai';

export function createOpenAIProvider(apiKey: string, options?: { baseUrl?: string }) {
  return createOpenAI({
    apiKey,
    baseURL: options?.baseUrl,
  });
}
```

**New File**: `src/ai/providers/anthropicProvider.ts`

```typescript
import { createAnthropic } from '@ai-sdk/anthropic';

export function createAnthropicProvider(apiKey: string) {
  return createAnthropic({ apiKey });
}
```

#### 3.2 Update modelFactory.ts

**File**: `src/ai/core/modelFactory.ts`

```typescript
// Add imports
import { createOpenAIProvider, createAnthropicProvider } from '../providers';

// Update initializeModel()
async function initializeModel(modelName: string): Promise<ModelInitResult> {
  const provider = await getActiveProvider();
  
  switch (provider) {
    case 'google':
      return initializeGoogleModel(modelName);
    case 'vertex':
      return initializeVertexModel(modelName);
    case 'openai':
      return initializeOpenAIModel(modelName);
    case 'anthropic':
      return initializeAnthropicModel(modelName);
    case 'xai':
    case 'deepseek':
    case 'groq':
      return initializeOpenAICompatibleModel(provider, modelName);
    case 'ollama':
      return initializeOllamaModel(modelName);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

// Add new initialization functions
async function initializeOpenAIModel(modelName: string): Promise<ModelInitResult> {
  const apiKey = await getOpenAIApiKey();
  if (!apiKey) throw new Error('OpenAI API key not configured');
  
  const openai = createOpenAIProvider(apiKey);
  return { model: openai(modelName), provider: 'openai' };
}

async function initializeAnthropicModel(modelName: string): Promise<ModelInitResult> {
  const apiKey = await getAnthropicApiKey();
  if (!apiKey) throw new Error('Anthropic API key not configured');
  
  const anthropic = createAnthropicProvider(apiKey);
  return { model: anthropic(modelName), provider: 'anthropic' };
}

async function initializeOpenAICompatibleModel(
  provider: 'xai' | 'deepseek' | 'groq',
  modelName: string
): Promise<ModelInitResult> {
  const { apiKey, baseUrl } = await getOpenAICompatibleConfig(provider);
  if (!apiKey) throw new Error(`${provider} API key not configured`);
  
  const client = createOpenAIProvider(apiKey, { baseUrl });
  return { model: client(modelName), provider };
}
```

---

### Phase 4: Summarizer/Writer/Rewriter Refactor

> **Priority: MEDIUM** - These are standalone features.

#### 4.1 Create Unified AI Client

**New File**: `src/background/ai/unifiedAIClient.ts`

```typescript
/**
 * Unified AI Client
 * Provides streaming text generation across all providers
 * Used by summarizer, writer, rewriter
 */
export class UnifiedAIClient {
  private model: string;
  
  constructor(model?: string) {
    this.model = model || 'default';
  }
  
  async *generateStream(prompt: string, options: GenerateOptions): AsyncGenerator<string> {
    const provider = await getActiveProvider();
    
    switch (provider) {
      case 'google':
      case 'vertex':
        yield* this.geminiStream(prompt, options);
        break;
      case 'openai':
      case 'xai':
      case 'deepseek':
      case 'groq':
        yield* this.openaiCompatibleStream(provider, prompt, options);
        break;
      case 'anthropic':
        yield* this.anthropicStream(prompt, options);
        break;
      case 'ollama':
        yield* this.ollamaStream(prompt, options);
        break;
    }
  }
  
  // Provider-specific implementations...
}
```

#### 4.2 Refactor geminiSummarizer.ts

**Option A**: Rename to `summarizer.ts` and use UnifiedAIClient  
**Option B**: Keep Gemini-specific for now, add parallel implementations

Recommended: **Option A** for long-term maintainability.

#### 4.3 Refactor geminiWriter.ts

Same approach as summarizer.

#### 4.4 Refactor geminiRewriter.ts

Same approach as summarizer.

---

### Phase 5: Memory Extraction Refactor

**File**: `src/background/supermemory/extraction/extractionService.ts`

This uses Gemini function calling which differs across providers:
- **OpenAI**: Has tool calling with similar structure
- **Anthropic**: Has tool use with different format
- **Others**: May not support it

**Approach**: Create provider-specific extraction strategies.

---

### Phase 6: Voice Mode & Live API

**Files**:
- `src/ai/core/genAIFactory.ts`
- `src/components/features/chat/components/buttons/VoiceButton.tsx`

Currently uses `@google/genai` for Gemini Live API. Other providers have their own realtime APIs:
- **OpenAI**: Realtime API
- **Anthropic**: Not yet available

**Approach**: Phase this later, as it requires significant provider-specific work.

---

## Implementation Order (One Provider at a Time)

### Sprint 1: OpenAI Support

1. ✅ Phase 0.1: Install `@ai-sdk/openai`
2. ✅ Phase 1.1: Extend AIProvider type
3. ✅ Phase 1.2: Update ProviderConfig
4. ✅ Phase 2.1: Add `getOpenAIApiKey()` / `setOpenAIApiKey()`
5. ✅ Phase 3: Update modelFactory.ts for OpenAI
6. ⏸️ Phase 4: Keep summarizer/writer/rewriter on Gemini initially

**Test**: Verify chat works with OpenAI API key.

### Sprint 2: Anthropic Support

1. Install `@ai-sdk/anthropic`
2. Add `getAnthropicApiKey()` / `setAnthropicApiKey()`
3. Update modelFactory.ts for Anthropic
4. Handle Anthropic-specific features (longer context, system prompts)

**Test**: Verify chat works with Anthropic API key.

### Sprint 3: OpenAI-Compatible Providers (xAI, DeepSeek, Groq)

1. Add credential getters for each
2. Use `@ai-sdk/openai` with custom base URLs
3. Update modelFactory.ts

**Test**: Verify each provider works.

### Sprint 4: Ollama (Local AI)

1. Add Ollama configuration (base URL, no API key)
2. Use `@ai-sdk/openai` with Ollama endpoint
3. Handle model discovery from Ollama

**Test**: Verify local Ollama models work.

### Sprint 5: Summarizer/Writer/Rewriter Multi-Provider

1. Create UnifiedAIClient
2. Refactor each service to use it
3. Maintain backward compatibility

**Test**: Verify summarize/write/rewrite work with all providers.

### Sprint 6: Memory Extraction Multi-Provider

1. Create provider-specific extraction strategies
2. Handle different function calling formats

### Sprint 7: Voice Mode (Future)

1. Research OpenAI Realtime API
2. Create provider-specific voice implementations

---

## Files to Modify Summary

### Must Modify (Sprint 1-2)

| File | Change |
|------|--------|
| `package.json` | Add AI SDK packages |
| `providerTypes.ts` | Extend AIProvider type |
| `providerCredentials.ts` | Add new credential functions |
| `modelFactory.ts` | Add provider switch cases |
| `externalHandler.ts` | Ensure new providers handled |

### Should Create (Sprint 1-2)

| File | Purpose |
|------|---------|
| `src/ai/providers/openaiProvider.ts` | OpenAI adapter |
| `src/ai/providers/anthropicProvider.ts` | Anthropic adapter |
| `src/ai/providers/index.ts` | Provider exports |

### Refactor Later (Sprint 4-5)

| File | Change |
|------|--------|
| `geminiSummarizer.ts` | Rename to `summarizer.ts`, use UnifiedAIClient |
| `geminiWriter.ts` | Rename to `writer.ts`, use UnifiedAIClient |
| `geminiRewriter.ts` | Rename to `rewriter.ts`, use UnifiedAIClient |
| `extractionService.ts` | Add multi-provider extraction |

---

## Testing Strategy

### Unit Tests

- Test each provider initialization in modelFactory
- Test credential storage/retrieval
- Test provider-specific streaming

### Integration Tests

- End-to-end chat with each provider
- Summarizer/writer/rewriter with each provider
- Memory extraction with supported providers

### Manual Testing Checklist

- [ ] Configure OpenAI key in webapp → Chat works
- [ ] Configure Anthropic key in webapp → Chat works
- [ ] Configure xAI key in webapp → Chat works
- [ ] Switch between providers → No stale data
- [ ] Backend mode still works → Falls back correctly

---

## Rollback Strategy

Each sprint is isolated. If a provider fails:
1. Remove provider from AIProvider type
2. Remove credential functions
3. Remove modelFactory case

The remaining providers continue to work.

---

## Known Issues

### Provider Config Not Persisting (CRITICAL)

**Status**: Unresolved

**Description**: Model toggle changes in the webapp (`/providers`) do not persist after page reload. The `extensionAPI.setProvidersConfig()` call either isn't triggering or failing silently.

**Symptoms**:
- Toggle a model ON/OFF in webapp
- Reload the page
- Toggle resets to original state (usually all OFF/default presets)

**Files Involved**:
- `apps/webapp/src/app/providers/page.tsx` - `handleChange` → `debouncedSave` → `saveConfig`
- `apps/webapp/src/lib/extension-api.ts` - `setProvidersConfig()`
- `apps/extension/src/background/messaging/externalHandler.ts` - `SET_PROVIDERS_CONFIG` handler
- `apps/extension/src/services/providerService.ts` - IndexedDB storage

**Impact**: Model selector sync feature depends on this working. Without persistence, enabled/disabled model filtering cannot function.

**Investigation Needed**:
1. Verify `handleChange` is called when model toggle changes
2. Check if extension is properly detected (`isInstalled`)
3. Verify `setProvidersConfig` response in console
4. Check IndexedDB after save

---

## Open Questions

1. **Model Selection UI**: How should users select models per provider? (Different providers have different models)
2. **Feature Parity**: Some features (URL context, Google Search grounding) are Gemini-specific. How to handle?
3. **Voice Mode**: Should we support other providers' realtime APIs?
4. **Cost Tracking**: Should we track token usage across providers?

---

## Related Documentation

- [Model Selector Sync Architecture](./MODEL_SELECTOR_SYNC.md) - How extension syncs with webapp
- [Provider Configuration Flow](./cross_provider_analysis.md) (artifact)
- [Backend Vercel GEMINI.md](../packages/backend-vercel/GEMINI.md)
- [Extension GEMINI.md](../apps/extension/GEMINI.md)
