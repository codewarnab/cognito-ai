/**
 * Write Command Module Exports
 * Re-exports all utilities for the /write slash command feature
 */

export { useWriteCommandDetection } from './useWriteCommandDetection';
export { useTextInsertion, type InsertResult } from './useTextInsertion';
export { WriterOverlay } from './WriterOverlay';
export { WritingAnimation } from './WritingAnimation';
export { WriteCommandErrorBoundary } from './ErrorBoundary';
export {
    detectPlatform,
    getPageContext,
    getPlatformInstructions,
    type PlatformInfo,
} from './platformDetector';
