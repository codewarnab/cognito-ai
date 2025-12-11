import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AnimatedVolumeIcon from '@assets/icons/ui/volume-icon';
import { AudioLinesIcon, type AudioLinesIconHandle } from '@assets/icons/ui/audio-lines';
import { generateSpeech, playAudioBuffer } from '@/utils/ai/geminiTTS';
import { getGoogleApiKey } from '@/utils/credentials';
import { getTTSProvider } from '@/utils/settings';
import type { TTSProvider } from '~types/settings';

interface VoiceButtonProps {
    content: string;
    onAudioBufferChange?: (buffer: ArrayBuffer | null) => void;
    onPlayingStateChange?: (isPlaying: boolean) => void;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({ 
    content, 
    onAudioBufferChange,
    onPlayingStateChange 
}) => {
    const [isReading, setIsReading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const [audioBuffer, setAudioBuffer] = useState<ArrayBuffer | null>(null);
    const [ttsProvider, setTtsProvider] = useState<TTSProvider>('gemini');
    const audioIconRef = useRef<AudioLinesIconHandle>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Load TTS provider setting
    useEffect(() => {
        const loadTTSProvider = async () => {
            try {
                const provider = await getTTSProvider();
                setTtsProvider(provider);
            } catch (err) {
                console.error('Failed to load TTS provider setting:', err);
            }
        };
        loadTTSProvider();
    }, []);

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

    // Notify parent of audio buffer changes
    useEffect(() => {
        onAudioBufferChange?.(audioBuffer);
    }, [audioBuffer, onAudioBufferChange]);

    // Notify parent of playing state changes
    useEffect(() => {
        onPlayingStateChange?.(isReading);
    }, [isReading, onPlayingStateChange]);

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

    const handleVoiceToggle = async () => {
        if (isReading) {
            // Stop reading
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            // Stop web speech synthesis if active
            if (window.speechSynthesis.speaking) {
                window.speechSynthesis.cancel();
            }
            setIsReading(false);
            setAudioBuffer(null);
            audioIconRef.current?.stopAnimation();
        } else {
            // Start reading based on TTS provider setting
            if (!content || isGenerating) return;

            // Use web-native TTS if selected
            if (ttsProvider === 'web-native') {
                fallbackToSpeechSynthesis();
                return;
            }

            // Use Gemini TTS
            try {
                setIsGenerating(true);
                
                // Show tooltip briefly
                setShowTooltip(true);
                tooltipTimeoutRef.current = setTimeout(() => {
                    setShowTooltip(false);
                }, 1000);
                
                // Get API key
                const apiKey = await getGoogleApiKey();
                if (!apiKey) {
                    console.error('No Gemini API key found. Please configure in settings.');
                    setShowTooltip(false);
                    // Fallback to browser TTS
                    fallbackToSpeechSynthesis();
                    return;
                }

                // Generate speech using Gemini TTS
                const buffer = await generateSpeech(content, apiKey);
                setAudioBuffer(buffer);
                
                // Play the audio
                const audio = playAudioBuffer(buffer);
                audioRef.current = audio;

                audio.onplay = () => {
                    setIsReading(true);
                    setIsGenerating(false);
                    audioIconRef.current?.startAnimation();
                };

                audio.onended = () => {
                    setIsReading(false);
                    audioRef.current = null;
                    setAudioBuffer(null);
                    audioIconRef.current?.stopAnimation();
                };

                audio.onerror = () => {
                    setIsReading(false);
                    setIsGenerating(false);
                    audioRef.current = null;
                    setAudioBuffer(null);
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

    return (
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
    );
};
