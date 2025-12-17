/**
 * Chat Hooks
 *
 * Hooks for chat and messaging functionality including:
 * - AI message persistence and title generation
 * - Chat input validation
 * - Message sending with attachments
 *
 * Note: Thread management has been migrated to useChatStore (Phase 2).
 *
 * @example
 * import { useAIChatMessages, useMessageHandlers } from '@/hooks/chat';
 * import { useChatStore } from '@/stores';
 */

export { useAIChatMessages } from './useAIChatMessages';
export { useChatInputValidation } from './useChatInputValidation';
export { useMessageHandlers } from './useMessageHandlers';
export { useMessageTextSelection } from './useMessageTextSelection';

// DEPRECATED: Thread management is now handled by useChatStore
// This export is kept for backward compatibility but should not be used in new code
// export { useThreadManagement } from './useThreadManagement';
