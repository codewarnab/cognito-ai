import { useEffect } from 'react';

/**
 * Hook to manage voice FAB visibility based on composer state.
 * Hides the FAB when attachment dropdown is open or when there are attachments.
 */
export const useVoiceFabVisibility = (
    showAttachmentDropdown: boolean,
    attachmentsCount: number,
    tabAttachmentsCount: number
): void => {
    useEffect(() => {
        const voiceFab = document.querySelector('.voice-mode-fab') as HTMLElement;
        if (voiceFab) {
            // Hide FAB when:
            // - Attachment dropdown is open
            // - Any file attachments exist (including YouTube transcripts)
            // - Any tab attachments exist
            const shouldHide = showAttachmentDropdown || attachmentsCount > 0 || tabAttachmentsCount > 0;

            if (shouldHide) {
                voiceFab.style.visibility = 'hidden';
            } else {
                voiceFab.style.visibility = '';
            }
        }
    }, [showAttachmentDropdown, attachmentsCount, tabAttachmentsCount]);
};

