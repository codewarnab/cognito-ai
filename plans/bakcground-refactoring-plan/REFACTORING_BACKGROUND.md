# Refactoring Plan: `src/background.ts`

## 1. Analysis

The main service worker entry point, `src/background.ts`, has become a monolithic script responsible for too many disconnected concerns. This makes it difficult to maintain, debug, and test. A deep analysis reveals the following distinct functional domains, all currently mixed within the single file:

-   **MCP Core Logic:** Connection management, enabling/disabling servers, and handling the `McpSSEClient` lifecycle.
-   **MCP Authentication:** The entire OAuth 2.0 flow, token management (refresh, expiry), and credential storage.
-   **MCP Tool Management:** Health checks, tool discovery, aggregation from multiple servers, and execution (`callTool`).
-   **Extension Lifecycle:** Handling `onInstalled` and `onStartup` events and orchestrating the initial setup of all servers.
-   **Central Message Routing:** A single, massive `chrome.runtime.onMessage` listener that acts as a router for dozens of different message types from the side panel, content scripts, and popups.
-   **UI Event Handling:** Logic for `chrome.notifications`, `chrome.omnibox`, and `chrome.action` events.
-   **Alarm Management:** A `chrome.alarms.onAlarm` listener that handles token refreshes, cache cleanup, and user-set reminders.
-   **File System Access:** Logic for reading local PDF files requested by the UI.

## 2. Refactoring Goal

The primary goal is to **separate these concerns** into distinct, single-responsibility modules. The main `background.ts` file will be transformed into a lean **orchestrator** whose only job is to import these modules and initialize their respective listeners and services.

This will improve:
-   **Maintainability:** Easier to find and modify specific logic.
-   **Readability:** Code is organized by feature, not execution order.
-   **Testability:** Individual modules can be unit-tested in isolation.
-   **Scalability:** Adding new features will involve creating new modules rather than expanding the central file.

## 3. Proposed File Structure

We will create a `src/background/` directory to house all the new modules. The existing files in that directory will be integrated into this new structure.

```
src/
├── background.ts                 # The new, lean orchestrator
└── background/
    ├── alarms.ts                 # Handles all chrome.alarms events
    ├── initializer.ts            # Handles server initialization on startup
    ├── keepAlive.ts              # (Existing) Manages the service worker keep-alive
    ├── lifecycle.ts              # Handles onInstalled and onStartup events
    ├── notifications.ts          # Handles all chrome.notifications events
    ├── omnibox.ts                # Handles all chrome.omnibox events
    ├── sidepanelUtils.ts         # (Existing) Side panel utility functions
    ├── mcp/
    │   ├── auth.ts               # OAuth flow, token management, disconnection
    │   ├── manager.ts            # Connection, enabling/disabling servers
    │   └── tools.ts              # Tool listing, health checks, execution
    └── messaging/
        ├── router.ts             # The main onMessage listener and message router
        ├── mcpHandler.ts         # Handles all messages prefixed with "mcp/"
        ├── fileHandler.ts        # Handles local file reading messages
        └── uiHandler.ts          # Handles UI messages like "OPEN_SIDEBAR"
```

## 4. Migration Steps

### Step 1: Create Core Logic Modules
-   **`src/background/mcp/auth.ts`**
    -   Move `startOAuthFlow`.
    -   Move `disconnectServerAuth`.
    -   Move `handleTokenExpiry` and `handleInvalidToken`.
    -   All related imports (`generateState`, `buildAuthUrl`, `exchangeCodeForTokens`, etc.) move here.
-   **`src/background/mcp/manager.ts`**
    -   Move `connectMcpServer`.
    -   Move `disconnectMcpServer`.
    -   Move `enableMcpServer` and `disableMcpServer`.
-   **`src/background/mcp/tools.ts`**
    -   Move `performHealthCheck`.
    -   Move `getAllMCPTools`.
    -   Move `getServerTools` and `callServerTool`.
    -   Move `getMCPServerConfigs`.

### Step 2: Create Event Listener Modules
-   **`src/background/lifecycle.ts`**
    -   Create an `initializeLifecycleEventListeners` function.
    -   Move the `chrome.runtime.onInstalled` and `chrome.runtime.onStartup` listeners into this function.
-   **`src/background/alarms.ts`**
    -   Create an `initializeAlarmListeners` function.
    -   Move the `chrome.alarms.onAlarm` listener into this function.
-   **`src/background/notifications.ts`**
    -   Create an `initializeNotificationListeners` function.
    -   Move the `chrome.notifications.onClicked` and `chrome.notifications.onButtonClicked` listeners into this function.
-   **`src/background/omnibox.ts`**
    -   Create an `initializeOmnibox` function.
    -   Move all `chrome.omnibox` listeners and the `lastFocusedWindowId` tracking logic here.

### Step 3: Refactor the Message Handler
-   **`src/background/messaging/mcpHandler.ts`**
    -   Create a function `handleMcpMessage(message, sender, sendResponse)`.
    -   Move the `switch` statement that handles actions like `auth/start`, `enable`, `tool/call`, etc., into this function. It will call the newly created functions in the `src/background/mcp/` modules.
-   **`src/background/messaging/fileHandler.ts`**
    -   Create a function `handleFileMessage(message, sender, sendResponse)`.
    -   Move the logic for `READ_LOCAL_PDF` here.
-   **`src/background/messaging/uiHandler.ts`**
    -   Create a function `handleUiMessage(message, sender, sendResponse)`.
    -   Move the logic for `OPEN_SIDEBAR` and other UI-related messages here.
-   **`src/background/messaging/router.ts`**
    -   Create an `initializeMessageRouter` function.
    -   This function will contain the main `chrome.runtime.onMessage.addListener`.
    -   The listener's implementation will be a clean routing block that delegates to the specialized handlers:
        ```typescript
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type?.startsWith('mcp/')) {
                handleMcpMessage(message, sender, sendResponse);
            } else if (message.type === 'READ_LOCAL_PDF') {
                handleFileMessage(message, sender, sendResponse);
            } else if (message.action === 'OPEN_SIDEBAR') {
                handleUiMessage(message, sender, sendResponse);
            }
            // ... other routes
            return true; // Keep message port open for async responses
        });
        ```

### Step 4: Create the New `background.ts` Orchestrator

The final `src/background.ts` will be very concise. Its sole purpose is to initialize all the modules.

```typescript
// src/background.ts

import './polyfills/process';
import { initializeLifecycleEventListeners } from './background/lifecycle';
import { initializeMessageRouter } from './background/messaging/router';
import { initializeAlarmListeners } from './background/alarms';
import { initializeNotificationListeners } from './background/notifications';
import { initializeOmnibox } from './background/omnibox';
import { initializeOAuthRedirectURI } from './background/mcp/auth'; // Example of a direct init call
import { createLogger } from '~logger';

const log = createLogger('Background-Orchestrator', 'BACKGROUND');

log.info('Service Worker loading...');

// Initialize core components
initializeOAuthRedirectURI();

// Initialize all event listeners
initializeLifecycleEventListeners();
initializeMessageRouter();
initializeAlarmListeners();
initializeNotificationListeners();
initializeOmnibox();

// Initialize action click handler
if (chrome.action) {
    chrome.action.onClicked.addListener(async (tab) => {
        // This simple handler can stay here or be moved to a dedicated 'action.ts'
        if (chrome.sidePanel && tab.id) {
            // Logic to open side panel
        }
    });
}

log.info('Service Worker initialized and all listeners are active.');

```
