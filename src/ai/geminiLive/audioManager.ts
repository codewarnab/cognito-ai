/**
 * AudioManager - Handles audio capture and playback for Gemini Live API
 * 
 * Architecture:
 * - Input: 16kHz AudioContext for microphone capture
 * - Output: 24kHz AudioContext for AI voice playback
 * - Uses ScriptProcessorNode for audio processing (4096 buffer)
 * - Provides AnalyserNodes for visualization
 */

import { createLogger } from '~logger';
import { requestMicrophoneWithUI, diagnoseMicrophoneAccess } from '../../audio/micPermission';

const log = createLogger('AudioManager');

export interface AudioCaptureOptions {
    sampleRate?: number; // Default: 16000 (Gemini Live requirement)
    channels?: number;   // Default: 1 (mono)
    bufferSize?: number; // Default: 4096
}

export interface AudioPlaybackOptions {
    sampleRate?: number; // Default: 24000 (Gemini Live output)
    channels?: number;   // Default: 1 (mono)
}

export interface AudioDataCallback {
    (pcmData: string): void; // Base64-encoded PCM data
}

/**
 * Analyser wrapper for frequency data extraction
 */
export class Analyser {
    private analyserNode: AnalyserNode;
    public data: Uint8Array;

    constructor(sourceNode: AudioNode, fftSize: number = 32) {
        // Create analyser node from source's context
        this.analyserNode = sourceNode.context.createAnalyser();
        this.analyserNode.fftSize = fftSize;
        this.data = new Uint8Array(this.analyserNode.frequencyBinCount);

        // Connect source to analyser (analyser is pass-through)
        sourceNode.connect(this.analyserNode);

        log.debug('Analyser created', { fftSize, frequencyBinCount: this.analyserNode.frequencyBinCount });
    }

    /**
     * Update frequency data array
     */
    update(): void {
        // Web Audio API type compatibility - Uint8Array buffer type mismatch
        this.analyserNode.getByteFrequencyData(this.data as any);
    }

    /**
     * Get the analyser node for additional connections
     */
    getNode(): AnalyserNode {
        return this.analyserNode;
    }

    /**
     * Disconnect and cleanup
     */
    disconnect(): void {
        this.analyserNode.disconnect();
    }
}

/**
 * AudioCapture - Handles microphone input at 16kHz
 */
export class AudioCapture {
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private sourceNode: MediaStreamAudioSourceNode | null = null;
    private processorNode: ScriptProcessorNode | null = null;
    private gainNode: GainNode | null = null;
    private analyser: Analyser | null = null;
    private isCapturing = false;
    private onDataCallback: AudioDataCallback | null = null;

    /**
     * Initialize audio capture
     */
    async initialize(options: AudioCaptureOptions = {}): Promise<GainNode> {
        const sampleRate = options.sampleRate || 16000;
        const channels = options.channels || 1;
        const bufferSize = options.bufferSize || 4096;

        log.info('Initializing audio capture', { sampleRate, channels, bufferSize });

        // Run diagnostics first to provide better error messages
        const diagnostics = await diagnoseMicrophoneAccess();
        log.info('Microphone diagnostics:', diagnostics);

        if (diagnostics.errors.length > 0) {
            log.warn('Potential microphone access issues detected:', diagnostics.errors);
        }

        // Request microphone permission
        const permissionResult = await requestMicrophoneWithUI();
        if (!permissionResult.granted) {
            const error = permissionResult.error || 'Microphone permission denied';
            log.error('Microphone permission failed', {
                error,
                errorType: permissionResult.errorType,
                diagnostics
            });

            // Provide more detailed error message based on diagnostics
            let detailedError = error;
            if (!diagnostics.hasGetUserMedia) {
                detailedError += '\n\ngetUserMedia API is not available. Make sure you are using a compatible browser.';
            }
            if (!diagnostics.isSecureContext) {
                detailedError += '\n\nPage must be served over HTTPS or from an extension context.';
            }
            if (diagnostics.permissionState === 'denied') {
                detailedError += '\n\nTo fix: Go to chrome://extensions → Find this extension → Details → Permissions → Enable microphone access.';
            }

            throw new Error(detailedError);
        }

        // Create audio context with specified sample rate
        this.audioContext = new AudioContext({ sampleRate });

        // Resume context if suspended
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        // Get microphone stream
        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: channels,
                    sampleRate,
                    echoCancellation: true,   // Prevent capturing audio from speakers/system
                    noiseSuppression: true,   // Remove background noise
                    autoGainControl: true,    // Normalize voice levels
                }
            });
        } catch (error) {
            log.error('Failed to get microphone stream', error);

            // Provide specific error message based on the error type
            const err = error as DOMException;
            let errorMessage = 'Failed to access microphone: ' + err.message;

            if (err.name === 'NotAllowedError') {
                errorMessage = 'Microphone access was denied. Please click "Allow" when prompted, or enable microphone permissions in your browser settings.\n\n';
                errorMessage += '1. Check extension permissions: chrome://extensions → Find this extension → Details → Permissions\n';
                errorMessage += '2. Check site permissions: Click lock icon in address bar → Site settings → Microphone';
            } else if (err.name === 'NotFoundError') {
                errorMessage = 'No microphone found. Please connect a microphone and try again.';
            } else if (err.name === 'NotReadableError') {
                errorMessage = 'Microphone is already in use by another application. Please close other apps using the microphone.';
            }

            throw new Error(errorMessage);
        }

        // Create media stream source
        this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

        // Create gain node for volume control
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = 1.0;

        // Create analyser for visualization
        this.analyser = new Analyser(this.gainNode, 32);

        // Create script processor for audio processing
        this.processorNode = this.audioContext.createScriptProcessor(bufferSize, channels, channels);

        // Setup audio processing callback
        this.processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
            if (!this.isCapturing || !this.onDataCallback) {
                return;
            }

            const inputBuffer = event.inputBuffer;
            const inputData = inputBuffer.getChannelData(0); // Get first channel (mono)

            // Convert Float32Array (-1 to 1) to Int16Array (-32768 to 32767)
            const int16Data = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                const s = Math.max(-1, Math.min(1, inputData[i] ?? 0));
                int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }

            // Convert to Uint8Array for base64 encoding
            const uint8Data = new Uint8Array(int16Data.buffer);

            // Encode to base64
            const base64Data = btoa(String.fromCharCode(...uint8Data));

            // Send to callback
            this.onDataCallback(base64Data);
        };

        // Connect the audio graph
        this.sourceNode.connect(this.gainNode);
        this.gainNode.connect(this.processorNode);
        this.processorNode.connect(this.audioContext.destination);

        log.info('Audio capture initialized successfully');
        return this.gainNode;
    }

    /**
     * Start capturing audio
     */
    startCapture(onData: AudioDataCallback): void {
        if (!this.audioContext || !this.processorNode) {
            throw new Error('Audio capture not initialized');
        }

        log.info('Starting audio capture');
        this.onDataCallback = onData;
        this.isCapturing = true;
    }

    /**
     * Stop capturing audio
     */
    stopCapture(): void {
        log.info('Stopping audio capture');
        this.isCapturing = false;
        this.onDataCallback = null;
    }

    /**
     * Get the analyser for visualization
     */
    getAnalyser(): Analyser | null {
        return this.analyser;
    }

    /**
     * Get the gain node for external connections
     */
    getGainNode(): GainNode | null {
        return this.gainNode;
    }

    /**
     * Set input volume (0 to 1)
     */
    setVolume(volume: number): void {
        if (this.gainNode) {
            this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
        }
    }

    /**
     * Cleanup and release resources
     */
    cleanup(): void {
        log.info('Cleaning up audio capture');

        this.isCapturing = false;
        this.onDataCallback = null;

        if (this.processorNode) {
            this.processorNode.disconnect();
            this.processorNode = null;
        }

        if (this.analyser) {
            this.analyser.disconnect();
            this.analyser = null;
        }

        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }

        if (this.sourceNode) {
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}

/**
 * AudioPlayback - Handles AI voice output at 24kHz
 */
export class AudioPlayback {
    private audioContext: AudioContext | null = null;
    private gainNode: GainNode | null = null;
    private analyser: Analyser | null = null;
    private nextStartTime = 0;
    private activeSources = new Set<AudioBufferSourceNode>();

    /**
     * Initialize audio playback
     */
    async initialize(options: AudioPlaybackOptions = {}): Promise<GainNode> {
        const sampleRate = options.sampleRate || 24000;
        const channels = options.channels || 1;

        log.info('Initializing audio playback', { sampleRate, channels });

        // Create audio context with specified sample rate
        this.audioContext = new AudioContext({ sampleRate });

        // Resume context if suspended
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        // Create gain node for volume control
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = 1.0;

        // Connect to destination (speakers)
        this.gainNode.connect(this.audioContext.destination);

        // Create analyser for visualization
        this.analyser = new Analyser(this.gainNode, 32);

        // Initialize next start time
        this.nextStartTime = this.audioContext.currentTime;

        log.info('Audio playback initialized successfully');
        return this.gainNode;
    }

    /**
     * Play audio from base64-encoded PCM data
     */
    async playAudio(base64Data: string): Promise<void> {
        if (!this.audioContext || !this.gainNode) {
            throw new Error('Audio playback not initialized');
        }

        try {
            // Decode base64 to Uint8Array
            const binaryString = atob(base64Data);
            const uint8Data = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                uint8Data[i] = binaryString.charCodeAt(i);
            }

            // Convert Uint8Array to Int16Array
            const int16Data = new Int16Array(uint8Data.buffer);

            // Convert Int16Array to Float32Array (-1 to 1)
            const float32Data = new Float32Array(int16Data.length);
            for (let i = 0; i < int16Data.length; i++) {
                const value = int16Data[i] ?? 0;
                float32Data[i] = value / (value < 0 ? 0x8000 : 0x7FFF);
            }

            // Create audio buffer
            const audioBuffer = this.audioContext.createBuffer(
                1, // mono
                float32Data.length,
                this.audioContext.sampleRate || 24000
            );

            // Copy data to buffer
            audioBuffer.copyToChannel(float32Data, 0);

            // Create buffer source
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;

            // Connect to gain node
            source.connect(this.gainNode);

            // Schedule playback
            const now = this.audioContext.currentTime;
            this.nextStartTime = Math.max(this.nextStartTime, now);

            source.start(this.nextStartTime);
            this.nextStartTime += audioBuffer.duration;

            // Track active source
            this.activeSources.add(source);

            // Remove from set when finished
            source.onended = () => {
                this.activeSources.delete(source);
                source.disconnect();
            };

            log.debug('Audio playback scheduled', {
                duration: audioBuffer.duration,
                startTime: this.nextStartTime
            });

        } catch (error) {
            log.error('Failed to play audio', error);
            throw error;
        }
    }

    /**
     * Handle interruption - stop all playing audio
     */
    handleInterruption(): void {
        log.info('Handling audio interruption', { activeSources: this.activeSources.size });

        // Stop all active sources
        this.activeSources.forEach(source => {
            try {
                source.stop();
                source.disconnect();
            } catch (error) {
                // Source may already be stopped
            }
        });

        // Clear the set
        this.activeSources.clear();

        // Reset next start time
        if (this.audioContext) {
            this.nextStartTime = this.audioContext?.currentTime ?? 0;
        }
    }

    /**
     * Get the analyser for visualization
     */
    getAnalyser(): Analyser | null {
        return this.analyser;
    }

    /**
     * Get the gain node for external connections
     */
    getGainNode(): GainNode | null {
        return this.gainNode;
    }

    /**
     * Set output volume (0 to 1)
     */
    setVolume(volume: number): void {
        if (this.gainNode) {
            this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
        }
    }

    /**
     * Get the audio context
     */
    getContext(): AudioContext | null {
        return this.audioContext;
    }

    /**
     * Cleanup and release resources
     */
    cleanup(): void {
        log.info('Cleaning up audio playback');

        // Stop all active sources
        this.handleInterruption();

        if (this.analyser) {
            this.analyser.disconnect();
            this.analyser = null;
        }

        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }

        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}

/**
 * AudioManager - Main class coordinating capture and playback
 */
export class AudioManager {
    private capture: AudioCapture;
    private playback: AudioPlayback;
    private isInitialized = false;

    constructor() {
        this.capture = new AudioCapture();
        this.playback = new AudioPlayback();
    }

    /**
     * Initialize both capture and playback
     */
    async initialize(): Promise<{ inputNode: GainNode; outputNode: GainNode }> {
        log.info('Initializing AudioManager');

        const inputNode = await this.capture.initialize();
        const outputNode = await this.playback.initialize();

        this.isInitialized = true;

        log.info('AudioManager initialized successfully');
        return { inputNode, outputNode };
    }

    /**
     * Start capturing audio
     */
    startCapture(onData: AudioDataCallback): void {
        if (!this.isInitialized) {
            throw new Error('AudioManager not initialized');
        }
        this.capture.startCapture(onData);
    }

    /**
     * Stop capturing audio
     */
    stopCapture(): void {
        this.capture.stopCapture();
    }

    /**
     * Play audio from Live API
     */
    async playAudio(base64Data: string): Promise<void> {
        if (!this.isInitialized) {
            throw new Error('AudioManager not initialized');
        }
        await this.playback.playAudio(base64Data);
    }

    /**
     * Handle interruption from Live API
     */
    handleInterruption(): void {
        this.playback.handleInterruption();
    }

    /**
     * Get input analyser for visualization
     */
    getInputAnalyser(): Analyser | null {
        return this.capture.getAnalyser();
    }

    /**
     * Get output analyser for visualization
     */
    getOutputAnalyser(): Analyser | null {
        return this.playback.getAnalyser();
    }

    /**
     * Set input volume
     */
    setInputVolume(volume: number): void {
        this.capture.setVolume(volume);
    }

    /**
     * Set output volume
     */
    setOutputVolume(volume: number): void {
        this.playback.setVolume(volume);
    }

    /**
     * Get input gain node
     */
    getInputNode(): GainNode | null {
        return this.capture.getGainNode();
    }

    /**
     * Get output gain node
     */
    getOutputNode(): GainNode | null {
        return this.playback.getGainNode();
    }

    /**
     * Get output audio context
     */
    getOutputContext(): AudioContext | null {
        return this.playback.getContext();
    }

    /**
     * Cleanup all resources
     */
    cleanup(): void {
        log.info('Cleaning up AudioManager');
        this.capture.cleanup();
        this.playback.cleanup();
        this.isInitialized = false;
    }
}

export default AudioManager;

