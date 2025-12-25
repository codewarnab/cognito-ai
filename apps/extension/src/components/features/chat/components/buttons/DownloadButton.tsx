import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DownloadIcon, type DownloadIconHandle } from '@assets/icons/ui/download';

interface DownloadButtonProps {
    audioBuffer: ArrayBuffer | null;
    isPlaying: boolean;
    fileName?: string;
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({
    audioBuffer,
    isPlaying,
    fileName = 'audio.mp3'
}) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const iconRef = useRef<DownloadIconHandle>(null);

    const handleDownload = () => {
        if (!audioBuffer) return;

        try {
            // Create blob from audio buffer
            const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
            const url = URL.createObjectURL(blob);

            // Create temporary link and trigger download
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up
            URL.revokeObjectURL(url);

            // Trigger animation
            iconRef.current?.startAnimation();
            setTimeout(() => {
                iconRef.current?.stopAnimation();
            }, 500);
        } catch (err) {
            console.error('Failed to download audio:', err);
        }
    };

    // Only show when audio is playing
    if (!isPlaying || !audioBuffer) {
        return null;
    }

    return (
        <div className="relative inline-block">
            <motion.button
                onClick={handleDownload}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="flex items-center justify-center p-1 rounded-md text-white/60 hover:text-white/90 hover:bg-white/10 transition-colors cursor-pointer"
                title="Download audio"
                aria-label="Download audio"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{
                    type: 'spring',
                    stiffness: 200,
                    damping: 15
                }}
            >
                <DownloadIcon ref={iconRef} size={14} />
            </motion.button>
            <AnimatePresence>
                {showTooltip && (
                    <motion.div
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 rounded-md text-xs text-white/90 bg-black/80 backdrop-blur-md border border-white/10 shadow-lg whitespace-nowrap z-50 pointer-events-none"
                        initial={{ opacity: 0, y: 5, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -5, scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                    >
                        Download
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
