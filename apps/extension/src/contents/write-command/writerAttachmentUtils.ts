/**
 * Writer Attachment Utilities
 * File validation and processing specific to the writer overlay
 * 
 * Provider-specific file type support:
 * - Gemini/Vertex: Images (PNG, JPEG, WebP, HEIC, HEIF, GIF) + Documents (PDF, text/plain)
 * - OpenAI: Images (PNG, JPEG, WebP, GIF) + Documents (PDF only)
 * - Anthropic/Claude: Images (PNG, JPEG, WebP, GIF) + Documents (PDF only)
 */

import { WRITER_SUPPORTED_MIME_TYPES, WRITER_FILE_LIMITS, PROVIDER_SUPPORTED_MIME_TYPES } from '@/types';
import type { AIProvider } from '@cognito/shared';

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

type ImageMimeType = (typeof WRITER_SUPPORTED_MIME_TYPES.images)[number];
type DocumentMimeType = (typeof WRITER_SUPPORTED_MIME_TYPES.documents)[number];

/**
 * Check if MIME type is a supported image
 */
function isImageMimeType(mimeType: string): mimeType is ImageMimeType {
    return WRITER_SUPPORTED_MIME_TYPES.images.includes(mimeType as ImageMimeType);
}

/**
 * Check if MIME type is a supported document
 */
function isDocumentMimeType(mimeType: string): mimeType is DocumentMimeType {
    return WRITER_SUPPORTED_MIME_TYPES.documents.includes(mimeType as DocumentMimeType);
}

/**
 * Check if MIME type is supported for a specific provider
 * 
 * @param mimeType - The file's MIME type
 * @param provider - The AI provider ('google', 'vertex', 'openai', 'anthropic')
 * @returns Whether the MIME type is supported for the provider
 */
export function isMimeTypeSupportedForProvider(mimeType: string, provider: AIProvider): boolean {
    const providerConfig = PROVIDER_SUPPORTED_MIME_TYPES[provider as keyof typeof PROVIDER_SUPPORTED_MIME_TYPES];

    // Default to the full list if provider not found (fallback to Gemini behavior)
    if (!providerConfig) {
        return isImageMimeType(mimeType) || isDocumentMimeType(mimeType);
    }

    return (providerConfig.images as readonly string[]).includes(mimeType) ||
        (providerConfig.documents as readonly string[]).includes(mimeType);
}

/**
 * Validate file for writer attachment
 */
export function validateWriterAttachment(file: File): AttachmentValidation {
    const isImage = isImageMimeType(file.type);
    const isDocument = isDocumentMimeType(file.type);

    if (!isImage && !isDocument) {
        return {
            valid: false,
            error: 'Unsupported file type. Use: PNG, JPEG, WebP, HEIC, HEIF, GIF, or PDF',
        };
    }

    const maxSize = isImage ? WRITER_FILE_LIMITS.image : WRITER_FILE_LIMITS.document;
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
 * Validate file for writer attachment with provider-specific checks
 * 
 * @param file - The file to validate
 * @param provider - The AI provider (optional, defaults to Gemini-like full support)
 * @returns Validation result with error message if invalid
 */
export function validateWriterAttachmentForProvider(file: File, provider?: AIProvider): AttachmentValidation {
    const isImage = isImageMimeType(file.type);
    const isDocument = isDocumentMimeType(file.type);

    if (!isImage && !isDocument) {
        return {
            valid: false,
            error: 'Unsupported file type. Use: PNG, JPEG, WebP, HEIC, HEIF, GIF, or PDF',
        };
    }

    // Check provider-specific support
    if (provider && !isMimeTypeSupportedForProvider(file.type, provider)) {
        // Give provider-specific error message
        if (provider === 'openai' || provider === 'anthropic') {
            return {
                valid: false,
                error: `${provider === 'anthropic' ? 'Claude' : 'OpenAI'} only supports images (PNG, JPEG, WebP, GIF) and PDF files. Switch to Gemini for broader file support.`,
            };
        }
    }

    const maxSize = isImage ? WRITER_FILE_LIMITS.image : WRITER_FILE_LIMITS.document;
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
        ...WRITER_SUPPORTED_MIME_TYPES.images,
        ...WRITER_SUPPORTED_MIME_TYPES.documents,
    ].join(',');
}

/**
 * Get accepted file types string for a specific provider
 * 
 * @param provider - The AI provider (optional, defaults to full support)
 * @returns Comma-separated MIME types for the input accept attribute
 */
export function getAcceptedFileTypesForProvider(provider?: AIProvider): string {
    if (!provider) {
        return getAcceptedFileTypes();
    }

    const providerConfig = PROVIDER_SUPPORTED_MIME_TYPES[provider as keyof typeof PROVIDER_SUPPORTED_MIME_TYPES];

    if (!providerConfig) {
        return getAcceptedFileTypes();
    }

    return [
        ...providerConfig.images,
        ...providerConfig.documents,
    ].join(',');
}

/**
 * Compress image to reduce file size before encoding
 * Useful for large images that would exceed API limits
 * 
 * @param file - Original image file
 * @param options - Compression options
 * @returns Compressed image as Blob, or original file if compression fails/not needed
 */
export async function compressImage(
    file: File,
    options: CompressionOptions = {}
): Promise<Blob> {
    const { maxWidth = 1920, maxHeight = 1920, quality = 0.85 } = options;

    // Only compress actual images
    if (!isImageMimeType(file.type)) {
        return file;
    }

    // Skip compression for small files (under 500KB)
    if (file.size < 500 * 1024) {
        return file;
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);

            let { width, height } = img;

            // Calculate new dimensions maintaining aspect ratio
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.floor(width * ratio);
                height = Math.floor(height * ratio);
            } else {
                // Image is already small enough, return original
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

            // Convert to blob - use JPEG for better compression
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
    // Compress images larger than 2MB
    return isImageMimeType(file.type) && file.size > 2 * 1024 * 1024;
}
