# xAI (Grok) Integration Plan

This document outlines the detailed plan to integrate xAI (Grok) into the Cognito AI extension.

## Goal
Add full support for xAI as a provider, enabling users to:
1. Configure xAI API Key.
2. Select xAI models (Grok-3, Grok-3 Mini, etc.) in the Chat and other features.
3. Use xAI for background tasks (Writer, Rewriter, Summarizer).
4. Leverage xAI's agentic capabilities (Web Search) and Multimodal features.

## Prerequisites
- xAI API Access (User provided key).
- `@ai-sdk/xai` package.
- Minimum SDK version: `1.4.0` (for full Files/Agentic support).

## Phase 1: Foundation (Types & Dependencies)

### 1.1 Install Dependencies
- **Action**: Add `@ai-sdk/xai` to `apps/extension/package.json`.
- **Command**: `pnpm add @ai-sdk/xai --filter @cognito/extension`

### 1.2 Update Shared Types
- **File**: `packages/shared/src/types/provider.ts`
- **Action**:
    - Update `AIProvider` type to include `'xai'`.
    - Update `ProviderConfig` interface to include `xaiApiKey?: string`.

### 1.3 Update Extension Settings Types
- **File**: `apps/extension/src/utils/credentials/providerTypes.ts`
- **Action**: Add `xai` to `AIProvider` type alias.

## Phase 2: Credential Management

### 2.1 Credential Storage & Retrieval
- **File**: `apps/extension/src/utils/credentials/providerCredentials.ts`
- **Action**:
    - Implement `getXaiApiKey()`: Retrieve `xaiApiKey` from storage.
    - Implement `setXaiApiKey()`: Save `xaiApiKey` to storage.
    - Update `isProviderConfigured` logic to check for xAI.

### 2.2 Error Handling
- **File**: `apps/extension/src/errors/errorTypes.ts`
- **Action**: Ensure error types support xAI specific errors (generic `API_AUTH_FAILED`, `429 Rate Limit`, etc.).

## Phase 3: Core AI Integration (Chat & Model Factory)

### 3.1 Model Factory
- **File**: `apps/extension/src/ai/core/modelFactory.ts`
- **Action**:
    - Import `createXai` from `@ai-sdk/xai`.
    - Implement `initializeXaiModel(modelName: string)`:
        - Retrieve API key.
        - Create xai instance: `createXai({ apiKey })`.
        - **Memory Function Calling**: Crucially, wrap the model with `withSupermemory(model)` to enable memory tools (`save_memory`, `search_memory`). This allows Grok to store and retrieve user context autonomously.
        - Return `ModelInitResult`.
    - Update `initializeModel` switch case to handle `'xai'`.
    - Update `isProviderAvailable` to check xAI.

### 3.2 Function Calling Strategy
xAI supports OpenAI-compatible function calling.
- **Client-Side Tools**: We will primarily use standard client-side tools (browser actions, custom extension tools) which are compatible with Grok.
- **Agentic Tools (Server-Side)**:
    - xAI offers "Agentic" tools like `web_search` and `x_search` if using `xai.responses(model)`.
    -https://docs.x.ai/docs/guides/live-search 
    https://docs.x.ai/docs/guides/tools/search-tools
    fetch this ldocs see which one will better implement tha 
    
    - *Future*: We may add a specific "xAI Agent" mode that uses `xai.responses` to leverage their server-side browser.

## Phase 4: Files & Image Handling (Multimodal)

### 4.1 Image/File Input Strategy
When sending files/images from features like **Writer**, **Chat**, or **Rewriter**:

1.  **Standard Multimodal (Vision)**:
    - **Method**: Use the standard `ai-sdk` `experimental_attachments` or content array format.
    - **Format**: Convert images to **Base64** data URLs (`data:image/jpeg;base64,...`).
    - **Support**: Grok-2 Vision models support this natively.
    - **Writer Implementation**: When the Writer attaches an image (e.g. from user selection or screen context), it must be converted to a Base64 string and passed in the `messages` array as `{ type: 'image', image: '...' }`.

2.  **Files API (Document Search)**:
    - **Context**: For large documents (PDFs, text files) that exceed context limits.
    - **Method**: xAI supports a `/files` endpoint.
    - **Plan**: For V1, we will stick to **Base64/Text extraction** (Standard RAG) as currently implemented in the extension for other providers. This is simpler and avoids managing remote file lifecycles on xAI servers.
    - *Note*: If `document_search` tool is required, we would need to upload to `https://api.x.ai/v1/files` first. This is deferred to V2 unless strictly requested.

### 4.2 Handling in Writer/Rewriter
- **File**: `apps/extension/src/background/writer/writer.ts` (and similar)
- **Action**:
    - Ensure the `generateText` or `streamText` call correctly formats attachments for xAI.
    - xAI is mostly OpenAI-compatible, so the existing OpenAI attachment logic should work.
    - Verify `grok-2-vision` is selected if images are present.

## Phase 5: Background Provider Integration

### 5.1 New Provider Implementation
- **Directory**: `apps/extension/src/background/providers/xai/`
- **Files**:
    - `index.ts`: Implement `XAIProvider` class implementing `IProvider`.
    - `types.ts`: specific types if needed.
- **Action**:
    - Implement `getConfig`: URL `https://api.x.ai/v1/chat/completions`.
    - Implement `buildRequestBody`: Standard OpenAI-compatible format.
    - **Important**: Ensure `tools` payload is formatted correctly (standard OpenAI format).
    - Implement `parseResponse` and `parseStreamChunk`.

### 5.2 Register Provider
- **File**: `apps/extension/src/background/providers/index.ts`
- **Action**:
    - Import `XAIProvider`.
    - Update `getProviderByType` switch case.

## Phase 6: UI & Webapp Integration

### 6.1 Webapp Setup
- **File**: `apps/webapp/src/components/providers/XaiSetup.tsx`
- **Action**: Create setup component similar to `GoogleSetup`.
- **File**: `apps/webapp/src/app/providers/page.tsx`.
- **Action**: Add xAI configuration card.

### 6.2 Extension UI (Model Selector)
- **File**: `apps/extension/src/components/features/chat/components/composer/ModelSelectorPopover.tsx`
- **Action**:
    - Add xAI section.
    - List supported models:
        - `grok-2-1212` (Latest Grok 2)
        - `grok-2-vision-1212` (Vision capable)
        - `grok-beta`
        - `grok-3` (if available/preview)

### 6.3 I18n & Display Names
- **File**: `apps/webapp/src/lib/providers/display-names.ts`
- **Action**: Add labels for xAI.

## Phase 7: Verification Checklist
- [ ] **Dependency**: `@ai-sdk/xai` installed.
- [ ] **Credentials**: API Key saves/retrieves correctly.
- [ ] **Chat**: Can chat with `grok-2` using text.
- [ ] **Vision**: Can send an image in Chat/Writer and get a description (Base64 flow).
- [ ] **Tools**: Can use browser actions (client-side function calling).
- [ ] **Memory**: `withSupermemory` wrapping works (can save/recall info).
- [ ] **Writer**: Can generating text with xAI.
- [ ] **Rewriter**: Can rewrite text with xAI.
