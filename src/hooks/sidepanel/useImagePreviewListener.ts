import { useState, useEffect } from 'react';

/**
 * Hook to listen for image preview state changes
 */
export function useImagePreviewListener() {
    const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);

    useEffect(() => {
        const handleImagePreviewStateChange = (event: CustomEvent) => {
            setIsImagePreviewOpen(event.detail.isOpen);
        };

        window.addEventListener('imagePreviewStateChange' as any, handleImagePreviewStateChange);
        return () => {
            window.removeEventListener('imagePreviewStateChange' as any, handleImagePreviewStateChange);
        };
    }, []);

    return { isImagePreviewOpen };
}
