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
import { GeminiLiveClient, type GeminiLiveEventHandlers } from '../../ai/geminiLive';
import { getGeminiLiveManager } from '../../ai/geminiLive/GeminiLiveManager';
import { AudioOrb3D } from './AudioOrb3D';
import { VoicePoweredOrb } from './VoicePoweredOrb';
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
    const [sphereColor, setSphereColor] = useState('#4a90ff');
    const [showDebug, setShowDebug] = useState(false);
    const [debugReport, setDebugReport] = useState<string>('');
    const [warningMessage, setWarningMessage] = useState<string | null>(null);
    const [isModelSpeaking, setIsModelSpeaking] = useState(false);
    const [isUserSpeaking, setIsUserSpeaking] = useState(false);
    const [isExecutingTools, setIsExecutingTools] = useState(false);
    const [showSetupNotification, setShowSetupNotification] = useState(false);

    // Refs
    const liveClientRef = useRef<GeminiLiveClient | null>(null);
    const inputNodeRef = useRef<GainNode | null>(null);
    const outputNodeRef = useRef<GainNode | null>(null);
    const isCleaningUpRef = useRef(false);
    const isInitializingRef = useRef(false);
    const hasInitializedRef = useRef(false);
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

    // Initialize client on mount using Singleton Manager
    useEffect(() => {
        // Prevent double initialization (React StrictMode or re-renders)
        if (isInitializingRef.current || hasInitializedRef.current) {
            log.info('⏭️ Skipping initialization - already initialized or in progress');
            return;
        }

        isInitializingRef.current = true;

        const initializeClient = async () => {
            try {
                log.info('🎙️ Initializing GeminiLiveClient via Manager...');

                // Validate API key
                if (!apiKey || apiKey.trim().length === 0) {
                    const errorMsg = 'API key is required for voice mode. Please configure your Gemini API key in settings.';
                    log.error(errorMsg);
                    setError(errorMsg);
                    isInitializingRef.current = false;
                    return;
                }

                // Get the singleton manager
                const manager = getGeminiLiveManager();

                // Check if there's already an active client
                const diagnostics = manager.getDiagnostics();
                log.info('Manager diagnostics:', diagnostics);

                if (diagnostics.hasActiveClient) {
                    log.info('♻️ Reusing existing active client from manager');

                    // Reuse existing client
                    const existingClient = manager.getActiveClient();
                    if (existingClient) {
                        liveClientRef.current = existingClient;

                        // Get audio nodes for visualization
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
                        setIsModelSpeaking(isSpeaking);
                    },
                    onUserSpeaking: (isSpeaking) => {
                        log.debug('User speaking:', isSpeaking);
                        setIsUserSpeaking(isSpeaking);
                    },
                    onToolCall: (toolName, args) => {
                        log.info('Tool called:', toolName, args);
                    },
                    onToolResult: (toolName, result) => {
                        log.info('Tool result:', toolName, result);
                    },
                    onToolExecutionChange: (isExecuting) => {
                        log.info('Tool execution state changed:', isExecuting);
                        setIsExecutingTools(isExecuting);
                    }
                };

                // Use manager to get client (ensures singleton)
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
                hasInitializedRef.current = true;
                isInitializingRef.current = false;
                log.info('✅ GeminiLiveClient initialized successfully');

                // Auto-start the voice session
                log.info('Auto-starting voice session...');
                try {
                    // Show setup notification
                    setShowSetupNotification(true);

                    await client.startSession();
                    await client.startCapture();
                    setIsRecording(true);
                    log.info('Voice session auto-started successfully');

                    // Hide notification after 3 seconds
                    setTimeout(() => {
                        setShowSetupNotification(false);
                    }, 3000);
                } catch (err) {
                    log.error('Failed to auto-start session:', err);
                    setError(err instanceof Error ? err.message : 'Failed to auto-start voice session');
                    setIsRecording(false);
                    setShowSetupNotification(false);
                }
            } catch (err) {
                log.error('Failed to initialize client:', err);
                setError(err instanceof Error ? err.message : 'Failed to initialize voice mode');
                isInitializingRef.current = false;
            }
        };

        initializeClient();

        // Cleanup on unmount
        return () => {
            if (!isCleaningUpRef.current) {
                isCleaningUpRef.current = true;
                log.info('🧹 Component unmounting, running cleanup via Manager...');

                // Cleanup lifecycle handlers first
                if (lifecycleHandlerRef.current) {
                    lifecycleHandlerRef.current.handleClose();
                }

                if (errorHandlerRef.current) {
                    errorHandlerRef.current.cleanup();
                }

                // Use manager to cleanup client (ensures proper singleton cleanup)
                const manager = getGeminiLiveManager();
                manager.cleanup().catch(err => {
                    log.error('Error during manager cleanup:', err);
                });

                liveClientRef.current = null;
                hasInitializedRef.current = false;
                isInitializingRef.current = false;
            }
        };
    }, []); // Empty dependency array - only run once on mount

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
            log.info('Resetting voice session via Manager...');
            setError(null);

            // Stop if recording
            if (isRecording) {
                await liveClientRef.current.stopSession();
                setIsRecording(false);
            }

            // Get manager and cleanup current instance
            const manager = getGeminiLiveManager();
            await manager.cleanup();

            // Create event handlers for new instance
            const eventHandlers: GeminiLiveEventHandlers = {
                onStatusChange: (newStatus) => setStatus(newStatus),
                onError: (err) => {
                    setError(err.message);
                    setIsRecording(false);
                },
                onModelSpeaking: (isSpeaking) => {
                    log.debug('Model speaking:', isSpeaking);
                    setIsModelSpeaking(isSpeaking);
                },
                onUserSpeaking: (isSpeaking) => {
                    log.debug('User speaking:', isSpeaking);
                    setIsUserSpeaking(isSpeaking);
                },
                onToolCall: (toolName, args) => log.info('Tool called:', toolName, args),
                onToolResult: (toolName, result) => log.info('Tool result:', toolName, result),
                onToolExecutionChange: (isExecuting) => {
                    log.info('Tool execution state changed:', isExecuting);
                    setIsExecutingTools(isExecuting);
                }
            };

            // Get new client from manager (ensures singleton)
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

            // Update audio nodes
            const audioManager = (newClient as any).audioManager;
            if (audioManager) {
                inputNodeRef.current = audioManager.getInputNode();
                outputNodeRef.current = audioManager.getOutputNode();
            }

            setStatus('Ready');
            log.info('Voice session reset successfully via Manager');
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

            </div>

            {/* Debug Panel */}
            {showDebug && (
                <div style={{
                    position: 'absolute',
                    top: '70px',
                    right: '20px',
                    width: '420px',
                    maxHeight: '520px',
                    background: 'rgba(15, 20, 35, 0.95)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    borderRadius: '16px',
                    padding: '20px',
                    color: 'white',
                    fontSize: '12px',
                    fontFamily: 'ui-monospace, monospace',
                    overflow: 'auto',
                    zIndex: 1000,
                    backdropFilter: 'blur(20px) saturate(180%)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
                }}>
                    <h3 style={{
                        margin: '0 0 16px 0',
                        fontSize: '15px',
                        fontWeight: '600',
                        color: 'rgba(216, 180, 254, 0.95)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <span>🔧</span>
                        <span>Tool Integration Test</span>
                    </h3>
                    <button
                        onClick={handleDebugTest}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(139, 92, 246, 0.25) 100%)',
                            border: '1px solid rgba(168, 85, 247, 0.4)',
                            borderRadius: '10px',
                            color: 'white',
                            cursor: 'pointer',
                            marginBottom: '16px',
                            fontWeight: '500',
                            fontSize: '13px',
                            transition: 'all 0.2s ease',
                            backdropFilter: 'blur(10px)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(168, 85, 247, 0.4) 0%, rgba(139, 92, 246, 0.35) 100%)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(168, 85, 247, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(139, 92, 246, 0.25) 100%)';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        Run Test
                    </button>
                    {debugReport && (
                        <pre style={{
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            fontSize: '11px',
                            lineHeight: '1.6',
                            background: 'rgba(0, 0, 0, 0.3)',
                            padding: '12px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: 'rgba(255, 255, 255, 0.9)',
                            maxHeight: '350px',
                            overflow: 'auto'
                        }}>
                            {debugReport}
                        </pre>
                    )}
                </div>
            )}

            {/* Main Content - Orb Visualization */}
            <div className="voice-mode-content">
                {isInitialized && inputNodeRef.current && outputNodeRef.current ? (
                    <VoicePoweredOrb
                        enableVoiceControl={isRecording}
                        agentSpeaking={isModelSpeaking}
                        outputNode={outputNodeRef.current}
                        voiceSensitivity={1.5}
                        maxRotationSpeed={1.2}
                        maxHoverIntensity={0.8}
                        hue={220}
                        className="voice-mode-orb"
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
                <div className={`voice-mode-status-indicator ${status.toLowerCase().replace(/\.\.\./g, '')} ${isExecutingTools ? 'with-notice' : ''}`}>
                    <div className="voice-mode-status-dot" />
                    <span className="voice-mode-status-text">{status}</span>
                    {isExecutingTools && (
                        <div className="voice-mode-inline-notice">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                                <path d="M8 1V4M8 12V15M15 8H12M4 8H1M13.657 2.343L11.536 4.464M4.464 11.536L2.343 13.657M13.657 13.657L11.536 11.536M4.464 4.464L2.343 2.343"
                                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            <span className="notice-text">Audio input paused during action</span>
                        </div>
                    )}
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

            {/* Setup Notification */}
            {showSetupNotification && (
                <div className="voice-mode-setup-notification">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                        <path d="M10 2V5M10 15V18M18 10H15M5 10H2M16.364 3.636L14.243 5.757M5.757 14.243L3.636 16.364M16.364 16.364L14.243 14.243M5.757 5.757L3.636 3.636"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span>Please wait, we're still setting up things...</span>
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
