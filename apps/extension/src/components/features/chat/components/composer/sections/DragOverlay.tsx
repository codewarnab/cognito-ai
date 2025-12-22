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
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-[100] pointer-events-none">
            <div className="flex flex-col items-center gap-3 text-white/90">
                <UploadIconMinimal size={32} className="stroke-[#e8e8e8]/80 animate-bounce" />
                <p className="text-base font-medium m-0">Drop files to attach</p>
            </div>
        </div>
    );
};

