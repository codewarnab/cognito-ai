/**
 * ChatMessages Module - Re-export
 * 
 * This file now re-exports from the refactored ChatMessages folder.
 * The component has been split into smaller, maintainable pieces.
 * 
 * @see ./ChatMessages/ for the refactored implementation
 * 
 * Structure:
 * ChatMessages/
 * ├── index.ts             - Main exports
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
 */

export { ChatMessages } from './ChatMessages/index';
export type { ChatMessagesProps } from './ChatMessages/types';
