# Model Selector Sync Architecture

This document describes how the extension's model selector syncs with the webapp's provider configuration.

## Overview

The webapp at `/providers` is the **source of truth** for enabled/disabled models. When a user disables a model in the webapp, it immediately disappears from the extension's model selector popover.

## Data Flow

```
WEBAPP (/providers)
    │
    ▼ extensionAPI.setProvidersConfig()
    │
EXTENSION (IndexedDB: providersConfig)
    │ + chrome.storage.local: providersConfigLastUpdated
    │
    ▼ storage.onChanged listener
    │
ModelSelectorPopover (refreshes enabled models)
```

## Key Files

| File | Purpose |
|------|---------|
| `apps/extension/src/utils/ai/modelSelectorUtils.ts` | Provider mapping, enabled model extraction |
| `apps/extension/src/utils/ai/modelSettings.ts` | Stores `remoteModel` + `remoteProvider` |
| `apps/extension/src/services/providerService.ts` | Broadcasts `providersConfigLastUpdated` on save |
| `apps/extension/src/components/.../ModelSelectorPopover.tsx` | Consumes enabled models with real-time sync |
| `packages/shared/src/types/messaging.ts` | `GetProvidersConfigResponse` with `selectedModel`/`selectedProvider` |

## Model Selection Storage

```typescript
// Stored in chrome.storage.local under 'ai_model_config'
interface StoredModelConfig {
  mode: 'local' | 'remote';
  remoteModel: string;        // e.g. 'gemini-2.5-flash'
  remoteProvider?: string;    // e.g. 'google_gemini' or 'vertex'
}
```

**Important**: Same model ID can exist under multiple providers (e.g., `gemini-2.5-flash` under both Google Gemini and Vertex AI). The `remoteProvider` field disambiguates which provider's model is selected.

## Provider ID Mapping

| Extension UI | Webapp/Config |
|--------------|---------------|
| `google` | `google_gemini` |
| `vertex` | `vertex` |
| `anthropic` | `anthropic` |
| `xai` | `xai` |
| `openai` | `openai` |

## Real-Time Sync Mechanism

1. Webapp calls `extensionAPI.setProvidersConfig(config)`
2. Extension saves to IndexedDB AND sets `providersConfigLastUpdated` in `chrome.storage.local`
3. `ModelSelectorPopover` listens to `chrome.storage.onChanged`
4. When `providersConfigLastUpdated` changes, popover reloads enabled models from IndexedDB

## Default Model Protection

The `GET_PROVIDERS_CONFIG` API returns `selectedModel` and `selectedProvider` so the webapp can:
1. Know which model is currently selected in the extension
2. Show a warning if user tries to disable the selected model

## Edge Cases

| Case | Behavior |
|------|----------|
| Selected model disabled | Webapp should warn user to select another first |
| All provider models disabled | Provider section hidden from selector |
| No providers configured | Fallback: show all models (no filtering) |
| API key not configured | Error shown when user sends a message, not on model selection |

## Related Documentation

- [CROSS_PROVIDER_IMPLEMENTATION.md](./CROSS_PROVIDER_IMPLEMENTATION.md) - Overall multi-provider architecture
- [Extension GEMINI.md](../apps/extension/GEMINI.md) - Extension development context
