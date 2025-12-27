# OpenAI Provider Integration - Implementation Plan

Add OpenAI support for summarizer, rewriter, and writer modules using direct API calls. Create a constants file for content script models and fix the known provider config persistence issue.

## User Review Required

> [!IMPORTANT]
> **Model Selection for Content Scripts**: You mentioned using "gpt 5 mini" for content scripts. Based on the [OpenAI presets](file:///c:/Users/User/code/hackathons/chrome-ai/apps/webapp/src/lib/providers/presets.ts), the available models are:
> - `gpt-5-mini` - Faster, cheaper version of GPT-5 family
> - `gpt-5-nano` - Fastest, most cost-efficient  
> - `gpt-4.1-mini` - Cheaper, faster alternative to GPT-4.1
> 
> Please confirm `gpt-5-mini` is the correct model ID for content scripts.

> [!WARNING]
> **OpenAI API Differences**: OpenAI's streaming format (SSE with `data: {"choices": [...]}`) differs from Gemini's format. The implementation will need separate stream parsers.

---

## Proposed Changes

### Constants (`apps/extension/src/constants`)

#### [NEW] [contentScriptModels.ts](file:///c:/Users/User/code/hackathons/chrome-ai/apps/extension/src/constants/contentScriptModels.ts)

Create a new constants file defining which models to use for content script features (summarizer, writer, rewriter) per provider. These are developer-defined, not user-selectable.

```typescript
/**
 * Content Script Models
 * Models used internally by content script features (summarizer, writer, rewriter)
 * These are developer-controlled, not user-selectable
 */
export const CONTENT_SCRIPT_MODELS = {
    google: {
        model: 'gemini-2.5-flash-lite',
        name: 'Gemini 2.5 Flash Lite',
    },
    vertex: {
        model: 'gemini-2.5-flash-lite',
        name: 'Gemini 2.5 Flash Lite',
    },
    openai: {
        model: 'gpt-5-mini',
        name: 'GPT 5 Mini',
    },
    // Future providers
    anthropic: {
        model: 'claude-haiku-4-5',
        name: 'Claude Haiku 4.5',
    },
} as const;
```

---

### Type Updates (`packages/shared/src/types`)

#### [MODIFY] [provider.ts](file:///c:/Users/User/code/hackathons/chrome-ai/packages/shared/src/types/provider.ts)

Extend `AIProvider` type to include OpenAI:

```diff
-export type AIProvider = 'google' | 'vertex';
+export type AIProvider = 'google' | 'vertex' | 'openai';
```

Add `openaiApiKey` to `ProviderConfig`:

```diff
 export interface ProviderConfig {
     provider: AIProvider;
     googleApiKey?: string;
     vertexCredentials?: VertexCredentials;
+    openaiApiKey?: string;
 }
```

---

#### [MODIFY] [providerTypes.ts](file:///c:/Users/User/code/hackathons/chrome-ai/apps/extension/src/utils/credentials/providerTypes.ts)

Mirror the shared type changes:

```diff
-export type AIProvider = 'google' | 'vertex';
+export type AIProvider = 'google' | 'vertex' | 'openai';

 export interface ProviderConfig {
     provider: AIProvider;
     googleApiKey?: string;
     vertexCredentials?: VertexCredentials;
+    openaiApiKey?: string;
 }
```

---

### Credential Management (`apps/extension/src/utils/credentials`)

#### [MODIFY] [providerCredentials.ts](file:///c:/Users/User/code/hackathons/chrome-ai/apps/extension/src/utils/credentials/providerCredentials.ts)

Add OpenAI credential functions (following the existing pattern for Google):

```typescript
/**
 * Get OpenAI API key from provider config
 */
export async function getOpenAIApiKey(): Promise<string | null> {
    const config = await getProviderConfig();
    return config?.openaiApiKey || null;
}

/**
 * Set OpenAI API key
 */
export async function setOpenAIApiKey(apiKey: string): Promise<void> {
    if (!apiKey || apiKey.trim().length === 0) {
        throw APIError.authFailed('API key cannot be empty');
    }
    const config = await getProviderConfig() || { provider: 'openai' };
    config.provider = 'openai';
    config.openaiApiKey = apiKey.trim();
    await setProviderConfig(config);
    credentialsLog.info('OpenAI API key configured');
}

/**
 * Check if OpenAI API key is configured
 */
export async function hasOpenAIApiKey(): Promise<boolean> {
    const config = await getProviderConfig();
    return !!(config?.openaiApiKey && config.openaiApiKey.trim().length > 0);
}

/**
 * Clear OpenAI API key from storage
 */
export async function clearOpenAIApiKey(): Promise<void> {
    const config = await getProviderConfig();
    if (config) {
        delete config.openaiApiKey;
        // Fall back to other providers if available
        if (config.googleApiKey) {
            config.provider = 'google';
            await chrome.storage.local.set({ [STORAGE_KEY]: config });
        } else if (config.vertexCredentials) {
            config.provider = 'vertex';
            await chrome.storage.local.set({ [STORAGE_KEY]: config });
        } else {
            await chrome.storage.local.remove(STORAGE_KEY);
        }
    }
    credentialsLog.info('OpenAI API key cleared');
}
```

Update `getActiveProvider()` to include OpenAI:

```diff
 export async function getActiveProvider(): Promise<AIProvider> {
     const config = await getProviderConfig();
     
     if (config?.provider) {
         if (config.provider === 'vertex' && await hasVertexCredentials()) {
             return 'vertex';
         }
         if (config.provider === 'google' && await hasGoogleApiKey()) {
             return 'google';
         }
+        if (config.provider === 'openai' && await hasOpenAIApiKey()) {
+            return 'openai';
+        }
     }
     
     const hasVertex = await hasVertexCredentials();
     const hasGoogle = await hasGoogleApiKey();
+    const hasOpenAI = await hasOpenAIApiKey();
     
+    // Priority: Vertex > Google > OpenAI
     if (hasVertex && hasGoogle) {
         return 'vertex';
     } else if (hasVertex) {
         return 'vertex';
     } else if (hasGoogle) {
         return 'google';
+    } else if (hasOpenAI) {
+        return 'openai';
     }
     
     throw new APIError({...});
 }
```

---

### Summarizer (`apps/extension/src/background/summarizer`)

#### [MODIFY] [geminiSummarizer.ts](file:///c:/Users/User/code/hackathons/chrome-ai/apps/extension/src/background/summarizer/geminiSummarizer.ts)

Refactor to support both Gemini and OpenAI providers. Key changes:

1. Import new credential functions and content script models
2. Update `ProviderInfo` type to include OpenAI
3. Add OpenAI provider configuration in `getProviderInfo()`
4. Create separate stream parsing logic for OpenAI SSE format

```typescript
// New ProviderInfo type
interface ProviderInfo {
    type: 'google' | 'vertex' | 'openai';
    url: string;
    headers: Record<string, string>;
}

// In getProviderInfo(), add OpenAI branch:
if (await hasOpenAIApiKey()) {
    const apiKey = await getOpenAIApiKey();
    log.debug('Using OpenAI provider');
    return {
        type: 'openai',
        url: 'https://api.openai.com/v1/chat/completions',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
    };
}
```

Create OpenAI-specific request body and stream parser in `summarizeStream()`.

---

### Writer (`apps/extension/src/background/writer`)

#### [MODIFY] [geminiWriter.ts](file:///c:/Users/User/code/hackathons/chrome-ai/apps/extension/src/background/writer/geminiWriter.ts)

Same pattern as summarizer - add OpenAI support with streaming.

---

### Rewriter (`apps/extension/src/background/rewriter`)

#### [MODIFY] [geminiRewriter.ts](file:///c:/Users/User/code/hackathons/chrome-ai/apps/extension/src/background/rewriter/geminiRewriter.ts)

Add OpenAI support for non-streaming rewrite operations.

---

### Fix Known Issue: Provider Config Persistence

The issue is that model toggle changes in the webapp don't persist after page reload.

#### Investigation Steps

1. Add debug logging to trace the flow:
   - `handleChange` in `providers/page.tsx`
   - `debouncedSave` / `saveConfig`  
   - `extensionAPI.setProvidersConfig()`
   - Extension's `externalHandler.ts` SET_PROVIDERS_CONFIG handler
   - `providerService.setProvidersConfig()` → IndexedDB write

2. Check if the issue is:
   - Extension not detected (`isInstalled` false)
   - API call failing silently
   - IndexedDB write not completing
   - Config not being loaded on page reload

#### Potential Fix Locations

- [externalHandler.ts](file:///c:/Users/User/code/hackathons/chrome-ai/apps/extension/src/background/messaging/externalHandler.ts) - Verify SET_PROVIDERS_CONFIG handler
- [providerService.ts](file:///c:/Users/User/code/hackathons/chrome-ai/apps/extension/src/services/providerService.ts) - Verify IndexedDB operations

---

## Verification Plan

### Manual Verification

Since there are no existing automated tests for these modules, verification will be manual:

1. **OpenAI Summarizer Test**:
   - Configure OpenAI API key via webapp `/providers` page
   - Select text on any webpage
   - Trigger summarize action
   - Verify summary is generated using OpenAI
   - Check console logs for "Using OpenAI provider"

2. **OpenAI Writer Test**:
   - With OpenAI configured, use the writer feature
   - Verify text generation works
   - Check console logs

3. **OpenAI Rewriter Test**:
   - Select text and trigger rewrite
   - Verify rewritten text is returned
   - Check console logs

4. **Provider Config Persistence Test**:
   - Go to `/providers` page
   - Toggle a model ON/OFF
   - Reload the page
   - Verify toggle state persisted

5. **Content Script Models Constant Test**:
   - Verify `CONTENT_SCRIPT_MODELS` is exported correctly
   - Verify summarizer/writer/rewriter import and use the correct model per provider

### Build Verification

```bash
# Build the extension to verify no TypeScript errors
pnpm build:extension

# Build shared package first
pnpm --filter @cognito/shared build
```
