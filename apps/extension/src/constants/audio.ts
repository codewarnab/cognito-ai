/**
 * Audio constants for notification sounds
 */

export const AUDIO_PATHS = {
    NOTIFICATION: 'sweep1.mp3', // Plasmo will handle the path from public folder
} as const;

export const AUDIO_CONFIG = {
    DEFAULT_VOLUME: 0.7,
    DEBOUNCE_MS: 500,
    SILENT_AUDIO_DURATION: 0.1, // 100ms silent audio for autoplay unlock
} as const;
