// Main components
export { Composer } from './Composer';
export type { ComposerProps } from './Composer';
export { ChatInput } from './ChatInput';

// Context
export { ComposerProvider, useComposer } from './ComposerContext';
export type { ComposerContextValue } from './ComposerContext';

// Hooks
export { useToolsCount, useVoiceFabVisibility, useScreenshotCapture } from './hooks';

// Sections (for advanced usage/customization)
export {
    DragOverlay,
    SuggestionsArea,
    WorkflowSection,
    AttachmentsArea,
    ComposerInput,
    ComposerToolbar,
    ComposerActions
} from './sections';

// Re-export ModelSelectorPopover for convenience
export { ModelSelectorPopover } from './ModelSelectorPopover';
