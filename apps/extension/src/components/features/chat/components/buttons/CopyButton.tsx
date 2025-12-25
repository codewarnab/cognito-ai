import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CopyIcon, type CopyIconHandle } from '@/components/shared/icons/CopyIcon';
import { VoiceButton } from './VoiceButton';
import { DownloadButton } from './DownloadButton';
// import { BrainButton } from './BrainButton';
// import { isAutoExtractionEnabled } from '@/utils/supermemory';

interface CopyButtonProps {
    content: string;
    previousMessage?: string;
    threadId?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ content, previousMessage, threadId }) => {
    const [copied, setCopied] = useState(false);
    const [audioBuffer, setAudioBuffer] = useState<ArrayBuffer | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    // const [autoExtractionOn, setAutoExtractionOn] = useState(false);
    const iconRef = useRef<CopyIconHandle>(null);

    // useEffect(() => {
    //     const checkAutoExtraction = async () => {
    //         try {
    //             const enabled = await isAutoExtractionEnabled();
    //             setAutoExtractionOn(enabled);
    //         } catch {
    //             setAutoExtractionOn(false);
    //         }
    //     };
    //     checkAutoExtraction();
    // }, []);

    const handleCopy = async () => {
        if (!content) return;

        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            iconRef.current?.startAnimation();

            setTimeout(() => {
                setCopied(false);
                iconRef.current?.stopAnimation();
            }, 2000);
        } catch (err) {
            console.error('Failed to copy message:', err);
        }
    };



    return (
        <div className="flex items-center gap-0.5">
            <button
                onClick={handleCopy}
                className="flex items-center justify-center p-1 rounded-md text-white/60 hover:text-white/90 hover:bg-white/10 transition-colors cursor-pointer"
                title={copied ? 'Copied!' : 'Copy message'}
                aria-label={copied ? 'Copied!' : 'Copy message'}
            >
                <AnimatePresence mode="wait">
                    {copied ? (
                        <motion.svg
                            key="check"
                            xmlns="http://www.w3.org/2000/svg"
                            width={14}
                            height={14}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0, rotate: 180 }}
                            transition={{
                                type: 'spring',
                                stiffness: 200,
                                damping: 15
                            }}
                        >
                            <polyline points="20 6 9 17 4 12" />
                        </motion.svg>
                    ) : (
                        <motion.div
                            key="copy"
                            initial={{ scale: 0, rotate: 180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0, rotate: -180 }}
                            transition={{
                                type: 'spring',
                                stiffness: 200,
                                damping: 15
                            }}
                        >
                            <CopyIcon ref={iconRef} size={14} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </button>
            <VoiceButton
                content={content}
                onAudioBufferChange={setAudioBuffer}
                onPlayingStateChange={setIsPlaying}
            />
            <DownloadButton
                audioBuffer={audioBuffer}
                isPlaying={isPlaying}
                fileName={`message-audio-${Date.now()}.mp3`}
            />
            {/* {!autoExtractionOn && (
                <BrainButton
                    content={content}
                    previousMessage={previousMessage}
                    threadId={threadId}
                />
            )} */}
        </div>
    );
};
