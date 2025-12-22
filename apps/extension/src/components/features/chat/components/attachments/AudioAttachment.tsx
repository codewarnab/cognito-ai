import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Play, Pause } from 'lucide-react';
import { truncateFileName } from '@/utils/files';
import type { FileAttachmentData } from './FileAttachment';

interface AudioAttachmentProps {
    attachment: FileAttachmentData;
    onRemove: (id: string) => void;
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
 * Creates a pseudo-random but deterministic pattern
 */
function generateWaveformPattern(fileName: string, barCount: number = 30): number[] {
    // Use simple hash of filename for consistent pattern
    let hash = 0;
    for (let i = 0; i < fileName.length; i++) {
        hash = ((hash << 5) - hash) + fileName.charCodeAt(i);
        hash = hash & hash;
    }

    return Array.from({ length: barCount }, (_, idx) => {
        // Create varied heights using sine waves and hash
        const seed = (hash + idx * 7919) % 1000;
        const normalized = seed / 1000;
        const height = 4 + normalized * 16; // Heights between 4-20px
        return height;
    });
}

export const AudioAttachment: React.FC<AudioAttachmentProps> = ({ attachment, onRemove }) => {
    const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(attachment.duration || 0);
    const waveformRef = useRef<HTMLDivElement>(null);

    // Generate consistent waveform pattern
    const waveformBars = useMemo(
        () => generateWaveformPattern(attachment.file.name),
        [attachment.file.name]
    );

    // Initialize audio element
    useEffect(() => {
        if (!attachment.preview) return;

        const audioElement = new Audio(attachment.preview);
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
            }
        };

        const handleEnded = () => {
            setIsPlaying(false);
            setProgress(0);
            setCurrentTime(0);
        };

        audioElement.addEventListener('timeupdate', handleTimeUpdate);
        audioElement.addEventListener('loadedmetadata', handleLoadedMetadata);
        audioElement.addEventListener('ended', handleEnded);

        return () => {
            audioElement.removeEventListener('timeupdate', handleTimeUpdate);
            audioElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audioElement.removeEventListener('ended', handleEnded);
            audioElement.pause();
            audioElement.src = '';
        };
    }, [attachment.preview]);

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
        if (!audio || !waveformRef.current) return;

        const rect = waveformRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;

        audio.currentTime = percentage * audio.duration;
        setProgress(percentage * 100);
    }, [audio]);

    // Display duration - prefer loaded duration, fallback to attachment duration
    const displayDuration = duration || attachment.duration || 0;
    const displayTime = isPlaying ? currentTime : displayDuration;

    return (
        <div className="relative rounded-[10px] overflow-hidden bg-[rgba(30,40,60,0.6)] border-[1.5px] border-[rgba(100,120,150,0.3)] transition-all duration-200 shadow-[0_2px_8px_rgba(0,0,0,0.3)] hover:bg-[rgba(40,50,70,0.7)] hover:border-[rgba(120,140,170,0.5)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.4)] hover:-translate-y-px group/audio">
            <div className="flex items-center gap-3 py-2 px-3 min-w-[200px] max-w-[280px] relative bg-[rgba(35,45,65,0.7)]">
                {/* Play/Pause Button */}
                <button
                    type="button"
                    onClick={togglePlay}
                    className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center cursor-pointer text-white/90 transition-all duration-200 hover:bg-white/20 hover:scale-105 shrink-0"
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                    {isPlaying ? (
                        <Pause size={14} fill="currentColor" />
                    ) : (
                        <Play size={14} fill="currentColor" className="ml-0.5" />
                    )}
                </button>

                {/* Waveform */}
                <div
                    ref={waveformRef}
                    className="flex-1 h-6 relative cursor-pointer flex items-center justify-between gap-[2px]"
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
                                        ? 'rgba(255, 255, 255, 0.9)'
                                        : 'rgba(255, 255, 255, 0.3)',
                                }}
                            />
                        );
                    })}
                </div>

                {/* Duration */}
                <span className="text-[11px] font-mono text-white/70 shrink-0 min-w-[32px] text-right">
                    {formatDuration(displayTime)}
                </span>

                {/* Remove Button */}
                <button
                    type="button"
                    className="w-5 h-5 rounded-full flex items-center justify-center cursor-pointer text-white/60 opacity-60 transition-all duration-200 p-0 group-hover/audio:opacity-100 hover:bg-[rgba(255,50,50,0.3)] hover:text-white/95 hover:!opacity-100 shrink-0"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (audio) {
                            audio.pause();
                            audio.src = '';
                        }
                        onRemove(attachment.id);
                    }}
                    aria-label="Remove audio attachment"
                >
                    <X size={14} />
                </button>
            </div>

            {/* File name tooltip on hover */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black/80 rounded text-[10px] text-white/80 whitespace-nowrap opacity-0 pointer-events-none group-hover/audio:opacity-100 transition-opacity duration-200 z-10">
                {truncateFileName(attachment.file.name, 30)}
            </div>
        </div>
    );
};
