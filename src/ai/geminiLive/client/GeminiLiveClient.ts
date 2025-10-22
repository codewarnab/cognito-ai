/**
 * Gemini Live Client
 * Main orchestrator for WebSocket-based real-time voice conversation with Gemini
 * 
 * Architecture:
 * - Coordinates session, audio, tool, and message handlers
 * - Manages client lifecycle and state
 * - Provides simplified API for voice interactions
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { VoiceModeStatus, LiveAPIError } from '../types';
import { LiveAPIErrorType, AUDIO_CONFIG } from '../types';
import { AudioManager } from '../audioManager';
import {
    GeminiLiveErrorHandler,
    AudioContextHandler,
    type ErrorRecoveryConfig
} from '../errorHandler';
import { createLogger } from '../../../logger';
import { GeminiLiveSessionManager } from './sessionManager';
import { GeminiLiveAudioHandler } from './audioHandler';
import { GeminiLiveMessageHandler } from './messageHandler';
import {
    type GeminiLiveClientConfig,
    type GeminiLiveEventHandlers,
    DEFAULT_CONFIG,
    HARDCODED_API_KEY
} from './config';

const log = createLogger('GeminiLiveClient');

/**
 * Main Gemini Live Client class
 * Simplified orchestrator using dedicated handlers
 */
export class GeminiLiveClient {
    private legacyClient: GoogleGenerativeAI | null = null;
    private sessionManager: GeminiLiveSessionManager | null = null;
    private audioHandler: GeminiLiveAudioHandler | null = null;
    private messageHandler: GeminiLiveMessageHandler | null = null;
    private audioManager: AudioManager;
    private config: GeminiLiveClientConfig;
    private eventHandlers: GeminiLiveEventHandlers;
    private errorHandler: GeminiLiveErrorHandler;

    private isInitialized = false;
    private currentStatus: VoiceModeStatus = 'Ready';
    private isModelSpeaking = false;
    private connectionRetryCount = 0;
    private sessionStartPromise: Promise<void> | null = null;

    // Instance tracking
    private static instanceCount = 0;
    private instanceId: number;
    private isCleanedUp = false;

    constructor(config: GeminiLiveClientConfig) {
        GeminiLiveClient.instanceCount++;
        this.instanceId = GeminiLiveClient.instanceCount;

        if (GeminiLiveClient.instanceCount > 1) {
            log.warn(`⚠️ Multiple GeminiLiveClient instances detected! Current count: ${GeminiLiveClient.instanceCount}`);
        }

        this.config = {
            model: config.model,
            voiceName: config.voiceName || DEFAULT_CONFIG.voiceName,
            enableTools: config.enableTools ?? DEFAULT_CONFIG.enableTools,
            ...config
        };

        this.eventHandlers = config.eventHandlers || {};
        this.audioManager = new AudioManager();

        // Initialize error handler
        this.errorHandler = new GeminiLiveErrorHandler({
            maxRetries: 3,
            retryDelay: 1000,
            exponentialBackoff: true,
            onRetry: (attempt, error) => {
                log.warn(`Retrying after error (attempt ${attempt})`, error);
                this.updateStatus('Retrying...');
            },
            onFailure: (error) => {
                log.error('Max retries reached', error);
                this.updateStatus('Error');
            },
            ...config.errorRecoveryConfig
        });

        log.info(`GeminiLiveClient #${this.instanceId} created`, {
            model: this.config.model,
            voiceName: this.config.voiceName,
            enableTools: this.config.enableTools,
            totalInstances: GeminiLiveClient.instanceCount
        });
    }

    /**
     * Initialize the client and audio manager
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            log.warn('Client already initialized');
            return;
        }

        const recoveryManager = this.errorHandler.getRecoveryManager();

        await recoveryManager.executeWithRetry(
            'initialization',
            async () => {
                try {
                    this.updateStatus('Initializing...');
                    log.info('Initializing GeminiLiveClient...');

                    // Use hardcoded API key
                    this.config.apiKey = HARDCODED_API_KEY;

                    const keyPreview = HARDCODED_API_KEY.length > 8
                        ? `${HARDCODED_API_KEY.substring(0, 4)}...${HARDCODED_API_KEY.substring(HARDCODED_API_KEY.length - 4)}`
                        : '****';
                    log.info('Using hardcoded API key', { keyLength: HARDCODED_API_KEY.length, preview: keyPreview });

                    // Initialize clients
                    this.legacyClient = new GoogleGenerativeAI(HARDCODED_API_KEY);

                    // Initialize audio manager
                    await this.audioManager.initialize();
                    log.info('Audio manager initialized');

                    // Monitor audio context state
                    const outputContext = this.audioManager.getOutputContext();
                    if (outputContext) {
                        AudioContextHandler.monitorState(outputContext, (state) => {
                            if (state === 'suspended') {
                                this.handleAudioContextSuspended(outputContext);
                            }
                        });
                    }

                    // Initialize handlers
                    this.audioHandler = new GeminiLiveAudioHandler(this.audioManager, {
                        onUserSpeakingChange: (isSpeaking) => {
                            if (this.eventHandlers.onUserSpeaking) {
                                this.eventHandlers.onUserSpeaking(isSpeaking);
                            }
                        },
                        onStatusChange: (status) => this.updateStatus(status as VoiceModeStatus)
                    });

                    this.messageHandler = new GeminiLiveMessageHandler(this.audioManager, {
                        onModelSpeakingChange: (isSpeaking) => {
                            this.isModelSpeaking = isSpeaking;
                            if (this.eventHandlers.onModelSpeaking) {
                                this.eventHandlers.onModelSpeaking(isSpeaking);
                            }
                        },
                        onStatusChange: (status) => this.updateStatus(status as VoiceModeStatus),
                        onError: (error) => this.handleError(error)
                    });

                    this.isInitialized = true;
                    this.updateStatus('Ready');
                    log.info('GeminiLiveClient initialized successfully');

                } catch (error) {
                    const liveError = {
                        type: LiveAPIErrorType.INITIALIZATION,
                        message: 'Failed to initialize Gemini Live Client',
                        originalError: error as Error
                    } as LiveAPIError;
                    this.handleError(liveError);
                    throw liveError;
                }
            }
        );
    }

    /**
     * Start a Live API session
     */
    async startSession(): Promise<void> {
        if (this.isCleanedUp) {
            throw new Error(`Client #${this.instanceId} has been cleaned up`);
        }

        if (!this.isInitialized) {
            throw new Error('Client not initialized. Call initialize() first.');
        }

        if (this.sessionManager?.isConnected()) {
            log.warn(`⏭️ Session already active on client #${this.instanceId}`);
            return;
        }

        if (this.sessionStartPromise) {
            log.info(`⏳ Session start in progress for client #${this.instanceId}, waiting...`);
            return this.sessionStartPromise;
        }

        const wsHandler = this.errorHandler.getWebSocketHandler();

        this.sessionStartPromise = wsHandler.handleConnectionFailure(
            async () => {
                try {
                    this.updateStatus('Connecting...');
                    log.info(`Starting Live API session on client #${this.instanceId}...`);

                    // Create session manager
                    this.sessionManager = new GeminiLiveSessionManager(
                        HARDCODED_API_KEY,
                        {
                            model: this.config.model!,
                            voiceName: this.config.voiceName!,
                            systemInstruction: this.config.systemInstruction,
                            enableTools: this.config.enableTools!
                        },
                        {
                            onOpen: () => this.handleSessionOpen(),
                            onMessage: async (msg) => await this.handleMessage(msg),
                            onError: (err) => this.handleSessionError(err),
                            onClose: (evt) => this.handleSessionClose(evt)
                        }
                    );

                    await this.sessionManager.connect();
                    this.connectionRetryCount = 0;

                } catch (error) {
                    this.connectionRetryCount++;
                    const liveError = {
                        type: LiveAPIErrorType.CONNECTION,
                        message: `Failed to connect to Live API on client #${this.instanceId}`,
                        originalError: error as Error
                    } as LiveAPIError;
                    this.handleError(liveError);
                    throw liveError;
                } finally {
                    this.sessionStartPromise = null;
                }
            },
            (status) => this.updateStatus(status as VoiceModeStatus)
        ).then(() => { });

        return this.sessionStartPromise;
    }

    /**
     * Start audio capture and streaming
     */
    async startCapture(): Promise<void> {
        if (!this.sessionManager?.isConnected()) {
            throw new Error('No active session. Call startSession() first.');
        }

        if (!this.audioHandler) {
            throw new Error('Audio handler not initialized');
        }

        this.audioHandler.startCapture((base64Data) => {
            if (this.sessionManager) {
                this.sessionManager.sendAudioInput(base64Data, AUDIO_CONFIG.MIME_TYPE);
            }
        });
    }

    /**
     * Stop audio capture
     */
    stopCapture(): void {
        if (this.audioHandler) {
            this.audioHandler.stopCapture();

            if (!this.isModelSpeaking && this.sessionManager?.isConnected()) {
                this.updateStatus('Ready');
            }
        }
    }

    /**
     * Stop the session
     */
    async stopSession(): Promise<void> {
        if (!this.sessionManager?.isConnected()) {
            log.warn('No active session to stop');
            return;
        }

        try {
            log.info('Stopping Live API session...');

            this.stopCapture();

            if (this.sessionManager) {
                await this.sessionManager.close();
                this.sessionManager = null;
            }

            this.updateStatus('Ready');
            log.info('Live API session stopped');

        } catch (error) {
            log.error('Error stopping session', error);
            this.sessionManager = null;
            this.updateStatus('Error');
        }
    }

    /**
     * Cleanup all resources
     */
    cleanup(): void {
        if (this.isCleanedUp) {
            log.warn(`Client #${this.instanceId} already cleaned up`);
            return;
        }

        log.info(`Cleaning up GeminiLiveClient #${this.instanceId}...`);

        if (this.sessionManager?.isConnected()) {
            this.stopSession().catch(err => log.error('Error in cleanup stopSession', err));
        }

        this.audioManager.cleanup();
        this.sessionManager = null;
        this.audioHandler = null;
        this.messageHandler = null;
        this.isInitialized = false;
        this.isCleanedUp = true;
        this.updateStatus('Ready');

        GeminiLiveClient.instanceCount--;
        log.info(`GeminiLiveClient #${this.instanceId} cleaned up. Remaining: ${GeminiLiveClient.instanceCount}`);
    }

    /**
     * Get diagnostics
     */
    getDiagnostics() {
        return {
            instanceId: this.instanceId,
            isInitialized: this.isInitialized,
            isSessionActive: this.sessionManager?.isConnected() ?? false,
            isCleanedUp: this.isCleanedUp,
            currentStatus: this.currentStatus,
            totalInstances: GeminiLiveClient.instanceCount
        };
    }

    /**
     * Get audio manager
     */
    getAudioManager(): AudioManager {
        return this.audioManager;
    }

    /**
     * Get current status
     */
    getStatus(): VoiceModeStatus {
        return this.currentStatus;
    }

    /**
     * Check if session is active
     */
    isActive(): boolean {
        return this.sessionManager?.isConnected() ?? false;
    }

    // ========================================================================
    // Private Event Handlers
    // ========================================================================

    private handleSessionOpen(): void {
        log.info('Live API session opened');
        this.updateStatus('Ready');
    }

    private async handleMessage(message: any): Promise<void> {
        if (!this.messageHandler || !this.sessionManager) {
            return;
        }

        const result = await this.messageHandler.handleMessage(message);

        if (result.requiresToolExecution && result.functionCalls) {
            this.updateStatus('Thinking...');

            const toolHandler = this.sessionManager.getToolHandler();
            const responses = await toolHandler.executeToolCalls(
                result.functionCalls,
                this.eventHandlers.onToolCall,
                this.eventHandlers.onToolResult
            );

            if (responses.length > 0) {
                await this.sessionManager.sendToolResponse(responses);
            }
        }
    }

    private handleSessionError(error: Error): void {
        log.error('Live API session error', error);
        const liveError = {
            type: LiveAPIErrorType.CONNECTION,
            message: 'Live API session error',
            originalError: error
        } as LiveAPIError;
        this.handleError(liveError);
        this.updateStatus('Error');
    }

    private handleSessionClose(closeEvent?: any): void {
        log.info('Live API session closed', closeEvent);

        const wasActive = this.sessionManager?.isConnected() ?? false;
        this.sessionManager = null;
        this.isModelSpeaking = false;

        this.updateStatus('Disconnected');
        this.audioManager.handleInterruption();

        const isNormalClose = closeEvent?.code === 1000 || closeEvent?.code === 1001;
        const wasImmediateClose = !wasActive && this.connectionRetryCount === 0;

        if (wasImmediateClose && !isNormalClose) {
            log.error('Session closed immediately - possible auth issue');
            const authError = {
                type: LiveAPIErrorType.CONNECTION,
                message: 'Failed to authenticate with Gemini Live API'
            } as LiveAPIError;
            this.handleError(authError);
        }
    }

    private updateStatus(status: VoiceModeStatus): void {
        if (this.currentStatus === status) {
            return;
        }

        this.currentStatus = status;
        log.debug('Status updated', { status });

        if (this.eventHandlers.onStatusChange) {
            this.eventHandlers.onStatusChange(status);
        }
    }

    private handleError(error: LiveAPIError): void {
        log.error('GeminiLiveClient error', {
            type: error.type,
            message: error.message,
            originalError: error.originalError
        });

        if (this.eventHandlers.onError) {
            this.eventHandlers.onError(error);
        }
    }

    private async handleAudioContextSuspended(context: AudioContext): Promise<void> {
        log.warn('AudioContext suspended, attempting to resume...');

        try {
            await AudioContextHandler.handleSuspended(context, (message) => {
                log.info('Audio context warning:', message);
            });
        } catch (error) {
            log.error('Failed to resume audio context', error);
            const liveError = {
                type: LiveAPIErrorType.AUDIO_PLAYBACK,
                message: 'Audio context suspended',
                originalError: error as Error
            } as LiveAPIError;
            this.handleError(liveError);
        }
    }
}
