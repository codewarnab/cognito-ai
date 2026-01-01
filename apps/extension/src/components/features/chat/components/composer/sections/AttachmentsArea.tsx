import React from 'react';
import { FileAttachment } from '../../attachments/FileAttachment';
import { TabAttachment } from '../../attachments/TabAttachment';
import { ElementContextChip } from '../../../../codeMode/ElementContextChip';
import { useAttachmentsStore, useCodeModeStore } from '@/stores';

/**
 * Area displaying file, tab, and element context attachments.
 * Uses Zustand store for state management.
 */
export const AttachmentsArea: React.FC = () => {
    const fileAttachments = useAttachmentsStore((s) => s.fileAttachments);
    const tabAttachments = useAttachmentsStore((s) => s.tabAttachments);
    const removeFileAttachment = useAttachmentsStore((s) => s.removeFileAttachment);
    const removeTabAttachment = useAttachmentsStore((s) => s.removeTabAttachment);
    const elementContext = useCodeModeStore((s) => s.elementContext);

    return (
        <>
            {/* Element Context Preview (Code Mode) */}
            {elementContext && (
                <div className="flex flex-wrap gap-2 p-2 pb-2 border-b border-white/10">
                    <ElementContextChip />
                </div>
            )}

            {/* Tab Attachments Preview */}
            {tabAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 pb-2 border-b border-white/10">
                    <TabAttachment
                        tabs={tabAttachments}
                        onRemoveAll={() => {
                            tabAttachments.forEach((tab) => removeTabAttachment(tab.id));
                        }}
                    />
                </div>
            )}

            {/* File Attachments Preview */}
            {fileAttachments.length > 0 && (
                <div className="flex flex-wrap gap-[10px] p-2 pb-2 border-b border-white/10">
                    {fileAttachments.map((attachment) => {
                        const isSinglePdf = fileAttachments.length === 1 &&
                            (attachment.file.type === 'application/pdf' || attachment.file.name.toLowerCase().endsWith('.pdf'));

                        return (
                            <FileAttachment
                                key={attachment.id}
                                attachment={attachment}
                                onRemove={removeFileAttachment}
                                showOpenButton={isSinglePdf}
                            />
                        );
                    })}
                </div>
            )}
        </>
    );
};

