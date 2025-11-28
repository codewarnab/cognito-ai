/**
 * Ask Attachment Utilities
 * File validation and processing specific to the ask command overlay
 */

import { ASK_SUPPORTED_MIME_TYPES, ASK_FILE_LIMITS } from '@/types';

export interface AttachmentValidation {
    valid: boolean;
    error?: string;
}

/**
 * Image compression options
 */
interface CompressionOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
}

type ImageMimeType = (typeof ASK_SUPPORTED_MIME_TYPES.images)[number];
type DocumentMimeType = (typeof ASK_SUPPORTED_MIME_TYPES.documents)[number];

/**
 * Check if MIME type is a supported image
 */
function isImageMimeType(mimeType: string): mimeType is ImageMimeType {
    return ASK_SUPPORTED_MIME_TYPES.images.includes(mimeType as ImageMimeType);
}

/**
 * Check if MIME type is a supported document
 */
function isDocumentMimeType(mimeType: string): mimeType is DocumentMimeType {
    return ASK_SUPPORTED_MIME_TYPES.documents.includes(mimeType as DocumentMimeType);
}

/**
 * Validate file for ask attachment
 */
export function validateAskAttachment(file: File): AttachmentValidation {
    const isImage = isImageMimeType(file.type);
    const isDocument = isDocumentMimeType(file.type);

    if (!isImage && !isDocument) {
        return {
            valid: false,
            error: 'Unsupported file type. Use: PNG, JPEG, WebP, HEIC, HEIF, or PDF',
        };
    }

    const maxSize = isImage ? ASK_FILE_LIMITS.image : ASK_FILE_LIMITS.document;
    if (file.size > maxSize) {
        const maxMB = Math.floor(maxSize / 1024 / 1024);
        return {
            valid: false,
            error: `File too large. Max ${maxMB}MB for ${isImage ? 'images' : 'documents'}`,
        };
    }

    return { valid: true };
}

/**
 * Convert file to base64
 */
export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Extract base64 portion (remove data URL prefix)
            const base64 = result.split(',')[1] || result;
            resolve(base64);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * Create image preview URL (data URL)
 */
export function createPreview(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to create preview'));
        reader.readAsDataURL(file);
    });
}

/**
 * Determine attachment type from MIME
 */
export function getAttachmentType(mimeType: string): 'image' | 'document' {
    return isImageMimeType(mimeType) ? 'image' : 'document';
}

/**
 * Get accepted file types string for input element
 */
export function getAcceptedFileTypes(): string {
    return [
        ...ASK_SUPPORTED_MIME_TYPES.images,
        ...ASK_SUPPORTED_MIME_TYPES.documents,
    ].join(',');
}

/**
 * Compress image to reduce file size before encoding
 */
export async function compressImage(
    file: File,
    options: CompressionOptions = {}
): Promise<Blob> {
    const { maxWidth = 1920, maxHeight = 1920, quality = 0.85 } = options;

    if (!isImageMimeType(file.type)) {
        return file;
    }

    if (file.size < 500 * 1024) {
        return file;
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);

            let { width, height } = img;

            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.floor(width * ratio);
                height = Math.floor(height * ratio);
            } else {
                resolve(file);
                return;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Image compression failed'));
                    }
                },
                'image/jpeg',
                quality
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Failed to load image for compression'));
        };

        img.src = objectUrl;
    });
}

/**
 * Check if image should be compressed based on size
 */
export function shouldCompressImage(file: File): boolean {
    return isImageMimeType(file.type) && file.size > 2 * 1024 * 1024;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
