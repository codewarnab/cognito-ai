/**
 * ChatMessages Module
 * 
 * This module provides the main chat message display component and related utilities.
 * The component has been refactored from a single large file into smaller, 
 * well-organized pieces for better maintainability.
 * 
 * Structure:
 * ├── ChatMessages.tsx     - Main component
 * ├── types.ts             - TypeScript interfaces
 * ├── components/          - Sub-components
 * │   ├── SafeMarkdown.tsx
 * │   ├── FileAttachment.tsx
 * │   ├── TabAttachment.tsx
 * │   ├── ImagePreviewModal.tsx
 * │   ├── MessagePartRenderer.tsx
 * │   └── MarkdownErrorBoundary.tsx
 * └── utils/               - Utility functions
 *     ├── mergeToolParts.ts
 *     ├── extractMessageText.ts
 *     └── processMessages.ts
 * 
 * Usage:
 * ```tsx
 * import { ChatMessages } from './ChatMessages';
 * 
 * <ChatMessages
 *   messages={messages}
 *   isLoading={isLoading}
 *   messagesEndRef={scrollRef}
 * />
 * ```
 */

// Main component export
export { ChatMessages } from './ChatMessages';

// Type exports for consumers
export type {
    ChatMessagesProps,
    ImagePreviewData,
    FileAttachmentProps,
    TabAttachmentProps,
    ImagePreviewModalProps,
    MessagePartRendererProps,
} from './types';

// Utility exports (for potential reuse)
export { mergeToolParts, extractMessageText, processMessages } from './utils';

// Sub-component exports (for potential reuse or testing)
export {
    SafeMarkdown,
    FileAttachment,
    TabAttachment,
    ImagePreviewModal,
    MessagePartRenderer,
    MarkdownErrorBoundary,
} from './components';
