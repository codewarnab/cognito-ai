/**
 * Sound Notification Utility
 * Handles playing notification sounds with autoplay policy workaround
 */

import { AUDIO_PATHS, AUDIO_CONFIG } from '../constants/audio';
import { createLogger } from '@logger';

const soundLog = createLogger('Sound', 'NOTIFICATIONS');

// Memoized audio instance
let audioInstance: HTMLAudioElement | null = null;
let lastPlayTime = 0;
let isInitialized = false;

/**
 * Initialize notification sound on first user interaction
 * This unlocks autoplay by playing a silent audio first
 */
export const initializeNotificationSound = async (): Promise<void> => {
    if (isInitialized) {
        return;
    }

    try {
        // Create and play a silent audio to unlock autoplay
        const silentAudio = new Audio();
        silentAudio.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhAC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAA4T8JROkAAAAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZDwP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';
        silentAudio.volume = 0.01;

        // Try to play silent audio
        await silentAudio.play();

        // Preload the actual notification sound
        audioInstance = new Audio();
        // Use chrome.runtime.getURL to get the correct path for extension resources
        const audioPath = chrome.runtime?.getURL
            ? chrome.runtime.getURL(AUDIO_PATHS.NOTIFICATION)
            : AUDIO_PATHS.NOTIFICATION;

        soundLog.debug('Loading audio from path:', audioPath);
        audioInstance.src = audioPath;
        audioInstance.volume = AUDIO_CONFIG.DEFAULT_VOLUME;
        audioInstance.preload = 'auto';

        // Wait for audio to be loadable (but don't block initialization)
        audioInstance.addEventListener('canplaythrough', () => {
            soundLog.debug('Audio loaded and ready to play');
        }, { once: true });

        // Also handle load errors
        audioInstance.addEventListener('error', (e) => {
            soundLog.error('Audio load error:', e, 'Attempted path:', audioPath);
        }, { once: true });

        isInitialized = true;
        soundLog.info('Notification sound initialized successfully');
    } catch (error) {
        soundLog.warn('Failed to initialize notification sound:', error);
        // Don't throw - graceful degradation if sound can't be initialized
    }
};

/**
 * Play notification sound with debouncing
 * @param volume Optional volume override (0.0 to 1.0)
 * @returns Promise that resolves when sound starts playing (or fails gracefully)
 */
export const playNotificationSound = async (volume?: number): Promise<void> => {
    try {
        // Debouncing: Prevent multiple plays within short time
        const now = Date.now();
        if (now - lastPlayTime < AUDIO_CONFIG.DEBOUNCE_MS) {
            soundLog.debug('Debounced - too soon since last play');
            return;
        }
        lastPlayTime = now;

        // Initialize if not already done (fallback)
        if (!isInitialized || !audioInstance) {
            soundLog.warn('Audio not initialized, attempting to initialize now');
            await initializeNotificationSound();

            // If still not initialized, fail gracefully
            if (!audioInstance) {
                soundLog.warn('Cannot play sound - initialization failed');
                return;
            }
        }

        // Set volume if provided
        if (volume !== undefined && volume >= 0 && volume <= 1) {
            audioInstance.volume = volume;
        }

        // Reset audio to beginning (in case it was played before)
        audioInstance.currentTime = 0;

        // Play the sound
        await audioInstance.play();
        soundLog.debug('Notification sound played');
    } catch (error) {
        // Handle autoplay blocked or other errors gracefully
        if (error instanceof Error) {
            if (error.name === 'NotAllowedError') {
                soundLog.warn('Autoplay blocked by browser policy');
            } else if (error.name === 'NotSupportedError') {
                soundLog.warn('Audio format not supported');
            } else {
                soundLog.warn('Failed to play notification sound:', error.message);
            }
        } else {
            soundLog.warn('Failed to play notification sound:', error);
        }
        // Don't throw - app should continue working even if sound fails
    }
};

/**
 * Set volume for notification sound
 * @param volume Volume level (0.0 to 1.0)
 */
export const setNotificationVolume = (volume: number): void => {
    if (volume < 0 || volume > 1) {
        soundLog.warn('Invalid volume level:', volume);
        return;
    }

    if (audioInstance) {
        audioInstance.volume = volume;
        soundLog.debug('Volume set to:', volume);
    }
};

/**
 * Check if notification sound is initialized
 */
export const isNotificationSoundReady = (): boolean => {
    return isInitialized && audioInstance !== null;
};

/**
 * Clean up audio resources (call on unmount if needed)
 */
export const cleanupNotificationSound = (): void => {
    if (audioInstance) {
        audioInstance.pause();
        audioInstance.src = '';
        audioInstance = null;
    }
    isInitialized = false;
    soundLog.debug('Notification sound cleaned up');
};
