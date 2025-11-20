import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <motion.button
                className="copy-message-button"
                onClick={handleDownload}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                title="Download audio"
                aria-label="Download audio"
                style={{ marginLeft: '8px' }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{
                    type: 'spring',
                    stiffness: 200,
                    damping: 15
                }}
            >
                <DownloadIcon ref={iconRef} size={18} />
            </motion.button>
            <AnimatePresence>
                {showTooltip && (
                    <motion.div
                        className="audio-generating-tooltip"
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
