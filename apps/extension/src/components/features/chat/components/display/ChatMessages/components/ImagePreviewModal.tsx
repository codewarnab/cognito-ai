/**
 * ImagePreviewModal Component
 * 
 * Full-screen modal for previewing image attachments.
 * Features smooth animations, click-outside-to-close, and ESC key support.
 */

import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { XIcon } from '@assets/icons/chat/x';
import type { ImagePreviewData } from '../types';

interface ImagePreviewModalProps {
    /** Image data to preview, or null if modal is closed */
    previewImage: ImagePreviewData | null;
    /** Callback to close the modal */
    onClose: () => void;
}

/**
 * Full-screen image preview modal with animations
 * 
 * Features:
 * - Backdrop click to close
 * - Close button in top-right corner
 * - ESC key to close (handled by parent)
 * - Spring animation for image scaling
 * - Displays "Press ESC to close" hint
 * 
 * @example
 * ```tsx
 * <ImagePreviewModal
 *   previewImage={{ url: 'https://...', name: 'screenshot.png' }}
 *   onClose={() => setPreviewImage(null)}
 * />
 * ```
 */
export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
    previewImage,
    onClose,
}) => {
    return (
        <AnimatePresence>
            {previewImage && (
                <motion.div
                    className="fixed inset-0 bg-black/90 z-[10000] flex items-center justify-center p-10 cursor-pointer"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    {/* Close button - top right corner */}
                    <button
                        className="absolute top-5 right-5 w-10 h-10 rounded-full bg-gray-500/50 border-none flex items-center justify-center cursor-pointer z-[9999] transition-colors duration-200 text-white hover:bg-gray-500/70 active:bg-gray-500/80"
                        onClick={onClose}
                        aria-label="Close preview"
                    >
                        <XIcon size={20} />
                    </button>

                    {/* Image container with spring animation */}
                    <motion.div
                        className="max-w-[90vw] max-h-[90vh] flex flex-col items-center justify-center cursor-default gap-3"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* The actual image */}
                        <img
                            src={previewImage.url}
                            alt={previewImage.name}
                            className="max-w-full max-h-[calc(90vh-40px)] w-auto h-auto rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] object-contain"
                        />

                        {/* ESC hint */}
                        <div className="text-[13px] text-white/50 text-center px-3 py-1 bg-white/8 rounded-md">
                            Press ESC to close
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
