import React from 'react';
import { X } from 'lucide-react';

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
    const truncateName = (name: string, maxLength: number = 15) => {
        if (name.length <= maxLength) return name;
        const ext = name.split('.').pop();
        const nameWithoutExt = name.substring(0, name.lastIndexOf('.'));
        const truncated = nameWithoutExt.substring(0, maxLength - 3 - (ext?.length || 0));
        return `${truncated}...${ext}`;
    };

    return (
        <div className="file-attachment">
            {attachment.type === 'image' && attachment.preview ? (
                <div className="file-attachment-image">
                    <img src={attachment.preview} alt={attachment.file.name} />
                    <button
                        type="button"
                        className="file-attachment-remove"
                        onClick={() => onRemove(attachment.id)}
                        title="Remove attachment"
                    >
                        <X size={14} />
                    </button>
                </div>
            ) : (
                <div className="file-attachment-document">
                    <div className="file-attachment-icon">
                        📄
                    </div>
                    <span className="file-attachment-name" title={attachment.file.name}>
                        {truncateName(attachment.file.name)}
                    </span>
                    <button
                        type="button"
                        className="file-attachment-remove"
                        onClick={() => onRemove(attachment.id)}
                        title="Remove attachment"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}
        </div>
    );
};
