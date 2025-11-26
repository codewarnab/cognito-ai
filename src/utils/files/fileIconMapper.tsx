"use client";

import type React from "react";
import { File, Image, Film, Music, Archive } from "lucide-react";
import {
    CssIcon,
    HtmlIcon,
    JsIcon,
    JsonIcon,
    JsxIcon,
    PdfIcon,
    PyIcon,
    TsxIcon,
    TxtIcon,
    JavaIcon,
    CppIcon,
    CIcon,
    MDIcon,
    PHPIcon,
    RSIcon,
    SwiftIcon,
    XMLIcon,
    YAMLIcon,
    RubyIcon,
    ShellIcon,
    GoIcon,
    CSIcon,
    CSVIcon,
    LogIcon,
} from "@assets/icons/files";

/**
 * Extract file extension from filename
 */
export function getFileExtension(filename: string): string {
    return filename?.split(".").pop()?.toLowerCase() || "";
}

/**
 * Get file icon component based on extension
 * Returns a React component or null
 */
export function getFileIconComponent(extension: string): React.ComponentType<{ size?: number }> | null {
    switch (extension) {
        // Programming Languages
        case "css":
        case "scss":
        case "sass":
        case "less":
            return CssIcon;
        case "html":
        case "htm":
            return HtmlIcon;
        case "js":
            return JsIcon;
        case "jsx":
            return JsxIcon;
        case "ts":
        case "tsx":
            return TsxIcon;
        case "json":
        case "json5":
            return JsonIcon;
        case "py":
            return PyIcon;
        case "java":
            return JavaIcon;
        case "cpp":
        case "c++":
        case "cc":
        case "cxx":
            return CppIcon;
        case "c":
        case "h":
            return CIcon;
        case "cs":
            return CSIcon;
        case "php":
            return PHPIcon;
        case "rs":
            return RSIcon;
        case "swift":
            return SwiftIcon;
        case "rb":
        case "ruby":
            return RubyIcon;
        case "sh":
        case "bash":
        case "zsh":
            return ShellIcon;
        case "go":
            return GoIcon;

        // Documents
        case "md":
        case "markdown":
        case "mdown":
        case "mkd":
        case "mdx":
            return MDIcon;
        case "pdf":
            return PdfIcon;
        case "txt":
        case "text":
            return TxtIcon;
        case "xml":
            return XMLIcon;
        case "yaml":
        case "yml":
            return YAMLIcon;
        case "csv":
        case "tsv":
            return CSVIcon;
        case "log":
            return LogIcon;

        default:
            return null;
    }
}

/**
 * Get Lucide icon for generic file types (images, videos, audio, archives)
 */
export function getLucideIcon(extension: string): React.ComponentType<any> | null {
    // Images
    if (["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp", "ico", "heic", "heif", "avif"].includes(extension)) {
        return Image;
    }
    // Videos
    if (["mp4", "mkv", "webm", "avi", "mov", "wmv", "flv", "m4v"].includes(extension)) {
        return Film;
    }
    // Audio
    if (["mp3", "wav", "ogg", "flac", "aac", "m4a", "wma"].includes(extension)) {
        return Music;
    }
    // Archives
    if (["zip", "rar", "7z", "tar", "gz", "bz2", "xz"].includes(extension)) {
        return Archive;
    }
    return null;
}

/**
 * Get appropriate icon for a file
 * Returns either a custom icon component, a Lucide icon, or a generic File icon
 */
export function getFileIcon(filename: string, size: number = 24): React.ReactNode {
    // Special case: YouTube transcript files
    // Check for _yt.txt suffix (new format) or old formats
    if (filename.endsWith('_yt.txt') || filename.includes('_transcript.txt') || filename.includes('transcript.txt')) {
        return (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                width={size}
                height={size}
                fill="#FF0000"
                role="img"
                aria-label="YouTube"
            >
                <path d="M8.051 1.999h.089c.822.003 4.987.033 6.11.335a2.01 2.01 0 0 1 1.415 1.42c.101.38.172.883.22 1.402l.01.104.022.26.008.104c.065.914.073 1.77.074 1.957v.075c-.001.194-.01 1.108-.082 2.06l-.008.105-.009.104c-.05.572-.124 1.14-.235 1.558a2.01 2.01 0 0 1-1.415 1.42c-1.16.312-5.569.334-6.18.335h-.142c-.309 0-1.587-.006-2.927-.052l-.17-.006-.087-.004-.171-.007-.171-.007c-1.11-.049-2.167-.128-2.654-.26a2.01 2.01 0 0 1-1.415-1.419c-.111-.417-.185-.986-.235-1.558L.09 9.82l-.008-.104A31 31 0 0 1 0 7.68v-.123c.002-.215.01-.958.064-1.778l.007-.103.003-.052.008-.104.022-.26.01-.104c.048-.519.119-1.023.22-1.402a2.01 2.01 0 0 1 1.415-1.42c.487-.13 1.544-.21 2.654-.26l.17-.007.172-.006.086-.003.171-.007A100 100 0 0 1 7.858 2zM6.4 5.209v4.818l4.157-2.408z" />
            </svg>
        );
    }

    const extension = getFileExtension(filename);

    // Try custom icon first
    const CustomIcon = getFileIconComponent(extension);
    if (CustomIcon) {
        return <CustomIcon size={size} />;
    }

    // Try Lucide icon
    const LucideIcon = getLucideIcon(extension);
    if (LucideIcon) {
        return <LucideIcon size={size} />;
    }

    // Default to generic file icon
    return <File size={size} />;
}

/**
 * Get emoji representation of file icon (for backward compatibility)
 */
export function getFileIconEmoji(mimeType: string, fileName: string): string {
    const extension = getFileExtension(fileName);

    // Images
    if (mimeType.startsWith('image/')) return '🖼️';

    // Documents
    if (mimeType === 'application/pdf' || extension === 'pdf') return '📕';
    if (mimeType.includes('word') || ['doc', 'docx'].includes(extension)) return '📘';
    if (mimeType.includes('excel') || ['xls', 'xlsx'].includes(extension)) return '📊';
    if (extension === 'csv' || mimeType === 'text/csv') return '📊';
    if (['md', 'markdown'].includes(extension) || mimeType === 'text/markdown') return '📝';

    // Programming files
    if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs'].includes(extension)) return '📄';

    // Default
    return '📄';
}

/**
 * Get short media type label
 */
export function getMediaTypeLabel(mediaType: string, fileName?: string): string {
    if (mediaType === 'application/pdf') return 'PDF';
    if (mediaType === 'text/markdown' || mediaType.includes('markdown')) return 'Markdown';
    if (mediaType === 'text/csv') return 'CSV';
    if (mediaType === 'application/json') return 'JSON';
    if (mediaType.startsWith('image/')) return 'Image';
    if (mediaType.startsWith('video/')) return 'Video';
    if (mediaType.startsWith('audio/')) return 'Audio';
    if (mediaType.startsWith('text/')) return 'Text';

    // Try to infer from filename
    if (fileName) {
        const extension = getFileExtension(fileName).toUpperCase();
        if (extension) return extension;
    }

    return mediaType.split('/')[0] || 'File';
}
