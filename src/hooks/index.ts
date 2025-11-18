/**
 * Sidepanel Custom Hooks
 * 
 * Barrel export for all sidepanel-related custom hooks.
 * Import from this file for cleaner imports.
 * 
 * @example
 * import { useApiKey, useOnboarding } from './hooks';
 */

export { useApiKey } from './useApiKey';
export { useOnboarding } from './useOnboarding';
export { useTabContext } from './useTabContext';
export { useVoiceRecording } from './useVoiceRecording';
export { useThreadManagement } from './useThreadManagement';
export { useMessageHandlers } from './useMessageHandlers';
export { useBehavioralPreferences } from './useBehavioralPreferences';
export { useAIChatMessages } from './useAIChatMessages';
export { useActiveTabDetection } from './useActiveTabDetection';
export type { LocalPdfInfo, ActiveTabDetection } from './useActiveTabDetection';
export { useFileAttachments } from './useFileAttachments';
export { useLocalPdfAttachment } from './useLocalPdfAttachment';
export { useWorkflowMode } from './useWorkflowMode';
export { useChatInputValidation } from './useChatInputValidation';
