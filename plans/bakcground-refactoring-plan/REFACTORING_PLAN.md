# Detailed Refactoring Plan: `src/background.ts`

This document provides a phased, detailed plan for refactoring the monolithic `src/background.ts` into a modular, maintainable structure.

## Phase 1: Setup and Scaffolding

**Goal:** Create the new directory structure and files for the refactoring.

1.  **Create `src/background/` directory.**
2.  **Create `src/background/mcp/` directory.**
3.  **Create `src/background/messaging/` directory.**
4.  **Create the following empty files:**
    -   `src/background/alarms.ts`
    -   `src/background/initializer.ts`
    -   `src/background/lifecycle.ts`
    -   `src/background/notifications.ts`
    -   `src/background/omnibox.ts`
    -   `src/background/mcp/auth.ts`
    -   `src/background/mcp/manager.ts`
    -   `src/background/mcp/tools.ts`
    -   `src/background/messaging/router.ts`
    -   `src/background/messaging/mcpHandler.ts`
    -   `src/background/messaging/fileHandler.ts`
    -   `src/background/messaging/uiHandler.ts`
5.  **Move existing files:**
    -   Move `src/background/keepAlive.ts` to `src/background/keepAlive.ts`.
    -   Move `src/background/sidepanelUtils.ts` to `src/background/sidepanelUtils.ts`.

## Phase 2: Migrate Core MCP Logic

**Goal:** Move all MCP-related logic from `background.ts` into the new `src/background/mcp/` modules.

1.  **`src/background/mcp/auth.ts`:**
    -   Move `startOAuthFlow`, `disconnectServerAuth`, `handleTokenExpiry`, and `handleInvalidToken` from `background.ts` to this file.
    -   Move all related helper functions and imports (e.g., `generateState`, `buildAuthUrl`, `exchangeCodeForTokens`).
2.  **`src/background/mcp/manager.ts`:**
    -   Move `connectMcpServer`, `disconnectMcpServer`, `enableMcpServer`, and `disableMcpServer` from `background.ts` to this file.
3.  **`src/background/mcp/tools.ts`:**
    -   Move `performHealthCheck`, `getAllMCPTools`, `getServerTools`, `callServerTool`, and `getMCPServerConfigs` from `background.ts` to this file.

## Phase 3: Migrate Event Listeners

**Goal:** Isolate all `chrome.*` event listeners into their own modules.

1.  **`src/background/lifecycle.ts`:**
    -   Create an `initializeLifecycleEventListeners` function.
    -   Move the `chrome.runtime.onInstalled` and `chrome.runtime.onStartup` listeners from `background.ts` into this function.
2.  **`src/background/alarms.ts`:**
    -   Create an `initializeAlarmListeners` function.
    -   Move the `chrome.alarms.onAlarm` listener from `background.ts` into this function.
3.  **`src/background/notifications.ts`:**
    -   Create an `initializeNotificationListeners` function.
    -   Move the `chrome.notifications.onClicked` and `chrome.notifications.onButtonClicked` listeners from `background.ts` into this function.
4.  **`src/background/omnibox.ts`:**
    -   Create an `initializeOmnibox` function.
    -   Move all `chrome.omnibox` listeners and related logic (e.g., `lastFocusedWindowId`) from `background.ts` to this file.

## Phase 4: Refactor the Message Handler

**Goal:** Replace the single `onMessage` listener with a modular routing system.

1.  **`src/background/messaging/mcpHandler.ts`:**
    -   Create a function `handleMcpMessage(message, sender, sendResponse)`.
    -   Move the `switch` statement that handles MCP actions (e.g., `auth/start`, `enable`, `tool/call`) from `background.ts` into this function. This function will call the new functions in the `src/background/mcp/` modules.
2.  **`src/background/messaging/fileHandler.ts`:**
    -   Create a function `handleFileMessage(message, sender, sendResponse)`.
    -   Move the logic for `READ_LOCAL_PDF` from `background.ts` to this file.
3.  **`src/background/messaging/uiHandler.ts`:**
    -   Create a function `handleUiMessage(message, sender, sendResponse)`.
    -   Move the logic for `OPEN_SIDEBAR` and other UI-related messages from `background.ts` to this file.
4.  **`src/background/messaging/router.ts`:**
    -   Create an `initializeMessageRouter` function.
    -   This function will contain the main `chrome.runtime.onMessage.addListener`.
    -   Implement a routing block that delegates messages to the specialized handlers (`handleMcpMessage`, `handleFileMessage`, `handleUiMessage`).

## Phase 5: Create the New `background.ts` Orchestrator

**Goal:** Rewrite `src/background.ts` to be a lean orchestrator that initializes all modules.

1.  **Clear out `src/background.ts`.**
2.  **Add imports for all the new `initialize...` functions from the `src/background/` modules.**
3.  **Call each `initialize...` function to set up the listeners and services.**
4.  **Keep the `chrome.action.onClicked` listener in `background.ts` for now, or move it to a new `src/background/action.ts` file.**

## Phase 6: Finalization and Cleanup

**Goal:** Ensure the refactoring is complete and the codebase is clean.

1.  **Review all changes for correctness and ensure all functionality is preserved.**
2.  **Run `pnpm type:check` to check for any TypeScript errors.**
3.  **Run the linter to ensure code style consistency.**
4.  **Delete any old, unused code from `background.ts` and other files.**
5.  **Add comments to the new orchestrator file (`background.ts`) to explain its purpose.**
