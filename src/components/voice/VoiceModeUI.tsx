/**
 * VoiceModeUI - Main voice mode interface component
 * 
 * Phase 6 Implementation:
 * - Full-screen voice conversation interface
 * - Integrates AudioOrb3D for visualization
 * - Manages GeminiLiveClient lifecycle
 * - Displays status and controls
 */

import React, { useState, useRef, useEffect } from 'react';
import { GeminiLiveClient, type GeminiLiveEventHandlers } from '../../ai/geminiLive/GeminiLiveClient';
import { AudioOrb3D } from './AudioOrb3D';
import { VoiceControls } from './VoiceControls';
import type { VoiceModeStatus } from '../../ai/geminiLive/types';
import { runToolIntegrationReport } from '../../ai/geminiLive/toolIntegrationTest';
import {
    GeminiLiveErrorHandler,
    MicrophonePermissionHandler,
    SidePanelLifecycleHandler,
    TabVisibilityHandler,
    ModeSwitchGuard
} from '../../ai/geminiLive/errorHandler';
import { createLogger } from '../../logger';
import './VoiceModeUI.css';

const log = createLogger('VoiceModeUI');

export interface VoiceModeUIProps {
    onBack?: () => void;
    apiKey: string;
    systemInstruction?: string;
}

export const VoiceModeUI: React.FC<VoiceModeUIProps> = ({
    onBack,
    apiKey,
    systemInstruction
}) => {
    // State
    const [isRecording, setIsRecording] = useState(false);
    const [status, setStatus] = useState<VoiceModeStatus>('Ready');
    const [error, setError] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [sphereColor, setSphereColor] = useState('#000010');
    const [showDebug, setShowDebug] = useState(false);
    const [debugReport, setDebugReport] = useState<string>('');
    const [warningMessage, setWarningMessage] = useState<string | null>(null);

    // Refs
    const liveClientRef = useRef<GeminiLiveClient | null>(null);
    const inputNodeRef = useRef<GainNode | null>(null);
    const outputNodeRef = useRef<GainNode | null>(null);
    const isCleaningUpRef = useRef(false);
    const errorHandlerRef = useRef<GeminiLiveErrorHandler | null>(null);
    const lifecycleHandlerRef = useRef<SidePanelLifecycleHandler | null>(null);
    const visibilityHandlerRef = useRef<TabVisibilityHandler | null>(null);

    // Check microphone availability on mount
    useEffect(() => {
        const checkMicrophone = async () => {
            const result = await MicrophonePermissionHandler.checkAvailability();
            if (!result.available) {
                setError(result.error || 'Microphone not available');
                log.error('Microphone check failed:', result.error);
            }
        };
        checkMicrophone();
    }, []);

    // Initialize client on mount
    useEffect(() => {
        const initializeClient = async () => {
            try {
                log.info('Initializing GeminiLiveClient...');

                // Initialize error handler
                const errorHandler = new GeminiLiveErrorHandler({
                    maxRetries: 3,
                    retryDelay: 1000,
                    exponentialBackoff: true,
                    onRetry: (attempt, err) => {
                        setWarningMessage(`Retrying... (attempt ${attempt}/3)`);
                        log.warn('Retrying after error:', attempt, err);
                    },
                    onFailure: (err) => {
                        setError(err.message);
                        log.error('Max retries failed:', err);
                    }
                });
                errorHandlerRef.current = errorHandler;

                // Setup lifecycle handler for cleanup
                const lifecycleHandler = errorHandler.getLifecycleHandler();
                lifecycleHandlerRef.current = lifecycleHandler;
                lifecycleHandler.setupBeforeUnload(window);

                // Setup visibility handler for tab suspension
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
                        setStatus(newStatus);
                        // Clear warning on status change
                        if (newStatus !== 'Retrying...') {
                            setWarningMessage(null);
                        }
                    },
                    onError: (err) => {
                        log.error('Live API error:', err);

                        // Handle specific error types
                        if (err.type === 'AUDIO_CAPTURE') {
                            const permissionError = MicrophonePermissionHandler.handlePermissionDenied();
                            setError(permissionError.message);
                        } else {
                            setError(err.message);
                        }

                        setIsRecording(false);
                    },
                    onModelSpeaking: (isSpeaking) => {
                        log.debug('Model speaking:', isSpeaking);
                    },
                    onUserSpeaking: (isSpeaking) => {
                        log.debug('User speaking:', isSpeaking);
                    },
                    onToolCall: (toolName, args) => {
                        log.info('Tool called:', toolName, args);
                    },
                    onToolResult: (toolName, result) => {
                        log.info('Tool result:', toolName, result);
                    }
                };

                const client = new GeminiLiveClient({
                    apiKey,
                    systemInstruction,
                    eventHandlers,
                    errorRecoveryConfig: {
                        maxRetries: 3,
                        retryDelay: 1000
                    }
                });

                await client.initialize();
                liveClientRef.current = client;

                // Register cleanup for client
                lifecycleHandler.registerCleanup(() => {
                    if (liveClientRef.current) {
                        liveClientRef.current.cleanup();
                    }
                });

                // Get audio nodes for visualization
                const audioManager = (client as any).audioManager;
                if (audioManager) {
                    inputNodeRef.current = audioManager.getInputNode();
                    outputNodeRef.current = audioManager.getOutputNode();
                    log.debug('Audio nodes ready for orb visualization');
                }

                setIsInitialized(true);
                log.info('GeminiLiveClient initialized successfully');
            } catch (err) {
                log.error('Failed to initialize client:', err);
                setError(err instanceof Error ? err.message : 'Failed to initialize voice mode');
            }
        };

        initializeClient();

        // Cleanup on unmount
        return () => {
            if (!isCleaningUpRef.current) {
                isCleaningUpRef.current = true;
                log.info('Component unmounting, running cleanup...');

                if (lifecycleHandlerRef.current) {
                    lifecycleHandlerRef.current.handleClose();
                }

                if (errorHandlerRef.current) {
                    errorHandlerRef.current.cleanup();
                }
            }
        };
    }, [apiKey, systemInstruction]);

    // Handle start button
    const handleStart = async () => {
        if (!liveClientRef.current || isRecording) return;

        try {
            log.info('Starting voice session...');
            setError(null);
            await liveClientRef.current.startSession();

            // Start audio capture automatically after session is established
            log.info('Starting audio capture...');
            await liveClientRef.current.startCapture();

            setIsRecording(true);
            log.info('Voice session and audio capture started');
        } catch (err) {
            log.error('Failed to start session:', err);
            setError(err instanceof Error ? err.message : 'Failed to start voice session');
            setIsRecording(false);
        }
    };

    // Handle stop button
    const handleStop = async () => {
        if (!liveClientRef.current || !isRecording) return;

        try {
            log.info('Stopping voice session...');

            // Stop audio capture first
            liveClientRef.current.stopCapture();

            // Then stop the session
            await liveClientRef.current.stopSession();

            setIsRecording(false);
            setStatus('Ready');
            log.info('Voice session stopped');
        } catch (err) {
            log.error('Failed to stop session:', err);
            setError(err instanceof Error ? err.message : 'Failed to stop voice session');
        }
    };

    // Handle reset button
    const handleReset = async () => {
        if (!liveClientRef.current) return;

        try {
            log.info('Resetting voice session...');
            setError(null);

            // Stop if recording
            if (isRecording) {
                await liveClientRef.current.stopSession();
                setIsRecording(false);
            }

            // Cleanup and reinitialize
            await liveClientRef.current.cleanup();

            const eventHandlers: GeminiLiveEventHandlers = {
                onStatusChange: (newStatus) => setStatus(newStatus),
                onError: (err) => {
                    setError(err.message);
                    setIsRecording(false);
                },
                onModelSpeaking: (isSpeaking) => log.debug('Model speaking:', isSpeaking),
                onUserSpeaking: (isSpeaking) => log.debug('User speaking:', isSpeaking),
                onToolCall: (toolName, args) => log.info('Tool called:', toolName, args),
                onToolResult: (toolName, result) => log.info('Tool result:', toolName, result)
            };

            const newClient = new GeminiLiveClient({
                apiKey,
                systemInstruction,
                eventHandlers
            });

            await newClient.initialize();
            liveClientRef.current = newClient;

            // Update audio nodes
            const audioManager = (newClient as any).audioManager;
            if (audioManager) {
                inputNodeRef.current = audioManager.getInputNode();
                outputNodeRef.current = audioManager.getOutputNode();
            }

            setStatus('Ready');
            log.info('Voice session reset successfully');
        } catch (err) {
            log.error('Failed to reset session:', err);
            setError(err instanceof Error ? err.message : 'Failed to reset voice session');
        }
    };

    // Handle debug test
    const handleDebugTest = async () => {
        try {
            log.info('Running tool integration test...');
            setDebugReport('Running test...\n');
            const report = await runToolIntegrationReport();
            setDebugReport(report);
            log.info('Tool integration test complete');
        } catch (err) {
            log.error('Test failed:', err);
            setDebugReport(`Test failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    return (
        <div className="voice-mode-container">
            {/* Header */}
            <div className="voice-mode-header">
                {onBack && (
                    <button
                        className="voice-mode-back-button"
                        onClick={onBack}
                        disabled={isRecording}
                        title="Back to Text Mode"
                    >
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path
                                d="M12.5 15L7.5 10L12.5 5"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                        <span>Back to Text</span>
                    </button>
                )}

                {/* Debug button */}
                <button
                    className="voice-mode-debug-button"
                    onClick={() => setShowDebug(!showDebug)}
                    title="Toggle Debug Panel"
                    style={{
                        marginLeft: 'auto',
                        padding: '8px 12px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '8px',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '12px'
                    }}
                >
                    {showDebug ? '🐛 Hide Debug' : '🐛 Debug'}
                </button>
            </div>

            {/* Debug Panel */}
            {showDebug && (
                <div style={{
                    position: 'absolute',
                    top: '60px',
                    right: '20px',
                    width: '400px',
                    maxHeight: '500px',
                    background: 'rgba(0, 0, 0, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    padding: '16px',
                    color: 'white',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    overflow: 'auto',
                    zIndex: 1000,
                    backdropFilter: 'blur(10px)'
                }}>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>
                        🔧 Tool Integration Test (Phase 8)
                    </h3>
                    <button
                        onClick={handleDebugTest}
                        style={{
                            width: '100%',
                            padding: '8px',
                            background: 'rgba(0, 120, 255, 0.8)',
                            border: 'none',
                            borderRadius: '6px',
                            color: 'white',
                            cursor: 'pointer',
                            marginBottom: '12px'
                        }}
                    >
                        Run Test
                    </button>
                    {debugReport && (
                        <pre style={{
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            fontSize: '11px',
                            lineHeight: '1.4'
                        }}>
                            {debugReport}
                        </pre>
                    )}
                </div>
            )}

            {/* Main Content - Orb Visualization */}
            <div className="voice-mode-content">
                {isInitialized && inputNodeRef.current && outputNodeRef.current ? (
                    <AudioOrb3D
                        inputNode={inputNodeRef.current}
                        outputNode={outputNodeRef.current}
                        color={sphereColor}
                    />
                ) : (
                    <div className="voice-mode-loading">
                        <div className="voice-mode-loading-spinner" />
                        <p>Initializing voice mode...</p>
                    </div>
                )}
            </div>

            {/* Status Display */}
            <div className="voice-mode-status">
                <div className={`voice-mode-status-indicator ${status.toLowerCase().replace(/\.\.\./g, '')}`}>
                    <div className="voice-mode-status-dot" />
                    <span className="voice-mode-status-text">{status}</span>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="voice-mode-error">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" />
                        <path d="M10 6V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <circle cx="10" cy="13" r="1" fill="currentColor" />
                    </svg>
                    <span>{error}</span>
                    <button
                        className="voice-mode-error-dismiss"
                        onClick={() => setError(null)}
                        aria-label="Dismiss error"
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Warning Display */}
            {warningMessage && !error && (
                <div className="voice-mode-warning">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M10 3L2 17h16L10 3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        <path d="M10 8v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <circle cx="10" cy="14" r="1" fill="currentColor" />
                    </svg>
                    <span>{warningMessage}</span>
                    <button
                        className="voice-mode-error-dismiss"
                        onClick={() => setWarningMessage(null)}
                        aria-label="Dismiss warning"
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Controls */}
            <div className="voice-mode-controls-wrapper">
                <VoiceControls
                    isRecording={isRecording}
                    onStart={handleStart}
                    onStop={handleStop}
                    onReset={handleReset}
                    disabled={!isInitialized || !!error}
                />
            </div>
        </div>
    );
};

export default VoiceModeUI;
