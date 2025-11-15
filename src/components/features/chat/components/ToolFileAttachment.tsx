/**
 * Tool File Attachment Component
 * Renders file attachments from tool results with Open and Download actions
 */

import React, { useState, useEffect } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import { getFileIcon } from '../../../../utils/fileIconMapper';

export interface ToolFileAttachmentData {
    type: 'file';
    name: string;
    url: string; // Blob URL
    mediaType: string;
    size: number;
}

interface ToolFileAttachmentProps {
    fileData: ToolFileAttachmentData;
    messageId?: string; // Optional: for Blob URL lifecycle management
    onUrlRevoke?: (url: string) => void; // Callback when component unmounts
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}



export const ToolFileAttachment: React.FC<ToolFileAttachmentProps> = ({ fileData, messageId, onUrlRevoke }) => {
    const [isDownloading, setIsDownloading] = useState(false);

    // Handle opening file in new tab
    const handleOpen = () => {
        window.open(fileData.url, '_blank', 'noopener,noreferrer');
    };

    // Handle download
    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            // Create temporary anchor and trigger download
            const link = document.createElement('a');
            link.href = fileData.url;
            link.download = fileData.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Failed to download file:', error);
        } finally {
            setIsDownloading(false);
        }
    };

    // Cleanup blob URL when component unmounts
    useEffect(() => {
        return () => {
            // Always revoke the Blob URL to prevent memory leaks
            try {
                URL.revokeObjectURL(fileData.url);
                console.debug(`Revoked Blob URL for ${fileData.name}${messageId ? ` (message: ${messageId})` : ''}`);
            } catch (error) {
                console.error('Error revoking Blob URL:', error);
            }

            // Also call the callback if provided
            if (onUrlRevoke) {
                onUrlRevoke(fileData.url);
            }
        };
    }, [fileData.url, fileData.name, messageId, onUrlRevoke]);

    return (
        <div className="tool-file-attachment">
            <div className="tool-file-attachment-icon">
                {getFileIcon(fileData.name, 20)}
            </div>
            <div className="tool-file-attachment-info">
                <div className="tool-file-attachment-name" title={fileData.name}>
                    {fileData.name}
                </div>
                <div className="tool-file-attachment-meta">
                    <span className="tool-file-attachment-size">{formatFileSize(fileData.size)}</span>
                </div>
            </div>
            <div className="tool-file-attachment-actions">
                <button
                    type="button"
                    className="tool-file-attachment-action"
                    onClick={handleOpen}
                    title="Open in new tab"
                >
                    <ExternalLink size={14} />
                </button>
                <button
                    type="button"
                    className="tool-file-attachment-action"
                    onClick={handleDownload}
                    disabled={isDownloading}
                    title="Download file"
                >
                    <Download size={14} />
                </button>
            </div>
        </div>
    );
};
