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
    }, [fileData.url, fileData.name, messageId]);

    return (
        <div
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                maxWidth: '300px',
                transition: 'all 0.15s ease',
                cursor: 'default',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.09)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
            }}
        >
            {/* File Icon */}
            <div
                style={{
                    flexShrink: 0,
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(59, 130, 246, 0.12)',
                    borderRadius: '6px',
                }}
            >
                {getFileIcon(fileData.name, 18)}
            </div>

            {/* File Info */}
            <div
                style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                }}
            >
                <div
                    style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: 'rgba(255, 255, 255, 0.92)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}
                    title={fileData.name}
                >
                    {fileData.name}
                </div>
                <div
                    style={{
                        fontSize: '11px',
                        color: 'rgba(255, 255, 255, 0.5)',
                    }}
                >
                    {formatFileSize(fileData.size)}
                </div>
            </div>

            {/* Action Buttons */}
            <div
                style={{
                    display: 'flex',
                    gap: '4px',
                }}
            >
                <button
                    type="button"
                    onClick={handleOpen}
                    title="Open in new tab"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        padding: 0,
                        border: 'none',
                        borderRadius: '5px',
                        background: 'transparent',
                        color: 'rgba(255, 255, 255, 0.65)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                        e.currentTarget.style.color = 'rgba(59, 130, 246, 0.95)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
                    }}
                >
                    <ExternalLink size={14} />
                </button>
                <button
                    type="button"
                    onClick={handleDownload}
                    disabled={isDownloading}
                    title="Download file"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        padding: 0,
                        border: 'none',
                        borderRadius: '5px',
                        background: 'transparent',
                        color: 'rgba(255, 255, 255, 0.65)',
                        cursor: isDownloading ? 'not-allowed' : 'pointer',
                        opacity: isDownloading ? 0.5 : 1,
                        transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                        if (!isDownloading) {
                            e.currentTarget.style.background = 'rgba(34, 197, 94, 0.15)';
                            e.currentTarget.style.color = 'rgba(34, 197, 94, 0.95)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
                    }}
                >
                    <Download size={14} />
                </button>
            </div>
        </div>
    );
};
