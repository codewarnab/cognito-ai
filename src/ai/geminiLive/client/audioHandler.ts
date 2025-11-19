/**
 * Audio Handler for Gemini Live Client
 * Coordinates audio capture and playback
 */

import { AudioManager } from '../audioManager';
import { AUDIO_CONFIG } from '../types';
import { createLogger } from '@logger';

const log = createLogger('AudioHandler');

export interface AudioHandlerCallbacks {
    onUserSpeakingChange?: (isSpeaking: boolean) => void;
    onStatusChange?: (status: string) => void;
}

export class GeminiLiveAudioHandler {
    private isCapturing = false;

    constructor(
        private audioManager: AudioManager,
        private callbacks: AudioHandlerCallbacks = {}
    ) { }

    /**
     * Start audio capture and streaming
     */
    startCapture(onAudioData: (base64Data: string) => void): void {
        if (this.isCapturing) {
            log.warn('Audio capture already active - skipping start');
            return;
        }

        log.info('Starting audio capture...');

        this.audioManager.startCapture(onAudioData);

        this.isCapturing = true;

        if (this.callbacks.onUserSpeakingChange) {
            this.callbacks.onUserSpeakingChange(true);
        }
        if (this.callbacks.onStatusChange) {
            this.callbacks.onStatusChange('Listening...');
        }

        log.info('Audio capture started');
    }

    /**
     * Stop audio capture
     */
    stopCapture(): void {
        if (!this.isCapturing) {
            return;
        }

        log.info('Stopping audio capture...');

        this.audioManager.stopCapture();
        this.isCapturing = false;

        if (this.callbacks.onUserSpeakingChange) {
            this.callbacks.onUserSpeakingChange(false);
        }

        log.info('Audio capture stopped');
    }

    /**
     * Check if currently capturing
     */
    isCaptureActive(): boolean {
        return this.isCapturing;
    }

    /**
     * Get audio configuration
     */
    getAudioConfig() {
        return AUDIO_CONFIG;
    }

    /**
     * Get audio manager for external access
     */
    getAudioManager(): AudioManager {
        return this.audioManager;
    }
}
