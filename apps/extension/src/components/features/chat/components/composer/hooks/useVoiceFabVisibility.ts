import { useEffect } from 'react';

/**
 * Hook to manage voice FAB visibility based on composer state.
 * Hides the FAB when attachment dropdown is open or when there are attachments.
 */
export const useVoiceFabVisibility = (
    showAttachmentDropdown: boolean,
    attachmentsCount: number,
    tabAttachmentsCount: number,
    isModelSelectorOpen: boolean = false,
    isRecording: boolean = false
): void => {
    useEffect(() => {
        const voiceFab = document.querySelector('#voice-mode-fab') as HTMLElement;
        if (voiceFab) {
            // Hide FAB when:
            // - Attachment dropdown is open
            // - Any file attachments exist (including YouTube transcripts)
            // - Any tab attachments exist
            // - Model model selector is open
            // - Recording is in progress
            const shouldHide = showAttachmentDropdown || attachmentsCount > 0 || tabAttachmentsCount > 0 || isModelSelectorOpen || isRecording;

            if (shouldHide) {
                voiceFab.style.visibility = 'hidden';
            } else {
                voiceFab.style.visibility = '';
            }
        }
    }, [showAttachmentDropdown, attachmentsCount, tabAttachmentsCount, isModelSelectorOpen, isRecording]);
};

