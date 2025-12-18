# Codebase TODO Report

This report tracks all outstanding `TODO` items found in the codebase as of the latest scan.
**Last Verified:** 2025-12-19

## Summary

- **Total TODOs**: 17
- **Extension**: 14
- **Backend (Vercel)**: 3
- **Backend (Cloudflare)**: 0
- **Docs**: 0

## Apps: Extension (`apps/extension`)

### AI Core & Logic

**`src/ai/core/aiLogic.ts`**
- `Line 105`: Pass search mode settings (searchEnabled, searchDepth) when implementing search with backend
- `Line 106`: Pass initialPageContext for page-aware conversations
- `Line 107`: Pass workflowId for workflow-specific behavior on backend
- `Line 108`: Handle adaptive mode dynamic tool discovery on backend

**`src/ai/core/modelFactory.ts`**
- `Line 22`: (@ui) when we add more than a couple of providers, update ProviderSetup to use a searchable combo-box instead of simple radio buttons so the selection stays manageable.

**`src/ai/backend/backendChatWithTools.ts`**
- `Line 48`: Add search mode support - pass searchEnabled and searchDepth to backend
- `Line 49`: Add page context support - pass initialPageContext to backend
- `Line 50`: Add workflow support - pass workflowId for workflow-specific prompts
- `Line 237`: Add searchEnabled, searchDepth for search mode
- `Line 238`: Add pageContext for initial page context

### UI Components

**`src/components/features/help/ProviderSetup.tsx`**
- `Line 19`: (@ui) when we add more than a couple of providers, update ProviderSetup to use a searchable combo-box instead of simple radio buttons so the selection stays manageable.

**`src/components/features/settings/components/VoiceSettings.tsx`**
- `Line 50`: Show user-facing error notification

**`src/entrypoints/options/main.tsx`**
- `Line 17`: Add actual settings UI here in future phases

### Types

**`src/types/workflows/index.ts`**
- `Line 5`: Define workflow-specific types when implementing workflow features

---

## Packages: Backend Vercel (`packages/backend-vercel`)

### Routes

**`src/routes/ai.ts`**
- `Line 249`: Add search mode support - append search instructions when searchEnabled is true
- `Line 250`: Add page context support - include initialPageContext in system prompt
- `Line 251`: Add workflow support - use workflow-specific prompts when workflowId is provided
