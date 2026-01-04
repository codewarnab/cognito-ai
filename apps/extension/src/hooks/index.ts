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

// Code Mode hooks
export * from './cliMode';

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

// export { useSearchModeWithAI ,UseSearchModeWithAIResult  } from './useSearchModeWithAI';

// WebMCP hooks
export * from './webmcp';

// Provider capabilities hooks - Import directly from './useProviderCapabilities' to avoid auto-import duplication
// export { useProviderCapabilities, useCapability, getCapabilityUnavailableReason } from './useProviderCapabilities';
