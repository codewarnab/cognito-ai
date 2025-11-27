/**
 * Write Command Module Exports
 * Re-exports all utilities for the /write slash command feature
 */

export { useWriteCommandDetection } from './useWriteCommandDetection';
export { useTextInsertion, type InsertResult } from './useTextInsertion';
export { useWriterAttachment } from './useWriterAttachment';
export { WriterAttachmentPreview } from './WriterAttachmentPreview';
export { WriterOverlay } from './WriterOverlay';
export { WritingAnimation } from './WritingAnimation';
export { WriteCommandErrorBoundary } from './ErrorBoundary';
export {
    detectPlatform,
    getPageContext,
    getPlatformInstructions,
    type PlatformInfo,
} from './platformDetector';
export {
    validateWriterAttachment,
    fileToBase64,
    createPreview,
    getAttachmentType,
    getAcceptedFileTypes,
    type AttachmentValidation,
} from './writerAttachmentUtils';
