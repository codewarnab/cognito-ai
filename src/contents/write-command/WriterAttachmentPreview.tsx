/**
 * Writer Attachment Preview
 * Minimal inline chip for attached file in writer overlay
 */
import type { WriteAttachment } from '@/types';

interface WriterAttachmentPreviewProps {
    attachment: WriteAttachment;
    onRemove: () => void;
    disabled?: boolean;
}

const XIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const ImageIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
        <path d="M21 15l-5-5L5 21" />
    </svg>
);

const FileIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6" />
    </svg>
);

function truncateName(name: string, maxLength = 16): string {
    if (name.length <= maxLength) return name;
    const ext = name.split('.').pop() || '';
    const base = name.substring(0, name.lastIndexOf('.'));
    const truncated = base.substring(0, maxLength - ext.length - 3);
    return `${truncated}...${ext}`;
}

export function WriterAttachmentPreview({
    attachment,
    onRemove,
    disabled,
}: WriterAttachmentPreviewProps) {
    const isImage = attachment.type === 'image';

    return (
        <div className="writer-attachment-chip">
            <span className="writer-attachment-chip-icon">
                {isImage ? <ImageIcon /> : <FileIcon />}
            </span>
            <span className="writer-attachment-chip-name" title={attachment.file.name}>
                {truncateName(attachment.file.name)}
            </span>
            <button
                type="button"
                className="writer-attachment-chip-remove"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRemove();
                }}
                disabled={disabled}
                aria-label="Remove attachment"
            >
                <XIcon />
            </button>
        </div>
    );
}
