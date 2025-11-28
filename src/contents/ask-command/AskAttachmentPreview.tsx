/**
 * Ask Attachment Preview Component
 * Shows preview of attached file before sending
 */
import React from 'react';
import type { AskAttachment } from '@/types';
import { formatFileSize } from './askAttachmentUtils';
import { getFileIcon } from '@/utils/files/fileIconMapper';

// Icons
const CloseIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

interface AskAttachmentPreviewProps {
    attachment: AskAttachment;
    onRemove: () => void;
    disabled?: boolean;
}

export function AskAttachmentPreview({ attachment, onRemove, disabled }: AskAttachmentPreviewProps) {
    const isImage = attachment.type === 'image';

    return (
        <div className="ask-attachment-preview">
            {isImage && attachment.preview ? (
                <img
                    src={attachment.preview}
                    alt={attachment.file.name}
                    className="ask-attachment-thumbnail"
                />
            ) : (
                <div className="ask-attachment-icon">
                    {getFileIcon(attachment.file.name, 24)}
                </div>
            )}
            <div className="ask-attachment-info">
                <span className="ask-attachment-name" title={attachment.file.name}>
                    {attachment.file.name}
                </span>
                <span className="ask-attachment-size">{formatFileSize(attachment.file.size)}</span>
            </div>
            <button
                type="button"
                className="ask-attachment-remove"
                onClick={onRemove}
                disabled={disabled}
                title="Remove attachment"
                aria-label="Remove attachment"
            >
                <CloseIcon />
            </button>
        </div>
    );
}
