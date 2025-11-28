/**
 * Hooks Barrel Export
 *
 * All hooks organized by domain. Import from this file for cleaner imports.
 *
 * @example
 * import { useApiKey, useOnboarding, useTabContext } from '@/hooks';
 */

// Browser/Tab hooks
export * from './browser';

// Attachment hooks
export * from './attachments';

// Chat hooks
export * from './chat';

// Settings hooks
export * from './settings';

// Sidepanel hooks
export * from './sidepanel';

// Suggestions hooks
export * from './suggestions';

// UI hooks
export * from './ui';

// Workflows hooks
export * from './workflows';

// Search hooks
export { useSearchMode } from './useSearchMode';
export type { UseSearchModeResult } from './useSearchMode';
export { useSearchModeWithAI } from './useSearchModeWithAI';
export type { UseSearchModeWithAIResult } from './useSearchModeWithAI';
