/**
 * File processing utilities for chat attachments
 */

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// Comprehensive list of allowed file extensions
export const ALLOWED_EXTENSIONS = [
    // Images
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".svg",
    ".bmp",
    ".ico",
    ".tif",
    ".tiff",
    ".heic",
    ".heif",
    ".avif",
    ".jfif",
    ".pjpeg",
    ".pjp",
    ".apng",

    // Documents & Text
    ".txt",
    ".md",
    ".markdown",
    ".mdown",
    ".html",
    ".htm",
    ".css",
    ".scss",
    ".less",
    ".styl",
    ".json",
    ".json5",
    ".xml",
    ".yaml",
    ".yml",
    ".csv",
    ".log",
    ".ini",
    ".cfg",
    ".toml",
    ".properties",
    ".conf",
    ".tex",
    ".bib",
    ".rst",
    ".tsv",
    ".mdx",
    ".rmd",
    ".mkdn",
    ".mkd",
    ".adoc",
    ".asciidoc",
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",

    // Programming Languages
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".py",
    ".rb",
    ".php",
    ".pl",
    ".pm",
    ".c",
    ".h",
    ".cpp",
    ".hpp",
    ".cc",
    ".hh",
    ".cxx",
    ".hxx",
    ".cs",
    ".java",
    ".kt",
    ".kts",
    ".swift",
    ".go",
    ".rs",
    ".hs",
    ".scala",
    ".lisp",
    ".lsp",
    ".cl",
    ".scm",
    ".ex",
    ".exs",
    ".erl",
    ".hrl",
    ".dart",
    ".lua",
    ".r",
    ".sql",
    ".sh",
    ".bash",
    ".zsh",
    ".bat",
    ".cmd",
    ".ps1",
    ".m",     // Objective-C
    ".mm",    // Objective-C++
    ".vb",
    ".fs",
    ".fsi",
    ".fsx",
    ".jl",    // Julia
    ".f",
    ".for",
    ".f90",
    ".f95",
    ".cob",
    ".cbl",
    ".adb",
    ".ads",
    ".vhd",
    ".vhdl",
    ".v",     // Verilog
    ".asm",

    // Web Templates
    ".vue",
    ".svelte",
    ".sass",
    ".ejs",
    ".jade",
    ".pug",
    ".handlebars",
    ".hbs",
    ".coffee",
];



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

    // Check file extension against allowed list
    const fileName = file.name.toLowerCase();
    const isAllowedExtension = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext));

    if (!isAllowedExtension) {
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

