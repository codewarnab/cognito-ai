// Re-export types and utilities
export * from './types';
export * from './utils';

// Components - Re-export all from organized subfolders
// Note: FileAttachment component is renamed to avoid collision with FileAttachment type
export {
    // Attachments
    AttachmentDropdown,
    FileAttachment as FileAttachmentComponent,
    type FileAttachmentData,
    TabAttachment,
    type TabAttachmentData,
    ToolFileAttachment,
    type ToolFileAttachmentData,
    // Badges
    WorkflowBadge,
    // Buttons
    ContinueButton,
    CopyButton,
    DownloadButton,
    VoiceButton,
    // Composer
    Composer,
    ChatInput,
    // Display
    ChatHeader,
    ChatMessages,
    InlineCode,
    // Feedback
    AnimatedCircularProgressBar,
    ErrorNotification,
    LoadingIndicator,
    ResearchProgress,
    // Modals
    AddTabsModal,
    ToolsModal,
    // States
    EmptyState,
    LocalBanner,
    // Suggestions
    LocalPdfSuggestion,
    SuggestedActions,
    YouTubeVideoSuggestion,
} from './components';

// Context components
export { ContextIndicator } from './context/ContextIndicator';
export { ContextWarning } from './context/ContextWarning';

// Dropdowns
export { ModeSelector } from './dropdowns/ModeSelector';
export { ModelDropdown } from './dropdowns/ModelDropdown';
export { SlashCommandDropdown } from './dropdowns/SlashCommandDropdown';
