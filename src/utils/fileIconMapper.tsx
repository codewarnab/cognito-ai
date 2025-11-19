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
    XML,
    YAMl,
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
            return XML;
        case "yaml":
        case "yml":
            return YAMl;
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
