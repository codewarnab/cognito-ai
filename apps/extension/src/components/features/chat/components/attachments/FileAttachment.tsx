import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getFileIcon, truncateFileName } from '@/utils/files';
import { YoutubeIcon } from '@assets/icons/chat/youtube';

/** Metadata for special attachment sources (e.g., YouTube transcripts) */
export interface FileAttachmentMeta {
    source?: 'youtube';
    thumbnailUrl?: string;
    author?: string;
    durationSeconds?: number;
    videoUrl?: string;
}

export interface FileAttachmentData {
    id: string;
    file: File;
    preview?: string; // Base64 preview for images
    type: 'image' | 'document';
    /** Optional metadata for special sources like YouTube */
    meta?: FileAttachmentMeta;
}

interface FileAttachmentProps {
    attachment: FileAttachmentData;
    onRemove: (id: string) => void;
}

export const FileAttachment: React.FC<FileAttachmentProps> = ({ attachment, onRemove }) => {
    const [showPreview, setShowPreview] = useState(false);
    const [thumbnailError, setThumbnailError] = useState(false);

    const isYouTube = attachment.meta?.source === 'youtube';
    const hasThumbnail = isYouTube && attachment.meta?.thumbnailUrl && !thumbnailError;



    const handleTogglePreview = () => {
        if (attachment.type === 'image') {
            setShowPreview(!showPreview);
        }
    };

    const handleThumbnailError = () => {
        setThumbnailError(true);
    };

    // Handle ESC key to close preview
    useEffect(() => {
        if (!showPreview) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setShowPreview(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [showPreview]);

    // Render YouTube attachment with thumbnail
    if (isYouTube) {
        return (
            <div className="relative rounded-[10px] overflow-hidden bg-[rgba(30,40,60,0.6)] border border-[rgba(255,0,0,0.2)] transition-all duration-200 shadow-[0_2px_8px_rgba(0,0,0,0.3)] hover:bg-[rgba(40,50,70,0.7)] hover:border-[rgba(120,140,170,0.5)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.4)] hover:-translate-y-px group/file">
                <div className="flex items-center gap-2 py-[10px] px-[14px] min-w-[130px] max-w-[220px] relative bg-[rgba(35,45,65,0.7)] hover:bg-[rgba(45,55,75,0.8)]">
                    {hasThumbnail ? (
                        <div className="w-8 h-6 rounded overflow-hidden shrink-0 bg-black/10">
                            <img
                                src={attachment.meta!.thumbnailUrl}
                                alt="Video thumbnail"
                                onError={handleThumbnailError}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ) : (
                        <div className="text-xl shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)] text-[#ff0000] flex items-center justify-center">
                            <YoutubeIcon size={20} />
                        </div>
                    )}
                    <div className="flex flex-col min-w-0 gap-[1px] flex-1">
                        <span className="text-[11px] leading-[1.2] font-medium text-white/90 whitespace-nowrap overflow-hidden text-ellipsis block" title={attachment.file.name}>
                            {truncateFileName(attachment.file.name, 18)}
                        </span>
                        <span className="text-[9px] text-[#ff0000] font-medium opacity-90 block">YouTube</span>
                    </div>
                    <button
                        type="button"
                        className="relative bg-transparent border-none rounded-full w-5 h-5 flex items-center justify-center cursor-pointer text-white/60 opacity-60 transition-all duration-200 p-0 ml-auto group-hover/file:opacity-100 hover:bg-[rgba(255,50,50,0.3)] hover:text-white/95 hover:!opacity-100"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove(attachment.id);
                        }}
                        aria-label="Remove YouTube transcript attachment"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div
                className={`relative rounded-[10px] overflow-hidden bg-[rgba(30,40,60,0.6)] border-[1.5px] border-[rgba(100,120,150,0.3)] transition-all duration-200 shadow-[0_2px_8px_rgba(0,0,0,0.3)] hover:bg-[rgba(40,50,70,0.7)] hover:border-[rgba(120,140,170,0.5)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.4)] hover:-translate-y-px group/file ${attachment.type === 'image' ? 'cursor-pointer' : 'default'}`}
                onClick={handleTogglePreview}
            >
                {attachment.type === 'image' && attachment.preview ? (
                    <div className="flex items-center gap-[10px] py-[10px] px-[14px] min-w-[180px] max-w-[280px] relative bg-[rgba(35,45,65,0.7)] hover:bg-[rgba(45,55,75,0.8)]">
                        <img src={attachment.preview} alt={attachment.file.name} className="w-8 h-8 object-cover block rounded-md shrink-0" />
                        <span className="text-[13px] text-white/90 whitespace-nowrap overflow-hidden text-ellipsis flex-1 font-medium" title={attachment.file.name}>
                            {truncateFileName(attachment.file.name, 20)}
                        </span>
                        <button
                            type="button"
                            className="relative bg-transparent border-none rounded-full w-5 h-5 flex items-center justify-center cursor-pointer text-white/60 opacity-60 transition-all duration-200 p-0 ml-auto group-hover/file:opacity-100 hover:bg-[rgba(255,50,50,0.3)] hover:text-white/95 hover:!opacity-100"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemove(attachment.id);
                            }}
                            aria-label="Remove attachment"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-[10px] py-[10px] px-[14px] min-w-[130px] max-w-[220px] relative bg-[rgba(35,45,65,0.7)] hover:bg-[rgba(45,55,75,0.8)]">
                        <div className="text-[22px] shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
                            {getFileIcon(attachment.file.name, 20)}
                        </div>
                        <span className="text-[13px] text-white/90 whitespace-nowrap overflow-hidden text-ellipsis flex-1 font-medium" title={attachment.file.name}>
                            {truncateFileName(attachment.file.name)}
                        </span>
                        <button
                            type="button"
                            className="relative bg-transparent border-none rounded-full w-5 h-5 flex items-center justify-center cursor-pointer text-white/60 opacity-60 transition-all duration-200 p-0 ml-auto group-hover/file:opacity-100 hover:bg-[rgba(255,50,50,0.3)] hover:text-white/95 hover:!opacity-100"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemove(attachment.id);
                            }}
                            aria-label="Remove attachment"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}
            </div>
            {showPreview && attachment.type === 'image' && attachment.preview && (
                <div
                    className="fixed inset-0 z-[10000] flex flex-col items-center justify-center gap-4 p-10"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="absolute inset-0 bg-black/85 animate-in fade-in duration-200 pointer-events-none" />
                    <img
                        src={attachment.preview}
                        alt={attachment.file.name}
                        className="relative block max-w-full max-h-full w-auto h-auto rounded-xl object-contain shadow-[0_20px_60px_rgba(0,0,0,0.9)] animate-in zoom-in-95 duration-200"
                    />
                    <button
                        type="button"
                        className="absolute top-5 right-5 text-white/70 hover:text-white transition-colors p-2 bg-black/20 rounded-full hover:bg-black/40 z-50"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowPreview(false);
                        }}
                        aria-label="Close preview"
                    >
                        <X size={24} />
                    </button>
                    <p className="relative text-white/60 text-[13px] font-medium m-0 py-2 px-4 bg-black/50 rounded-lg animate-in fade-in duration-200">Press esc to close the preview</p>
                </div>
            )}
        </>
    );
};
