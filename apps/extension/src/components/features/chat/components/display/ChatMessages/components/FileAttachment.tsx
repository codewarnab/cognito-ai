/**
 * FileAttachment Component
 * 
 * Renders file attachments in chat messages including:
 * - Images (with preview on click)
 * - Audio files (with inline player)
 * - Documents (PDF, text, etc.)
 * 
 * Handles grouping of multiple files with a badge showing count.
 */

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { getFileIcon, truncateFileName } from '@/utils/files';
import { AudioMessagePlayer } from '../../AudioMessagePlayer';
import type { ImagePreviewData } from '../types';

interface FileAttachmentProps {
    /** All file parts from the message */
    fileParts: any[];
    /** Index of current part being rendered */
    partIndex: number;
    /** Callback to open image preview modal */
    onPreviewImage: (data: ImagePreviewData) => void;
}

/**
 * Renders grouped file attachments with proper styling
 * 
 * Behavior:
 * - Only renders on the FIRST file part (groups all files together)
 * - Shows "+N" badge when multiple files are attached
 * - Images: clickable thumbnail that opens preview modal
 * - Audio: inline player component
 * - Documents: icon with filename, PDFs have "open in new tab" button
 * 
 * @example
 * ```tsx
 * <FileAttachment
 *   fileParts={message.parts.filter(p => p.type === 'file')}
 *   partIndex={0}
 *   onPreviewImage={(data) => setPreviewImage(data)}
 * />
 * ```
 */
export const FileAttachment: React.FC<FileAttachmentProps> = ({
    fileParts,
    partIndex,
    onPreviewImage,
}) => {
    // Calculate file counts and get first file
    const totalFiles = fileParts.length;
    const firstFile = fileParts[0];
    const remainingCount = totalFiles - 1;

    // Determine file type for appropriate rendering
    const isImage = firstFile.mediaType?.startsWith('image/');
    const isAudio = firstFile.mediaType?.startsWith('audio/');
    const isPdf = firstFile.mediaType === 'application/pdf' ||
        firstFile.name?.toLowerCase().endsWith('.pdf');

    /**
     * Handle opening PDF in new tab
     * Uses chrome.tabs.create in extension context, window.open as fallback
     */
    const handleOpenPdf = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
            chrome.tabs.create({ url: firstFile.url, active: true });
        } else {
            window.open(firstFile.url, '_blank', 'noopener,noreferrer');
        }
    };

    return (
        <div key={`file-group-${partIndex}`} className="relative inline-block my-2">
            <div className="inline-block">
                {/* Image attachment - clickable thumbnail */}
                {isImage && (
                    <div
                        className="relative w-[75px] h-[75px] rounded-[10px] overflow-hidden bg-[rgba(30,40,60,0.6)] border-[1.5px] border-[rgba(100,120,150,0.3)] p-[3px] shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition-all duration-200 cursor-pointer hover:scale-105 hover:shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
                        onClick={() => onPreviewImage({ url: firstFile.url, name: firstFile.name || 'Image' })}
                    >
                        <img
                            src={firstFile.url}
                            alt={firstFile.name || 'Attached image'}
                            className="w-full h-full object-cover block rounded-md cursor-pointer"
                        />
                    </div>
                )}

                {/* Audio attachment - inline player */}
                {isAudio && (
                    <AudioMessagePlayer url={firstFile.url} name={firstFile.name} />
                )}

                {/* Document attachment - icon with filename */}
                {!isImage && !isAudio && (
                    <div className="relative group/file inline-flex items-center gap-2.5 px-3.5 py-2.5 min-w-[130px] max-w-[220px] bg-[rgba(35,45,65,0.7)] rounded-[10px] border-[1.5px] border-[rgba(100,120,150,0.3)] shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition-all duration-200 hover:bg-[rgba(45,55,75,0.8)] hover:border-[rgba(120,140,170,0.5)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.4)] hover:-translate-y-px">
                        {/* File type icon */}
                        <div className="text-[22px] flex-shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
                            {getFileIcon(firstFile.name || 'file', 24)}
                        </div>

                        {/* Filename with truncation */}
                        <span
                            className="text-[13px] text-white/90 whitespace-nowrap overflow-hidden text-ellipsis flex-1 font-medium"
                            title={firstFile.name}
                        >
                            {truncateFileName(firstFile.name)}
                        </span>

                        {/* PDF external link button - only for single PDFs */}
                        {totalFiles === 1 && isPdf && (
                            <div
                                onClick={handleOpenPdf}
                                className="hidden group-hover/file:flex items-center justify-center text-white/60 hover:text-white/95 transition-colors absolute right-2 bg-[rgba(45,55,75,0.9)] rounded-md p-1 shadow-sm cursor-pointer"
                                title="Open PDF in new tab"
                            >
                                <ExternalLink size={14} />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Badge showing additional file count */}
            {remainingCount > 0 && (
                <div className="absolute -top-1.5 -right-1.5 bg-blue-500/95 text-white text-[11px] font-bold px-2 py-1 rounded-xl border-2 border-[rgba(30,40,60,0.9)] shadow-[0_2px_8px_rgba(0,0,0,0.4)] z-[2] min-w-[24px] text-center">
                    +{remainingCount}
                </div>
            )}
        </div>
    );
};
