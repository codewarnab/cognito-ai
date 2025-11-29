import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from '@/components/shared/icons/XIcon';
import { createLogger } from '~logger';
import { fetchTranscriptDirect, processTranscriptForAI } from '@/ai/agents/youtubeToNotion/transcript';
import type { ProcessFileOptions } from '@/hooks/attachments/useFileAttachments';

const log = createLogger('AddYouTubeVideoModal');

/**
 * Regex pattern to validate YouTube URLs
 * Matches: youtube.com/watch?v=VIDEO_ID or youtu.be/VIDEO_ID
 */
const YOUTUBE_URL_PATTERN = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;

interface AddYouTubeVideoModalProps {
    isOpen: boolean;
    onClose: () => void;
    processFiles: (files: ProcessFileOptions[]) => Promise<void>;
    onError?: (message: string, type?: 'error' | 'warning' | 'info') => void;
}

export const AddYouTubeVideoModal: React.FC<AddYouTubeVideoModalProps> = ({
    isOpen,
    onClose,
    processFiles,
    onError,
}) => {
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when modal opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        } else {
            setUrl('');
            setValidationError(null);
            setIsLoading(false);
        }
    }, [isOpen]);

    // Handle click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                if (!isLoading) onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose, isLoading]);


    const validateUrl = (inputUrl: string): boolean => {
        if (!inputUrl.trim()) {
            setValidationError('Please enter a YouTube URL');
            return false;
        }
        if (!YOUTUBE_URL_PATTERN.test(inputUrl)) {
            setValidationError('Invalid YouTube URL. Use youtube.com/watch?v=... or youtu.be/...');
            return false;
        }
        setValidationError(null);
        return true;
    };

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newUrl = e.target.value;
        setUrl(newUrl);
        if (validationError && newUrl.trim()) {
            setValidationError(null);
        }
    };

    const handleSubmit = async () => {
        if (!validateUrl(url)) return;

        setIsLoading(true);
        log.info('Fetching YouTube transcript', { url });

        try {
            const transcriptEntry = await fetchTranscriptDirect(url);

            // Check if transcript fetch failed
            if (transcriptEntry.transcript.startsWith('⚠️')) {
                onError?.(transcriptEntry.transcript.replace('⚠️ ', ''), 'error');
                setIsLoading(false);
                return;
            }

            // Create transcript text - use compact format if segments available
            let transcriptText: string;
            
            if (transcriptEntry.segments && transcriptEntry.segments.length > 0) {
                const processed = processTranscriptForAI(transcriptEntry);
                const segmentsJson = JSON.stringify(processed.segments);
                
                transcriptText = `[YOUTUBE VIDEO TRANSCRIPT]
Title: ${processed.title}
Author: ${processed.author || 'Unknown'}
Video URL: ${transcriptEntry.videoUrl}
Duration: ${processed.durationSeconds ? `${Math.floor(processed.durationSeconds / 60)}m ${processed.durationSeconds % 60}s` : 'Unknown'}
Language: ${processed.language || 'en'}

IMPORTANT: This is a YouTube video transcript. Do NOT use the getYouTubeTranscript tool to fetch the transcript again.
Answer questions based ONLY on this transcript content provided below.
Format: Compact segments with {t: text, s: startSeconds}. Reference timestamps when user needs to verify specific parts.

--- SEGMENTS ---
${segmentsJson}`;
            } else {
                transcriptText = `[YOUTUBE VIDEO TRANSCRIPT]
Title: ${transcriptEntry.title}
Video URL: ${transcriptEntry.videoUrl}
Duration: ${transcriptEntry.durationSeconds ? `${Math.floor(transcriptEntry.durationSeconds / 60)}m ${transcriptEntry.durationSeconds % 60}s` : 'Unknown'}

IMPORTANT: This is a YouTube video transcript. Do NOT use the getYouTubeTranscript tool to fetch the transcript again. 
Answer questions based ONLY on this transcript content provided below.

--- TRANSCRIPT START ---

${transcriptEntry.transcript}

--- TRANSCRIPT END ---`;
            }

            // Create file with transcript
            const blob = new Blob([transcriptText], { type: 'text/plain' });
            const cleanTitle = (transcriptEntry.title || 'YouTube Video')
                .replace(/[^a-z0-9\s]/gi, '')
                .trim()
                .replace(/\s+/g, '_')
                .substring(0, 24);
            const filename = `${cleanTitle}_yt.txt`;
            const file = new File([blob], filename, {
                type: 'text/plain',
                lastModified: Date.now(),
            });

            log.info('Created transcript file', {
                filename,
                size: file.size,
                transcriptLength: transcriptEntry.transcript.length,
            });

            await processFiles([{
                file,
                meta: {
                    source: 'youtube',
                    thumbnailUrl: transcriptEntry.thumbnail,
                    author: transcriptEntry.author,
                    durationSeconds: transcriptEntry.durationSeconds,
                    videoUrl: transcriptEntry.videoUrl,
                },
            }]);

            const displayTitle = (transcriptEntry.title || 'Video').length > 30
                ? (transcriptEntry.title || 'Video').substring(0, 30) + '...'
                : transcriptEntry.title || 'Video';
            onError?.(`Attached transcript for "${displayTitle}"`, 'info');
            onClose();
        } catch (error) {
            log.error('Error fetching YouTube transcript', error);
            onError?.('Failed to fetch video transcript. Please try again.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isLoading) {
            e.preventDefault();
            handleSubmit();
        }
        if (e.key === 'Escape' && !isLoading) {
            onClose();
        }
    };

    if (!isOpen) return null;


    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000,
                    padding: '20px',
                }}
            >
                <motion.div
                    ref={modalRef}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    style={{
                        backgroundColor: 'var(--modal-bg, #1e293b)',
                        borderRadius: '12px',
                        width: '100%',
                        maxWidth: '420px',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
                        border: '1px solid var(--modal-border, #334155)',
                    }}
                >
                    {/* Header */}
                    <div style={{
                        padding: '16px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}>
                        <h2 style={{
                            margin: 0,
                            fontSize: '18px',
                            fontWeight: 600,
                            color: 'var(--text-primary, #e2e8f0)',
                        }}>
                            Add YouTube Video
                        </h2>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            aria-label="Close modal"
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '4px',
                                color: 'var(--text-secondary, #94a3b8)',
                                opacity: isLoading ? 0.5 : 1,
                                transition: 'background-color 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                                if (!isLoading) {
                                    e.currentTarget.style.backgroundColor = 'var(--hover-bg, #334155)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                        >
                            <XIcon size={18} />
                        </button>
                    </div>

                    {/* Input */}
                    <div style={{ padding: '0 20px 20px 20px' }}>
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Paste YouTube URL (e.g., youtube.com/watch?v=...)"
                            value={url}
                            onChange={handleUrlChange}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading}
                            style={{
                                width: '100%',
                                padding: '12px 14px',
                                backgroundColor: 'var(--input-bg, #0f172a)',
                                border: `1px solid ${validationError ? 'var(--error-color, #ef4444)' : 'var(--input-border, #334155)'}`,
                                borderRadius: '8px',
                                color: 'var(--text-primary, #e2e8f0)',
                                fontSize: '14px',
                                outline: 'none',
                                opacity: isLoading ? 0.7 : 1,
                            }}
                        />
                        {validationError && (
                            <div style={{
                                marginTop: '8px',
                                fontSize: '12px',
                                color: 'var(--error-color, #ef4444)',
                            }}>
                                {validationError}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isLoading || !url.trim()}
                            style={{
                                width: '100%',
                                marginTop: '16px',
                                padding: '12px',
                                backgroundColor: (isLoading || !url.trim())
                                    ? 'var(--button-disabled-bg, #475569)'
                                    : 'var(--primary-color, #3b82f6)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: (isLoading || !url.trim()) ? 'not-allowed' : 'pointer',
                                opacity: (isLoading || !url.trim()) ? 0.6 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                                if (!isLoading && url.trim()) {
                                    e.currentTarget.style.backgroundColor = 'var(--primary-hover, #2563eb)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isLoading && url.trim()) {
                                    e.currentTarget.style.backgroundColor = 'var(--primary-color, #3b82f6)';
                                }
                            }}
                        >
                            {isLoading ? (
                                <>
                                    <LoadingSpinner />
                                    Fetching transcript...
                                </>
                            ) : (
                                'Add Video'
                            )}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};


const LoadingSpinner: React.FC = () => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        style={{ animation: 'spin 1s linear infinite' }}
    >
        <style>{`
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `}</style>
        <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="31.4 31.4"
            opacity="0.3"
        />
        <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="31.4 31.4"
            strokeDashoffset="23.55"
        />
    </svg>
);
