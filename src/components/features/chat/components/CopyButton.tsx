import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CopyIcon, type CopyIconHandle } from '../../../shared/icons/CopyIcon';
import AnimatedVolumeIcon from '@assets/icons/ui/volume-icon';
import { AudioLinesIcon, type AudioLinesIconHandle } from '@assets/icons/ui/audio-lines';
import { generateSpeech, playAudioBuffer } from '../../../../utils/geminiTTS';
import { getGeminiApiKey } from '../../../../utils/geminiApiKey';

interface CopyButtonProps {
    content: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ content }) => {
    const [copied, setCopied] = useState(false);
    const [isReading, setIsReading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const iconRef = useRef<CopyIconHandle>(null);
    const audioIconRef = useRef<AudioLinesIconHandle>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            if (tooltipTimeoutRef.current) {
                clearTimeout(tooltipTimeoutRef.current);
            }
        };
    }, []);

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

    const handleVoiceToggle = async () => {
        if (isReading) {
            // Stop reading
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            setIsReading(false);
            audioIconRef.current?.stopAnimation();
        } else {
            // Start reading with Gemini TTS
            if (!content || isGenerating) return;

            try {
                setIsGenerating(true);
                
                // Show tooltip briefly
                setShowTooltip(true);
                tooltipTimeoutRef.current = setTimeout(() => {
                    setShowTooltip(false);
                }, 1000);
                
                // Get API key
                const apiKey = await getGeminiApiKey();
                if (!apiKey) {
                    console.error('No Gemini API key found. Please configure in settings.');
                    setShowTooltip(false);
                    // Fallback to browser TTS
                    fallbackToSpeechSynthesis();
                    return;
                }

                // Generate speech using Gemini TTS
                const audioBuffer = await generateSpeech(content, apiKey);
                
                // Play the audio
                const audio = playAudioBuffer(audioBuffer);
                audioRef.current = audio;

                audio.onplay = () => {
                    setIsReading(true);
                    setIsGenerating(false);
                    audioIconRef.current?.startAnimation();
                };

                audio.onended = () => {
                    setIsReading(false);
                    audioRef.current = null;
                    audioIconRef.current?.stopAnimation();
                };

                audio.onerror = () => {
                    setIsReading(false);
                    setIsGenerating(false);
                    audioRef.current = null;
                    audioIconRef.current?.stopAnimation();
                    console.error('Audio playback error');
                };

            } catch (error) {
                console.error('Failed to generate speech with Gemini TTS:', error);
                setIsGenerating(false);
                // Fallback to browser TTS
                fallbackToSpeechSynthesis();
            }
        }
    };

    const fallbackToSpeechSynthesis = () => {
        if (!content) return;
        
        const utterance = new SpeechSynthesisUtterance(content);

        utterance.onstart = () => {
            setIsReading(true);
            audioIconRef.current?.startAnimation();
        };

        utterance.onend = () => {
            setIsReading(false);
            audioIconRef.current?.stopAnimation();
        };

        utterance.onerror = () => {
            setIsReading(false);
            audioIconRef.current?.stopAnimation();
        };

        window.speechSynthesis.speak(utterance);
    };

    return (
        <div className="copy-message-button-wrapper">
            <button
                className="copy-message-button"
                onClick={handleCopy}
                title={copied ? 'Copied!' : 'Copy message'}
                aria-label={copied ? 'Copied!' : 'Copy message'}
            >
                <AnimatePresence mode="wait">
                    {copied ? (
                        <motion.svg
                            key="check"
                            xmlns="http://www.w3.org/2000/svg"
                            width={18}
                            height={18}
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
                            <CopyIcon ref={iconRef} size={18} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </button>
            <div style={{ position: 'relative', display: 'inline-block' }}>
                <button
                    className={`copy-message-button ${isGenerating ? 'generating-audio' : ''}`}
                    onClick={handleVoiceToggle}
                    title={isGenerating ? 'Generating audio...' : isReading ? 'Stop reading' : 'Read message'}
                    aria-label={isGenerating ? 'Generating audio...' : isReading ? 'Stop reading' : 'Read message'}
                    style={{ marginLeft: '8px' }}
                    disabled={isGenerating}
                >
                    <motion.div
                        animate={isGenerating ? {
                            opacity: [0.4, 1, 0.4],
                            scale: [0.95, 1.05, 0.95],
                        } : {}}
                        transition={isGenerating ? {
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeInOut"
                        } : {}}
                    >
                        {isReading ? (
                            <AudioLinesIcon ref={audioIconRef} size={18} />
                        ) : (
                            <AnimatedVolumeIcon size={18} />
                        )}
                    </motion.div>
                </button>
                <AnimatePresence>
                    {showTooltip && (
                        <motion.div
                            className="audio-generating-tooltip"
                            initial={{ opacity: 0, y: 5, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -5, scale: 0.9 }}
                            transition={{ duration: 0.2 }}
                        >
                            Generating audio...
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
