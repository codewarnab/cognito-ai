import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getFileIcon } from '@/utils/files';

export interface FileAttachmentData {
    id: string;
    file: File;
    preview?: string; // Base64 preview for images
    type: 'image' | 'document';
}

interface FileAttachmentProps {
    attachment: FileAttachmentData;
    onRemove: (id: string) => void;
}

export const FileAttachment: React.FC<FileAttachmentProps> = ({ attachment, onRemove }) => {
    const [showPreview, setShowPreview] = useState(false);

    const truncateName = (name: string, maxLength: number = 15) => {
        if (name.length <= maxLength) return name;
        const ext = name.split('.').pop();
        const nameWithoutExt = name.substring(0, name.lastIndexOf('.'));
        const truncated = nameWithoutExt.substring(0, maxLength - 3 - (ext?.length || 0));
        return `${truncated}...${ext}`;
    };

    const handleTogglePreview = () => {
        if (attachment.type === 'image') {
            setShowPreview(!showPreview);
        }
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

    return (
        <>
            <div
                className="file-attachment"
                onClick={handleTogglePreview}
                style={{ cursor: attachment.type === 'image' ? 'pointer' : 'default' }}
            >
                {attachment.type === 'image' && attachment.preview ? (
                    <div className="file-attachment-image">
                        <img src={attachment.preview} alt={attachment.file.name} />
                        <span className="file-attachment-name" title={attachment.file.name}>
                            {truncateName(attachment.file.name, 20)}
                        </span>
                        <button
                            type="button"
                            className="file-attachment-remove"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemove(attachment.id);
                            }}
                            title="Remove attachment"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ) : (
                    <div className="file-attachment-document">
                        <div className="file-attachment-icon">
                            {getFileIcon(attachment.file.name, 20)}
                        </div>
                        <span className="file-attachment-name" title={attachment.file.name}>
                            {truncateName(attachment.file.name)}
                        </span>
                        <button
                            type="button"
                            className="file-attachment-remove"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemove(attachment.id);
                            }}
                            title="Remove attachment"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}
            </div>
            {showPreview && attachment.type === 'image' && attachment.preview && (
                <div
                    className="file-attachment-preview"
                    onClick={(e) => e.stopPropagation()}
                >
                    <img src={attachment.preview} alt={attachment.file.name} />
                    <button
                        type="button"
                        className="message-image-preview-close"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowPreview(false);
                        }}
                        aria-label="Close preview"
                    >
                        <X size={20} />
                    </button>
                </div>
            )}
        </>
    );
};
