import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Play, Pause } from 'lucide-react';

interface AudioMessagePlayerProps {
    url: string;
    name?: string;
}

/**
 * Format seconds to mm:ss display
 */
function formatDuration(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Generate a consistent waveform pattern based on file name
 */
function generateWaveformPattern(fileName: string, barCount: number = 25): number[] {
    let hash = 0;
    for (let i = 0; i < fileName.length; i++) {
        hash = ((hash << 5) - hash) + fileName.charCodeAt(i);
        hash = hash & hash;
    }

    return Array.from({ length: barCount }, (_, idx) => {
        const seed = (hash + idx * 7919) % 1000;
        const normalized = seed / 1000;
        const height = 4 + normalized * 14; // Heights between 4-18px
        return height;
    });
}

/**
 * Audio player component for message bubbles in chat history
 * Compact version with play/pause, waveform, and duration
 */
export const AudioMessagePlayer: React.FC<AudioMessagePlayerProps> = ({ url, name = 'audio' }) => {
    const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);
    const waveformRef = useRef<HTMLDivElement>(null);

    // Generate consistent waveform pattern
    const waveformBars = useMemo(
        () => generateWaveformPattern(name),
        [name]
    );

    // Initialize audio element
    useEffect(() => {
        if (!url) return;

        const audioElement = new Audio(url);
        setAudio(audioElement);

        const handleTimeUpdate = () => {
            if (audioElement.duration) {
                setProgress((audioElement.currentTime / audioElement.duration) * 100);
                setCurrentTime(audioElement.currentTime);
            }
        };

        const handleLoadedMetadata = () => {
            if (audioElement.duration && isFinite(audioElement.duration)) {
                setDuration(audioElement.duration);
                setIsLoaded(true);
            }
        };

        const handleEnded = () => {
            setIsPlaying(false);
            setProgress(0);
            setCurrentTime(0);
        };

        const handleCanPlay = () => {
            setIsLoaded(true);
        };

        audioElement.addEventListener('timeupdate', handleTimeUpdate);
        audioElement.addEventListener('loadedmetadata', handleLoadedMetadata);
        audioElement.addEventListener('ended', handleEnded);
        audioElement.addEventListener('canplay', handleCanPlay);

        return () => {
            audioElement.removeEventListener('timeupdate', handleTimeUpdate);
            audioElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audioElement.removeEventListener('ended', handleEnded);
            audioElement.removeEventListener('canplay', handleCanPlay);
            audioElement.pause();
            audioElement.src = '';
        };
    }, [url]);

    // Toggle play/pause
    const togglePlay = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
        } else {
            audio.play().catch(console.error);
        }
        setIsPlaying(!isPlaying);
    }, [audio, isPlaying]);

    // Seek on waveform click
    const handleWaveformClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        if (!audio || !waveformRef.current || !isLoaded) return;

        const rect = waveformRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;

        audio.currentTime = percentage * audio.duration;
        setProgress(percentage * 100);
    }, [audio, isLoaded]);

    // Display time
    const displayTime = isPlaying ? currentTime : duration;

    return (
        <div
            className="inline-flex items-center gap-2.5 px-3 py-2 bg-black/30 rounded-lg border border-white/20 min-w-[180px] max-w-[250px]"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Play/Pause Button */}
            <button
                type="button"
                onClick={togglePlay}
                disabled={!isLoaded}
                className="w-7 h-7 rounded-full bg-white border-none flex items-center justify-center cursor-pointer text-blue-600 transition-all duration-200 hover:bg-white/90 hover:scale-105 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={isPlaying ? 'Pause' : 'Play'}
            >
                {isPlaying ? (
                    <Pause size={12} fill="currentColor" />
                ) : (
                    <Play size={12} fill="currentColor" className="ml-0.5" />
                )}
            </button>

            {/* Waveform */}
            <div
                ref={waveformRef}
                className="flex-1 h-5 relative cursor-pointer flex items-center justify-between gap-[1px]"
                onClick={handleWaveformClick}
            >
                {waveformBars.map((height, idx) => {
                    const barProgress = (idx / waveformBars.length) * 100;
                    const isActive = barProgress < progress;

                    return (
                        <div
                            key={idx}
                            className="rounded-sm transition-colors duration-100"
                            style={{
                                width: 2,
                                height: `${height}px`,
                                backgroundColor: isActive
                                    ? 'rgba(255, 255, 255, 0.95)'
                                    : 'rgba(255, 255, 255, 0.35)',
                            }}
                        />
                    );
                })}
            </div>

            {/* Duration */}
            <span className="text-[10px] font-mono text-white/80 shrink-0 min-w-[28px] text-right">
                {formatDuration(displayTime)}
            </span>
        </div>
    );
};
