# Technical Documentation

## 1. System Overview

### Architecture Diagram
```
┌───────────────────────────────────────────────────────────────┐
│ Chrome Extension (MV3)                                        │
│                                                               │
│  ┌───────────────┐   messages/events   ┌───────────────────┐  │
│  │ Content Script│ ───────────────────▶ │ Background (SW)  │  │
│  │ Ask AI Button │                     │ chrome.* + MCP    │  │
│  └───────────────┘                     └───────────────────┘  │
│           │                                     │             │
│           │ sidePanel open                      │ omnibox,    │
│           ▼                                     │ alarms,     │
│  ┌──────────────────────┐  AI SDK stream/tool   │ messages    │
│  │ Side Panel (React)   │ ◀─────────────────────┘             │
│  │ Chat UI, Settings    │                                     │
│  └──────────────────────┘                                     │
│           │                                     │             │
│           │ local summarizer via offscreen      │             │
│           ▼                                     │             │
│  ┌──────────────────────┐                       │             │
│  │ Offscreen Document   │ <──────────┐          │             │
│  │ Summarizer API host  │            │          │             │
│  └──────────────────────┘            │          │             │
└──────────────────────────────────────┼──────────┼─────────────┘
                                       │          │
                               remote model        │
                                       ▼          │
                            ┌─────────────────┐    │
                            │ Google Gemini   │    │
                            │ (Remote)        │    │
                            └─────────────────┘    │
                                       │          │
                                       ▼          │
                            ┌─────────────────┐    │
                            │ MCP Servers     │◀───┘
                            │ (OAuth + SSE)   │
                            └─────────────────┘
```


### Component Relationships
- Background service worker: omnibox, side panel opening, content script messaging, notifications, MCP OAuth/SSE (`src/background.ts:1704`, `src/background.ts:1114`).
- Side panel: React chat UI, workflows, tool orchestration; AI SDK streaming and error handling (`src/sidepanel.tsx:145`, `src/ai/core/aiLogic.ts:422`).
- Offscreen document: hosts Chrome Summarizer API; returns summaries and progress (`public/offscreen.js:15`, `public/offscreen.js:44`).
- Model setup: local `builtInAI` (Gemini Nano) vs remote Google Gemini (`src/ai/core/modelSetup.ts:52`, `src/ai/core/modelSetup.ts:112`).
- Model download progress: broadcasts to UI (`src/utils/modelDownloadBroadcast.ts:1`, `src/ai/models/downloader.ts:227`).
- Browser tools: tabs, search, history, content extraction, memory, reminders (e.g., tab grouping) (`src/actions/tabs/organizeTabsByContext.tsx:45`).
- Provider setup / API key: BYOK dialog and storage integration (`src/components/shared/dialogs/GeminiApiKeyDialog.tsx:115`, `src/hooks/useApiKey.ts:1`).
- MCP server catalog: static configs and enablement (`src/constants/mcpServers.tsx:261`, `src/mcp/state.ts:62`).

### Technology Stack
- TypeScript, React, Plasmo MV3 (`package.json:1`, `package.json:42`).
- AI SDK (`ai` v5), `@ai-sdk/google`, `@google/genai`, local `@built-in-ai/core` (`package.json:33`, `src/ai/core/modelSetup.ts:6`).
- Storage: `@plasmohq/storage`, IndexedDB/Dexie (`src/memory/store.ts:12`).
- UI: Radix UI, framer-motion, lucide-react (`package.json:27`, `package.json:37`, `package.json:40`).
- Chrome APIs: `sidePanel`, `tabs`, `tabGroups`, `alarms`, `history`, `notifications`, `omnibox`, `offscreen` (`package.json:84`, `build/chrome-mv3-prod/manifest.json:1`).
- MCP: `@modelcontextprotocol/sdk` (`package.json:23`).

## 2. Installation Guide

### Prerequisites and System Requirements
- Chrome with MV3 and permissions for `sidePanel`, `omnibox`, `offscreen` (`build/chrome-mv3-prod/manifest.json:1`).
- Node.js 18+ and `pnpm` (`CONTRIBUTING.md:102`).
- Remote model mode requires Gemini API key (Google AI Studio).
- Local model (Gemini Nano) requires:
  - Enable `chrome://flags/#prompt-api-for-gemini-nano`.
  - Enable `chrome://flags/#optimization-guide-on-device-model`.
  - Download Optimization Guide model via `chrome://components/`.
  - Ensure sufficient free disk space (≈20 GB) (`src/components/data/troubleshootingData.ts:168`).

### Step-by-Step Setup
- Install dependencies: `pnpm install`.
- Development: `pnpm dev`; first-time offscreen assets: `pnpm dev:setup` (`scripts/copy-offscreen.js:18`).
- Production build: `pnpm build` (copies offscreen assets) (`package.json:10`).
- Load unpacked: `chrome://extensions` → Enable Developer Mode → Load `build/chrome-mv3-prod`.
- Side panel shortcut: `Ctrl+Shift+H` / `Command+Shift+H` (`build/chrome-mv3-prod/manifest.json:1`).

### Configuration Options
- Gemini API Key (BYOK remote mode): side panel `⋯` → "Gemini API Key Setup" (`src/components/shared/dialogs/GeminiApiKeyDialog.tsx:115`).
- Local model: ensure flags/components; download progress events handled (`src/ai/models/downloader.ts:227`).
- MCP servers: enable/connect in MCP Manager; OAuth/SSE handled in background (`src/background.ts:1`, `src/mcp/transportDetector.ts:64`).
- Enabled tools: toggle categories/individual tools in Settings (`src/components/features/settings/components/EnabledToolsSettings.tsx:1`).
- Ask AI button visibility: global/session/domain control (`src/components/features/settings/components/AskAiButtonSettings.tsx:1`, `src/utils/ask-ai-button-visibility.ts:1`).
- Voice settings: select and preview voices (requires API key) (`src/components/features/settings/components/VoiceSettings.tsx:1`).
- Omnibox keyword: `ai` opens side panel and forwards text (`src/background.ts:1706`).

## 4. Usage Examples

### Common Use Cases
- General chat: "Explain TypeScript generics simply" → streaming response; context warnings when near limits (`src/sidepanel.tsx:231`).
- Research workflow: "Research Rust error handling best practices" → multi-source browsing, extraction, synthesis, optional PDF (`src/workflows/definitions/researchWorkflow.ts:40`, `src/workflows/definitions/researchWorkflow.ts:84`).
- YouTube analysis: "Summarize this video" on a video page → key takeaways and timestamps (`src/ai/agents/browser/prompts.ts:826`).
- Organize tabs: "Organize my open tabs by topic" → Tab Groups labeled by topic (`src/actions/tabs/organizeTabsByContext.tsx:45`).
- Memory operations: "Remember my coffee order…" then "What’s my coffee order?" (`src/memory/store.ts:44`).
- Reminders: "Remind me in 30 minutes…" → scheduled alarm and UI confirmation (`src/components/features/reminders/ReminderTimePicker.tsx:47`, `src/background.ts:1764`).
- Omnibox quick open: type `ai` + Enter → side panel opens with query (`src/background.ts:1706`).

### Expected Outputs
- Streaming text with status/error events (`src/ai/core/aiLogic.ts:422`).
- Actionable error toasts for 401/403/404/500; rate-limit handled silently (`src/utils/apiErrorHandler.ts:113`).
- Context warnings offer new thread creation (`src/sidepanel.tsx:231`).
- Local model/summarizer download progress events for UI (`src/ai/models/downloader.ts:227`, `src/utils/modelDownloadBroadcast.ts:1`).