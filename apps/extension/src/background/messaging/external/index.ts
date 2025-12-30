/**
 * External Messaging Module
 *
 * Handles messages from external sources (webapp, content scripts) to the extension.
 * Provides a modular handler architecture for processing various operations.
 *
 * @module external
 *
 * Structure:
 * - router.ts: Main message routing logic
 * - handlers/: Individual message type handlers
 *   - lifecycleHandler.ts: PING, OPEN_SIDEPANEL
 *   - onboardingHandler.ts: Onboarding status
 *   - remindersHandler.ts: Reminder CRUD operations
 *   - providersHandler.ts: AI provider configuration
 *   - dataOperationsHandler.ts: Chat deletion, voice preview
 *   - loggerHandler.ts: Logger config sync
 *   - storesHandler.ts: Dev tools store inspection
 *   - settings/: Settings-related handlers
 *     - searchSettingsHandler.ts
 *     - askAISettingsHandler.ts
 *     - textSettingsHandler.ts
 *     - supermemorySettingsHandler.ts
 *     - researchSettingsHandler.ts
 *     - voiceSettingsHandler.ts
 *     - aiConfigHandler.ts
 * - types.ts: Type definitions
 * - utils.ts: Shared utilities
 */

export { initializeExternalMessageRouter, routeExternalMessage } from './router';
export { RemindersBroadcaster } from './remindersBroadcaster';
export * from './types';
export * from './utils';
