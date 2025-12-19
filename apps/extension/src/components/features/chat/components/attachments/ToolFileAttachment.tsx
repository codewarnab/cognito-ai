/**
 * Tool File Attachment Component
 * Renders file attachments from tool results with Open and Download actions
 * Supports both blob URLs and IndexedDB PDF references
 */

import React, { useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import { getFileIcon } from '@/utils/files';
import { getPDF } from '@/db';

export interface ToolFileAttachmentData {
    type: 'file';
    name: string;
    url?: string;         // Legacy: direct blob URL
    pdfId?: string;       // New: IndexedDB reference ID
    mediaType: string;
    size: number;
}

interface ToolFileAttachmentProps {
    fileData: ToolFileAttachmentData;
    messageId?: string; // Optional: for logging
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}



export const ToolFileAttachment: React.FC<ToolFileAttachmentProps> = ({ fileData }) => {
    const [isDownloading, setIsDownloading] = useState(false);
    const [isOpening, setIsOpening] = useState(false);

    /**
     * Get blob URL from IndexedDB or use existing URL
     */
    const getBlobUrl = async (): Promise<string | null> => {
        if (fileData.pdfId) {
            // Fetch from IndexedDB
            const pdf = await getPDF(fileData.pdfId);
            if (pdf) {
                return URL.createObjectURL(pdf.blob);
            }
            console.error(`PDF not found in IndexedDB: ${fileData.pdfId}`);
            return null;
        }
        return fileData.url || null;
    };

    // Handle opening file in new tab
    const handleOpen = async () => {
        setIsOpening(true);
        try {
            const url = await getBlobUrl();
            if (url) {
                window.open(url, '_blank', 'noopener,noreferrer');

                // Revoke blob URL after delay if it was created from IndexedDB
                if (fileData.pdfId) {
                    setTimeout(() => URL.revokeObjectURL(url), 10000);
                }
            } else {
                console.error('Failed to get PDF URL for opening');
            }
        } catch (error) {
            console.error('Failed to open file:', error);
        } finally {
            setIsOpening(false);
        }
    };

    // Handle download
    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            const url = await getBlobUrl();
            if (url) {
                // Create temporary anchor and trigger download
                const link = document.createElement('a');
                link.href = url;
                link.download = fileData.name;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                // Revoke blob URL after delay if it was created from IndexedDB
                if (fileData.pdfId) {
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                }
            } else {
                console.error('Failed to get PDF URL for download');
            }
        } catch (error) {
            console.error('Failed to download file:', error);
        } finally {
            setIsDownloading(false);
        }
    };

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
                    disabled={isOpening}
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
                        cursor: isOpening ? 'not-allowed' : 'pointer',
                        opacity: isOpening ? 0.5 : 1,
                        transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                        if (!isOpening) {
                            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                            e.currentTarget.style.color = 'rgba(59, 130, 246, 0.95)';
                        }
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
