import React from 'react';
import { FileAttachment, type FileAttachmentData } from '../../attachments/FileAttachment';
import { TabAttachment, type TabAttachmentData } from '../../attachments/TabAttachment';

interface AttachmentsAreaProps {
    attachments: FileAttachmentData[];
    tabAttachments: TabAttachmentData[];
    handleRemoveAttachment: (id: string) => void;
    handleRemoveTabAttachment: (id: string) => void;
}

/**
 * Area displaying file and tab attachments.
 */
export const AttachmentsArea: React.FC<AttachmentsAreaProps> = ({
    attachments,
    tabAttachments,
    handleRemoveAttachment,
    handleRemoveTabAttachment
}) => {
    return (
        <>
            {/* Tab Attachments Preview */}
            {tabAttachments.length > 0 && (
                <div className="tab-attachments-container">
                    <TabAttachment
                        tabs={tabAttachments}
                        onRemoveAll={() => {
                            tabAttachments.forEach(tab => handleRemoveTabAttachment(tab.id));
                        }}
                    />
                </div>
            )}

            {/* File Attachments Preview */}
            {attachments.length > 0 && (
                <div className="file-attachments-container">
                    {attachments.map(attachment => (
                        <FileAttachment
                            key={attachment.id}
                            attachment={attachment}
                            onRemove={handleRemoveAttachment}
                        />
                    ))}
                </div>
            )}
        </>
    );
};

