/**
 * useGeminiLiveClient - Custom hook for managing GeminiLiveClient lifecycle
 */

import { useRef, useEffect, useState } from 'react';
import { GeminiLiveClient, type GeminiLiveEventHandlers } from '../../../../ai/geminiLive';
import { getGeminiLiveManager } from '../../../../ai/geminiLive/GeminiLiveManager';
import {
    GeminiLiveErrorHandler,
    MicrophonePermissionHandler,
} from '../../../../ai/geminiLive/errorHandler';
import { createLogger } from '../../../../logger';
import type { VoiceModeStatus } from '../../../../ai/geminiLive/types';

const log = createLogger('useGeminiLiveClient', 'VOICE_CLIENT');

interface UseGeminiLiveClientOptions {
    apiKey: string;
    systemInstruction?: string;
    onStatusChange: (status: VoiceModeStatus) => void;
    onError: (error: string, isMicError: boolean) => void;
    onWarning: (message: string | null) => void;
    onModelSpeaking: (isSpeaking: boolean) => void;
    onUserSpeaking: (isSpeaking: boolean) => void;
    onToolExecutionChange: (isExecuting: boolean) => void;
    onSetupNotification: (show: boolean) => void;
}

interface UseGeminiLiveClientReturn {
    client: GeminiLiveClient | null;
    isInitialized: boolean;
    inputNode: GainNode | null;
    outputNode: GainNode | null;
    startSession: () => Promise<void>;
    stopSession: () => Promise<void>;
    resetSession: () => Promise<void>;
}

export const useGeminiLiveClient = (options: UseGeminiLiveClientOptions): UseGeminiLiveClientReturn => {
    const {
        apiKey,
        systemInstruction,
        onStatusChange,
        onError,
        onWarning,
        onModelSpeaking,
        onUserSpeaking,
        onToolExecutionChange,
        onSetupNotification
    } = options;

    const [isInitialized, setIsInitialized] = useState(false);
    const [isRecording, setIsRecording] = useState(false);

    const liveClientRef = useRef<GeminiLiveClient | null>(null);
    const inputNodeRef = useRef<GainNode | null>(null);
    const outputNodeRef = useRef<GainNode | null>(null);
    const isCleaningUpRef = useRef(false);
    const isInitializingRef = useRef(false);
    const hasInitializedRef = useRef(false);
    const errorHandlerRef = useRef<GeminiLiveErrorHandler | null>(null);
    const lifecycleHandlerRef = useRef<any>(null);
    const visibilityHandlerRef = useRef<any>(null);

    // Check microphone availability on mount
    useEffect(() => {
        const checkMicrophone = async () => {
            const result = await MicrophonePermissionHandler.checkAvailability();
            if (!result.available) {
                onError(result.error || 'Microphone not available', true);
                log.error('Microphone check failed:', result.error);
            }
        };
        checkMicrophone();
    }, [onError]);

    // Initialize client on mount
    useEffect(() => {
        if (isInitializingRef.current || hasInitializedRef.current) {
            log.info('⏭️ Skipping initialization - already initialized or in progress');
            return;
        }

        isInitializingRef.current = true;

        const initializeClient = async () => {
            try {
                log.info('🎙️ Initializing GeminiLiveClient via Manager...');

                if (!apiKey || apiKey.trim().length === 0) {
                    const errorMsg = 'API key is required for voice mode. Please configure your Gemini API key in settings.';
                    log.error(errorMsg);
                    onError(errorMsg, false);
                    isInitializingRef.current = false;
                    return;
                }

                const manager = getGeminiLiveManager();
                const diagnostics = manager.getDiagnostics();
                log.info('Manager diagnostics:', diagnostics);

                if (diagnostics.hasActiveClient) {
                    log.info('♻️ Reusing existing active client from manager');
                    const existingClient = manager.getActiveClient();
                    if (existingClient) {
                        liveClientRef.current = existingClient;
                        const audioManager = (existingClient as any).audioManager;
                        if (audioManager) {
                            inputNodeRef.current = audioManager.getInputNode();
                            outputNodeRef.current = audioManager.getOutputNode();
                            log.debug('Audio nodes ready for orb visualization');
                        }
                        setIsInitialized(true);
                        hasInitializedRef.current = true;
                        isInitializingRef.current = false;
                        log.info('✅ Reused existing client successfully');
                        return;
                    }
                }

                const errorHandler = new GeminiLiveErrorHandler({
                    maxRetries: 3,
                    onRetry: (attempt, err) => {
                        onWarning(`Retrying... (attempt ${attempt}/3)`);
                        log.warn('Retrying after error:', attempt, err);
                    },
                });
                errorHandlerRef.current = errorHandler;

                const lifecycleHandler = errorHandler.getLifecycleHandler();
                lifecycleHandlerRef.current = lifecycleHandler;
                lifecycleHandler.setupBeforeUnload(window);

                const visibilityHandler = errorHandler.getVisibilityHandler();
                visibilityHandlerRef.current = visibilityHandler;

                const cleanupVisibility = visibilityHandler.monitorVisibility(
                    () => {
                        log.debug('Tab visible - resuming audio contexts if needed');
                        const client = liveClientRef.current;
                        if (client) {
                            const audioManager = (client as any).audioManager;
                            const outputContext = audioManager?.getOutputContext();
                            if (outputContext && outputContext.state === 'suspended') {
                                outputContext.resume().catch((err: Error) =>
                                    log.error('Failed to resume audio on visibility change:', err)
                                );
                            }
                        }
                    },
                    () => {
                        log.debug('Tab hidden - pausing may occur');
                    }
                );

                lifecycleHandler.registerCleanup(cleanupVisibility);

                const eventHandlers: GeminiLiveEventHandlers = {
                    onStatusChange: (newStatus) => {
                        log.debug('Status changed:', newStatus);
                        onStatusChange(newStatus);
                        if (newStatus !== 'Retrying...') {
                            onWarning(null);
                        }
                    },
                    onError: (err) => {
                        log.error('Live API error:', err);
                        const isMicError = err.type === 'AUDIO_CAPTURE' ||
                            err.message.toLowerCase().includes('microphone') ||
                            err.message.toLowerCase().includes('permission');
                        onError(err.message, isMicError);
                        setIsRecording(false);
                    },
                    onModelSpeaking,
                    onUserSpeaking,
                    onToolCall: (toolName, args) => {
                        log.info('Tool called:', toolName, args);
                    },
                    onToolResult: (toolName, result) => {
                        log.info('Tool result:', toolName, result);
                    },
                    onToolExecutionChange
                };

                const client = await manager.getClient({
                    apiKey,
                    systemInstruction,
                    eventHandlers,
                    errorRecoveryConfig: {
                        maxRetries: 3,
                        retryDelay: 1000
                    }
                });

                liveClientRef.current = client;

                lifecycleHandler.registerCleanup(() => {
                    if (liveClientRef.current) {
                        liveClientRef.current.cleanup();
                    }
                });

                const audioManager = (client as any).audioManager;
                if (audioManager) {
                    inputNodeRef.current = audioManager.getInputNode();
                    outputNodeRef.current = audioManager.getOutputNode();
                    log.debug('Audio nodes ready for orb visualization');
                }

                setIsInitialized(true);
                hasInitializedRef.current = true;
                isInitializingRef.current = false;
                log.info('✅ GeminiLiveClient initialized successfully');

                // Auto-start the voice session
                log.info('Auto-starting voice session...');
                try {
                    onSetupNotification(true);
                    await client.startSession();
                    await client.startCapture();
                    setIsRecording(true);
                    log.info('Voice session auto-started successfully');
                    setTimeout(() => {
                        onSetupNotification(false);
                    }, 3000);
                } catch (err) {
                    log.error('Failed to auto-start session:', err);
                    const errorMsg = err instanceof Error ? err.message : 'Failed to auto-start voice session';
                    const isMicError = errorMsg.toLowerCase().includes('microphone') ||
                        errorMsg.toLowerCase().includes('permission');
                    onError(errorMsg, isMicError);
                    setIsRecording(false);
                    onSetupNotification(false);
                }
            } catch (err) {
                log.error('Failed to initialize client:', err);
                const errorMsg = err instanceof Error ? err.message : 'Failed to initialize voice mode';
                const isMicError = errorMsg.toLowerCase().includes('microphone') ||
                    errorMsg.toLowerCase().includes('permission');
                onError(errorMsg, isMicError);
                isInitializingRef.current = false;
            }
        };

        initializeClient();

        return () => {
            if (!isCleaningUpRef.current) {
                isCleaningUpRef.current = true;
                log.info('🧹 Component unmounting, running cleanup via Manager...');

                if (lifecycleHandlerRef.current) {
                    lifecycleHandlerRef.current.handleClose();
                }

                if (errorHandlerRef.current) {
                    errorHandlerRef.current.cleanup();
                }

                const manager = getGeminiLiveManager();
                manager.cleanup().catch(err => {
                    log.error('Error during manager cleanup:', err);
                });

                liveClientRef.current = null;
                hasInitializedRef.current = false;
                isInitializingRef.current = false;
            }
        };
    }, [apiKey, systemInstruction, onStatusChange, onError, onWarning, onModelSpeaking, onUserSpeaking, onToolExecutionChange, onSetupNotification]);

    const startSession = async () => {
        if (!liveClientRef.current || isRecording) return;

        try {
            log.info('Starting voice session...');
            await liveClientRef.current.startSession();
            await liveClientRef.current.startCapture();
            setIsRecording(true);
            log.info('Voice session and audio capture started');
        } catch (err) {
            log.error('Failed to start session:', err);
            const errorMsg = err instanceof Error ? err.message : 'Failed to start voice session';
            const isMicError = errorMsg.toLowerCase().includes('microphone') ||
                errorMsg.toLowerCase().includes('permission');
            onError(errorMsg, isMicError);
            setIsRecording(false);
        }
    };

    const stopSession = async () => {
        if (!liveClientRef.current || !isRecording) return;

        try {
            log.info('Stopping voice session...');
            liveClientRef.current.stopCapture();
            await liveClientRef.current.stopSession();
            setIsRecording(false);
            onStatusChange('Ready');
            log.info('Voice session stopped');
        } catch (err) {
            log.error('Failed to stop session:', err);
            onError(err instanceof Error ? err.message : 'Failed to stop voice session', false);
        }
    };

    const resetSession = async () => {
        if (!liveClientRef.current) return;

        try {
            log.info('Resetting voice session via Manager...');

            if (isRecording) {
                await liveClientRef.current.stopSession();
                setIsRecording(false);
            }

            const manager = getGeminiLiveManager();
            await manager.cleanup();

            const eventHandlers: GeminiLiveEventHandlers = {
                onStatusChange: (newStatus) => {
                    onStatusChange(newStatus);
                    if (newStatus !== 'Retrying...') {
                        onWarning(null);
                    }
                },
                onError: (err) => {
                    const isMicError = err.type === 'AUDIO_CAPTURE' ||
                        err.message.toLowerCase().includes('microphone') ||
                        err.message.toLowerCase().includes('permission');
                    onError(err.message, isMicError);
                    setIsRecording(false);
                },
                onModelSpeaking,
                onUserSpeaking,
                onToolCall: (toolName, args) => log.info('Tool called:', toolName, args),
                onToolResult: (toolName, result) => log.info('Tool result:', toolName, result),
                onToolExecutionChange
            };

            const newClient = await manager.getClient({
                apiKey,
                systemInstruction,
                eventHandlers,
                errorRecoveryConfig: {
                    maxRetries: 3,
                    retryDelay: 1000
                }
            });

            liveClientRef.current = newClient;

            const audioManager = (newClient as any).audioManager;
            if (audioManager) {
                inputNodeRef.current = audioManager.getInputNode();
                outputNodeRef.current = audioManager.getOutputNode();
            }

            onStatusChange('Ready');
            log.info('Voice session reset successfully via Manager');
        } catch (err) {
            log.error('Failed to reset session:', err);
            onError(err instanceof Error ? err.message : 'Failed to reset voice session', false);
        }
    };

    return {
        client: liveClientRef.current,
        isInitialized,
        inputNode: inputNodeRef.current,
        outputNode: outputNodeRef.current,
        startSession,
        stopSession,
        resetSession
    };
};
