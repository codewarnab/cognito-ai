import React from 'react';
import { UploadIconMinimal } from '@/components/shared/icons';

interface DragOverlayProps {
    isDragging: boolean;
}

/**
 * Overlay displayed when user is dragging files over the composer.
 */
export const DragOverlay: React.FC<DragOverlayProps> = ({ isDragging }) => {
    if (!isDragging) return null;

    return (
        <div className="drag-overlay">
            <div className="drag-overlay-content">
                <UploadIconMinimal size={32} />
                <p>Drop files to attach</p>
            </div>
        </div>
    );
};

