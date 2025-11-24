import { useState, useCallback } from 'react';
import { isPdfDismissed, dismissPdf } from '../utils/localPdfDismissals';
import type { LocalPdfInfo } from './useActiveTabDetection';
import type { AIMode } from '@components/features/chat/types';

interface UseLocalPdfAttachmentOptions {
    localPdfInfo?: LocalPdfInfo | null;
    mode: AIMode;
    onError?: (message: string, type?: 'error' | 'warning' | 'info') => void;
    processFiles: (files: File[]) => Promise<void>;
}

export const useLocalPdfAttachment = ({
    localPdfInfo,
    mode,
    onError,
    processFiles,
}: UseLocalPdfAttachmentOptions) => {
    const [isAttachingLocalPdf, setIsAttachingLocalPdf] = useState(false);
    const [dismissedPdfPath, setDismissedPdfPath] = useState<string | null>(null);

    // Handle attaching local PDF (Phase 4 - Integration Complete)
    const handleAttachLocalPdf = useCallback(async () => {
        if (!localPdfInfo) return;

        setIsAttachingLocalPdf(true);

        try {
            console.log('[useLocalPdfAttachment] Attempting to attach local PDF:', localPdfInfo.filename);

            // Send message to background script to read the file
            const response = await chrome.runtime.sendMessage({
                type: 'READ_LOCAL_PDF',
                payload: {
                    filePath: localPdfInfo.filePath
                }
            });

            if (!response.success) {
                // Handle specific error cases
                if (response.needsPermission) {
                    // Show permission guide
                    const { FileAccessError } = await import('../errors');
                    const helpText = FileAccessError.getPermissionHelpText();
                    onError?.(
                        `${response.error}\n\n${helpText}`,
                        'warning'
                    );
                } else {
                    // Generic error with fallback suggestion
                    onError?.(
                        `${response.error}\n\nYou can try manually uploading the PDF using the attachment button.`,
                        'error'
                    );
                }
                return;
            }

            // Successfully read the file - convert base64 to Blob
            // The background script sends base64 instead of ArrayBuffer because
            // ArrayBuffers don't serialize properly through Chrome messaging
            const { base64Data, filename, type } = response.data;

            // Decode base64 to binary string
            const binaryString = atob(base64Data);

            // Convert binary string to Uint8Array
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // Create Blob from bytes
            const blob = new Blob([bytes], { type: type || 'application/pdf' });

            // Create File object from Blob
            const file = new File([blob], filename, {
                type: type || 'application/pdf',
                lastModified: Date.now()
            });

            console.log('[useLocalPdfAttachment] Successfully created File object:', {
                name: file.name,
                size: file.size,
                type: file.type
            });

            // Use existing processFiles function to handle the attachment
            await processFiles([file]);

            // Auto-dismiss suggestion after successful attachment
            handleDismissLocalPdf();

            // Show success message
            onError?.(`Attached ${filename.length > 20 ? filename.substring(0, 20) + '...' : filename}`, 'info');

        } catch (error) {
            console.error('[useLocalPdfAttachment] Error attaching local PDF:', error);
            onError?.(
                'Failed to attach PDF. Please try manual upload using the attachment button.',
                'error'
            );
        } finally {
            setIsAttachingLocalPdf(false);
        }
    }, [localPdfInfo, onError, processFiles]);

    // Handle dismissing the local PDF suggestion
    const handleDismissLocalPdf = useCallback(() => {
        if (!localPdfInfo) return;

        // Mark as dismissed in localStorage
        dismissPdf(localPdfInfo.filePath);

        // Update local state to hide the badge immediately
        setDismissedPdfPath(localPdfInfo.filePath);
    }, [localPdfInfo]);

    // Check if we should show the local PDF suggestion
    const shouldShowLocalPdfSuggestion =
        localPdfInfo &&
        mode !== 'local' && // Don't show in local mode (attachments not supported)
        !isPdfDismissed(localPdfInfo.filePath) &&
        dismissedPdfPath !== localPdfInfo.filePath;

    return {
        isAttachingLocalPdf,
        shouldShowLocalPdfSuggestion,
        handleAttachLocalPdf,
        handleDismissLocalPdf,
    };
};
