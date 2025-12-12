import { forwardRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AudioLinesIcon } from '../icons';
import type { AudioLinesIconHandle } from '../icons';

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
                        className="!fixed !bottom-[140px] !left-1/2 !top-auto !-translate-x-1/2 !bg-[rgba(26,38,55,0.98)] !border !border-white/20 !rounded-[32px] !px-6 !py-3 !flex !items-center !justify-center !gap-3 !shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.05)] !cursor-pointer !z-[10000] !backdrop-blur-[16px] !w-max !max-w-[85%] !min-w-[240px] !transition-all !duration-200 !m-0 !right-auto hover:!bg-[rgba(26,38,55,1)] hover:!border-white/30 hover:!shadow-[0_12px_40px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.1)] hover:!scale-[1.02] active:!scale-[0.98]"
                        style={{
                            animation: 'voicePillPulse 2s ease-in-out infinite'
                        }}
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
                            className="shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
                            style={{ color: 'white' }}
                        />
                        <span className="!text-white/95 !text-sm !font-medium !tracking-wide !whitespace-nowrap [text-shadow:0_1px_2px_rgba(0,0,0,0.3)]">Click to finish recording</span>
                    </motion.div>
                )}
            </AnimatePresence>
        );
    }
);

VoiceRecordingPill.displayName = 'VoiceRecordingPill';

