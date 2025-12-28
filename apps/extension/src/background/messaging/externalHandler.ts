/**
 * External Message Handler
 *
 * This file re-exports from the modular external/ directory.
 * The actual handler logic has been split into focused modules for better
 * maintainability and code organization.
 *
 * @see ./external/index.ts for the main module
 * @see ./external/handlers/ for individual message handlers
 *
 * Directory structure:
 * external/
 * ├── router.ts              - Main message routing logic
 * ├── types.ts               - Type definitions
 * ├── utils.ts               - Shared utilities
 * ├── index.ts               - Module barrel file
 * └── handlers/
 *     ├── index.ts           - Handlers barrel file
 *     ├── lifecycleHandler.ts
 *     ├── onboardingHandler.ts
 *     ├── remindersHandler.ts
 *     ├── providersHandler.ts
 *     ├── dataOperationsHandler.ts
 *     ├── loggerHandler.ts
 *     ├── storesHandler.ts
 *     └── settings/
 *         ├── index.ts
 *         ├── searchSettingsHandler.ts
 *         ├── askAISettingsHandler.ts
 *         ├── textSettingsHandler.ts
 *         ├── supermemorySettingsHandler.ts
 *         ├── researchSettingsHandler.ts
 *         ├── voiceSettingsHandler.ts
 *         └── aiConfigHandler.ts
 */

export { initializeExternalMessageRouter } from './external';
