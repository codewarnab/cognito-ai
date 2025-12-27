# Model Configuration Synchronization

This document describes how AI model configurations and provider settings are synchronized between the webapp (`apps/webapp`) and the Chrome extension (`apps/extension`).

## Overview

The Cognito AI system allows users to configure AI providers and models via a centralized web interface (the webapp). However, the extension must be able to access these settings independently, even when the webapp is closed. To achieve this, we use a **push-based synchronization pattern** where the webapp writes to the extension's storage, which acts as the single source of truth for the extension's runtime.

## Data Flow

1.  **User Action**: User modifies provider settings in the webapp (e.g., enables a model, adds an API key).
2.  **Message Dispatch**: The webapp sends a runtime message `SET_PROVIDERS_CONFIG` to the extension.
3.  **Storage Update**: The extension's background script receives the message and persists the payload to `chrome.storage.local`.
4.  **State Hydration**: The extension (side panel or background) reads from `chrome.storage.local` to initialize its state.

## Architecture

### 1. The Source of Truth: `chrome.storage.local`

The `providersConfig` object definition in `chrome.storage.local` is the authoritative record of:
- Which providers are enabled.
- Which models are available for each provider.
- Custom API keys (if applicable).

### 2. The Editor: Webapp

The webapp functions as a UI editor for this configuration. It does not store the configuration in its own database (except for what might be cached in the browser session or local storage for UI purposes, but the extension path is critical).

### 3. Communication Protocol

The synchronization relies on the Chrome Runtime Messaging API.

#### Set Configuration (Webapp -> Extension)

**Message Type**: `SET_PROVIDERS_CONFIG`

**Payload**: `AIProviderConfig` (Defined in `@cognito/shared`)

**Handler**: `apps/extension/src/background/messaging/externalHandler.ts`

```typescript
// Simplified Handler Logic
case 'SET_PROVIDERS_CONFIG': {
    const payload = message.payload;
    await setProvidersConfig(payload); // Writes to chrome.storage.local
    return { success: true };
}
```

#### Get Configuration (Webapp <- Extension)

**Message Type**: `GET_PROVIDERS_CONFIG`

**Handler**: `apps/extension/src/background/messaging/externalHandler.ts`

Used by the webapp to fetch current settings on load.

## Key Components

| Component | File | Role |
|-----------|------|------|
| **External Handler** | `apps/extension/src/background/messaging/externalHandler.ts` | Receives messages from webapp. |
| **Settings Store** | `apps/extension/src/stores/settings/settingsStore.ts` | Manages state within the extension UI (side panel). |
| **Provider Service** | `apps/extension/src/services/providerService.ts` | Utilities for reading/writing config (used by handler). |
| **Model Selector** | `apps/extension/src/utils/ai/modelSelectorUtils.ts` | Reads config to populate UI dropdowns. |

## Persistence Guarantee

Since `chrome.storage.local` is persistent across browser restarts and is independent of the webapp tab:
- **Webapp Open**: Changes sync immediately.
- **Webapp Closed**: Extension retains the last known configuration.
- **Browser Restart**: Configuration is loaded from disk.

## Security Note

Only trusted origins (defined in `manifest.json` under `externally_connectable` and verified in `externalHandler.ts`) are allowed to send these configuration messages. This prevents malicious websites from altering user settings.
