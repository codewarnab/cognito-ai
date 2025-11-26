import React, { useEffect, useState, useRef } from 'react';
import { Volume2, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { createLogger } from '~logger';
import { getVoiceName, setVoiceName } from '@/utils/settings';
import type { VoiceName } from '@/types/settings';
import { generateSpeech, playAudioBuffer } from '@/utils/ai';
import { useApiKey } from '../../../../hooks/useApiKey';
import AnimatedVolumeIcon from '@assets/icons/ui/volume-icon';
import { AudioLinesIcon, type AudioLinesIconHandle } from '@assets/icons/ui/audio-lines';

const log = createLogger('VoiceSettings');

const VOICE_OPTIONS: VoiceName[] = ['Aoede', 'Orus', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Orion'];

export const VoiceSettings: React.FC = () => {
    const [voice, setVoice] = useState<VoiceName>('Aoede');
    const [isPlayingVoice, setIsPlayingVoice] = useState(false);
    const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
    const audioIconRef = useRef<AudioLinesIconHandle>(null);
    const apiKey = useApiKey();

    useEffect(() => {
        const loadVoice = async () => {
            try {
                const currentVoice = await getVoiceName();
                setVoice(currentVoice);
            } catch (err) {
                log.error('Failed to load voice settings', err);
            }
        };
        loadVoice();
    }, []);

    const handleVoiceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value as VoiceName;
        const previousVoice = voice;
        setVoice(value);
        try {
            await setVoiceName(value);
        } catch (err) {
            log.error('Failed to save voice preference', err);
            setVoice(previousVoice);
            // TODO: Show user-facing error notification
        }
    };

    const handlePreviewVoice = async () => {
        if (isPlayingVoice || isGeneratingVoice || !apiKey) return;

        try {
            setIsGeneratingVoice(true);
            const text = "Hello! I am your AI assistant. This is how I sound.";
            const audioBuffer = await generateSpeech(text, apiKey, { voiceName: voice });

            setIsGeneratingVoice(false);
            setIsPlayingVoice(true);

            const audio = playAudioBuffer(audioBuffer);

            audio.onplay = () => {
                audioIconRef.current?.startAnimation();
            };

            audio.onended = () => {
                setIsPlayingVoice(false);
                audioIconRef.current?.stopAnimation();
            };

            audio.onerror = () => {
                setIsPlayingVoice(false);
                audioIconRef.current?.stopAnimation();
            };
        } catch (error) {
            log.error('Failed to preview voice', error);
            setIsGeneratingVoice(false);
            setIsPlayingVoice(false);
        }
    };

    return (
        <div className="settings-section">
            <div className="settings-section-header">
                <h2 className="settings-section-title">
                    <Volume2 size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
                    Voice Mode
                </h2>
            </div>
            <div className="settings-card">
                <div className="settings-item voice-settings-item">
                    <div className="settings-item-content">
                        <div className="settings-item-title">Voice for Gemini Live</div>
                        <div className="settings-item-description">Select the voice persona for AI responses</div>
                    </div>
                    <div className="voice-control-group">
                        <button
                            className={`voice-preview-btn ${isGeneratingVoice ? 'generating' : ''} ${isPlayingVoice ? 'playing' : ''}`}
                            onClick={handlePreviewVoice}
                            disabled={isPlayingVoice || isGeneratingVoice || !apiKey}
                            title={!apiKey ? "API Key required" : isGeneratingVoice ? "Generating..." : isPlayingVoice ? "Playing..." : "Preview Voice"}
                        >
                            <motion.div
                                animate={isGeneratingVoice ? {
                                    opacity: [0.4, 1, 0.4],
                                    scale: [0.95, 1.05, 0.95],
                                } : {}}
                                transition={isGeneratingVoice ? {
                                    duration: 1.5,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                } : {}}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                {isPlayingVoice ? (
                                    <AudioLinesIcon ref={audioIconRef} size={18} />
                                ) : (
                                    <AnimatedVolumeIcon size={18} />
                                )}
                            </motion.div>
                        </button>
                        <div className="voice-select-wrapper">
                            <select
                                className="settings-select voice-select"
                                value={voice}
                                onChange={handleVoiceChange}
                                disabled={isPlayingVoice || isGeneratingVoice}
                            >
                                {VOICE_OPTIONS.map(v => (
                                    <option key={v} value={v}>{v}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="voice-select-arrow" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
