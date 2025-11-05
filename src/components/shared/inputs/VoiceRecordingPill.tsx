import { forwardRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AudioLinesIcon } from '../effects/icons';
import type { AudioLinesIconHandle } from '../effects/icons';

interface VoiceRecordingPillProps {
    isVisible: boolean;
    onStopRecording: () => void;
}

export const VoiceRecordingPill = forwardRef<AudioLinesIconHandle, VoiceRecordingPillProps>(
    ({ isVisible, onStopRecording }, ref) => {
        return (
            <AnimatePresence mode="wait">
                {isVisible && (
                    <motion.div
                        className="voice-recording-pill"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        onAnimationStart={() => {
                            // Start the audio lines animation when pill appears
                            if (ref && typeof ref !== 'function' && ref.current) {
                                ref.current.startAnimation();
                            }
                        }}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onStopRecording();
                        }}
                    >
                        <AudioLinesIcon
                            ref={ref}
                            size={16}
                            style={{ color: 'white' }}
                        />
                        <span className="recording-text">Click to finish recording</span>
                    </motion.div>
                )}
            </AnimatePresence>
        );
    }
);

VoiceRecordingPill.displayName = 'VoiceRecordingPill';
