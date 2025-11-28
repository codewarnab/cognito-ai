/**
 * Ask Attachment Hook
 * Manages single file attachment for the ask command overlay
 */

import { useState, useCallback, useRef } from 'react';
import type { AskAttachment, AskAttachmentPayload } from '@/types';
import {
    validateAskAttachment,
    fileToBase64,
    createPreview,
    getAttachmentType,
    compressImage,
    shouldCompressImage,
} from './askAttachmentUtils';

interface UseAskAttachmentOptions {
    onError?: (message: string) => void;
}

interface UseAskAttachmentReturn {
    attachment: AskAttachment | null;
    isProcessing: boolean;
    fileInputRef: React.RefObject<HTMLInputElement>;
    processFile: (file: File) => Promise<boolean>;
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    handleFileDrop: (e: React.DragEvent) => Promise<void>;
    handlePaste: (e: ClipboardEvent) => Promise<void>;
    clearAttachment: () => void;
    openFilePicker: () => void;
    getAttachmentForApi: () => AskAttachmentPayload | undefined;
}

export function useAskAttachment({
    onError,
}: UseAskAttachmentOptions = {}): UseAskAttachmentReturn {
    const [attachment, setAttachment] = useState<AskAttachment | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    /**
     * Process and set a file as attachment
     * Automatically compresses large images to reduce API payload size
     */
    const processFile = useCallback(
        async (file: File): Promise<boolean> => {
            const validation = validateAskAttachment(file);
            if (!validation.valid) {
                onError?.(validation.error || 'Invalid file');
                return false;
            }

            setIsProcessing(true);

            try {
                const type = getAttachmentType(file.type);

                let processedFile: File | Blob = file;
                let mimeType = file.type;

                if (shouldCompressImage(file)) {
                    try {
                        processedFile = await compressImage(file);
                        mimeType = 'image/jpeg';
                    } catch {
                        processedFile = file;
                    }
                }

                const base64Data = await fileToBase64(
                    processedFile instanceof File
                        ? processedFile
                        : new File([processedFile], file.name, { type: mimeType })
                );

                let preview: string | undefined;
                if (type === 'image') {
                    preview = await createPreview(file);
                }

                const newAttachment: AskAttachment = {
                    id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
                    file,
                    preview,
                    type,
                    base64Data,
                    mimeType,
                };

                setAttachment(newAttachment);
                return true;
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to process file';
                onError?.(message);
                return false;
            } finally {
                setIsProcessing(false);
            }
        },
        [onError]
    );

    /**
     * Handle file input change
     */
    const handleFileChange = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) {
                await processFile(file);
            }
            e.target.value = '';
        },
        [processFile]
    );

    /**
     * Handle file drop
     */
    const handleFileDrop = useCallback(
        async (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const file = e.dataTransfer.files?.[0];
            if (file) {
                await processFile(file);
            }
        },
        [processFile]
    );

    /**
     * Handle paste event
     */
    const handlePaste = useCallback(
        async (e: ClipboardEvent) => {
            const file = e.clipboardData?.files?.[0];
            if (file) {
                e.preventDefault();
                await processFile(file);
            }
        },
        [processFile]
    );

    /**
     * Clear attachment
     */
    const clearAttachment = useCallback(() => {
        setAttachment(null);
    }, []);

    /**
     * Open file picker
     */
    const openFilePicker = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    /**
     * Get attachment data for API (serializable)
     */
    const getAttachmentForApi = useCallback((): AskAttachmentPayload | undefined => {
        if (!attachment?.base64Data) return undefined;

        return {
            base64Data: attachment.base64Data,
            mimeType: attachment.mimeType,
            fileName: attachment.file.name,
            fileSize: attachment.file.size,
        };
    }, [attachment]);

    return {
        attachment,
        isProcessing,
        fileInputRef,
        processFile,
        handleFileChange,
        handleFileDrop,
        handlePaste,
        clearAttachment,
        openFilePicker,
        getAttachmentForApi,
    };
}
