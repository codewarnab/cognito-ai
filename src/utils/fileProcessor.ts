/**
 * File processing utilities for chat attachments
 */

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const ALLOWED_TYPES = {
    // Images
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
    'image/svg+xml': ['.svg'],
    'image/bmp': ['.bmp'],
    
    // Documents
    'application/pdf': ['.pdf'],
    'text/plain': ['.txt'],
    'text/markdown': ['.md'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'text/csv': ['.csv'],
};

export interface ProcessedFile {
    name: string;
    size: number;
    type: string;
    content: string; 
    mimeType: string;
    isImage: boolean;
}

/**
 * Validate file type and size
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        return {
            valid: false,
            error: `File size exceeds 20MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`,
        };
    }

    // Check file type
    const isAllowed = Object.keys(ALLOWED_TYPES).includes(file.type) ||
        Object.values(ALLOWED_TYPES).flat().some(ext => file.name.toLowerCase().endsWith(ext));

    if (!isAllowed) {
        return {
            valid: false,
            error: `File type not supported: ${file.type || 'unknown'}`,
        };
    }

    return { valid: true };
}

/**
 * Check if file is an image
 */
export function isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
}

/**
 * Convert file to base64
 */
export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Remove data URL prefix (e.g., "data:image/png;base64,")
            const base64 = result.split(',')[1] || result;
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Create image preview URL
 */
export function createImagePreview(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Process file for AI consumption
 */
export async function processFile(file: File): Promise<ProcessedFile> {
    const validation = validateFile(file);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    const content = await fileToBase64(file);
    const isImage = isImageFile(file);

    return {
        name: file.name,
        size: file.size,
        type: file.type,
        content,
        mimeType: file.type,
        isImage,
    };
}

/**
 * Extract text content from common document types
 * For now, returns base64 - backend will handle extraction
 */
export async function extractTextContent(file: File): Promise<string> {
    // For text files, we can read directly
    if (file.type === 'text/plain' || file.type === 'text/markdown' || file.type === 'text/csv') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    // For other types, return base64 and let backend handle
    return fileToBase64(file);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

/**
 * Get file icon emoji based on type
 */
export function getFileIcon(mimeType: string, fileName: string): string {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType === 'application/pdf') return '📕';
    if (mimeType.includes('word') || fileName.endsWith('.doc') || fileName.endsWith('.docx')) return '📘';
    if (mimeType.includes('excel') || fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) return '📊';
    if (mimeType === 'text/csv') return '📊';
    if (mimeType === 'text/markdown') return '📝';
    return '📄';
}
