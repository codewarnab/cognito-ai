/**
 * VoiceModeUI - Main voice mode interface component
 * 
 * Refactored for better maintainability:
 * - Separated concerns into focused components
 * - Extracted custom hook for client lifecycle
 * - Cleaner component structure
 */

import React, { useState } from 'react';
import { VoicePoweredOrb } from '../visualizations/VoicePoweredOrb';
import { VoiceControls } from './VoiceControls';
import { VoiceModeStatusDisplay } from './VoiceModeStatus';
import { ErrorNotification, WarningNotification, SetupNotification } from './VoiceModeNotifications';
import { VoiceModeDebugPanel } from './VoiceModeDebugPanel';
import { useGeminiLiveClient } from '../hooks/useGeminiLiveClient';
import { runToolIntegrationReport } from '../../../../ai/geminiLive/toolIntegrationTest';
import { createLogger } from '../../../../logger';
import type { VoiceModeUIProps } from '../types';
import '../styles/VoiceModeUI.css';

const log = createLogger('VoiceModeUI');

export const VoiceModeUI: React.FC<VoiceModeUIProps> = ({
    onBack,
    apiKey,
    systemInstruction
}) => {
    // Local state
    const [status, setStatus] = useState<any>('Ready');
    const [error, setError] = useState<string | null>(null);
    const [warningMessage, setWarningMessage] = useState<string | null>(null);
    const [isModelSpeaking, setIsModelSpeaking] = useState(false);
    const [_isUserSpeaking, setIsUserSpeaking] = useState(false); // Used via callback
    const [isExecutingTools, setIsExecutingTools] = useState(false);
    const [showSetupNotification, setShowSetupNotification] = useState(false);
    const [isMicrophoneError, setIsMicrophoneError] = useState(false);
    const [showMicHelpPopover, setShowMicHelpPopover] = useState(false);
    const [showDebug] = useState(false);
    const [debugReport, setDebugReport] = useState<string>('');
    const [isRecording, setIsRecording] = useState(false);

    // Custom hook for client management
    const {
        client,
        isInitialized,
        inputNode,
        outputNode,
        startSession,
        stopSession,
        resetSession
    } = useGeminiLiveClient({
        apiKey,
        systemInstruction,
        onStatusChange: setStatus,
        onError: (errorMsg, isMicError) => {
            setError(errorMsg);
            setIsMicrophoneError(isMicError);
            setIsRecording(false);
        },
        onWarning: setWarningMessage,
        onModelSpeaking: setIsModelSpeaking,
        onUserSpeaking: setIsUserSpeaking,
        onToolExecutionChange: setIsExecutingTools,
        onSetupNotification: setShowSetupNotification
    });

    // Handle start button
    const handleStart = async () => {
        if (!client || isRecording) return;
        try {
            log.info('Starting voice session...');
            setError(null);
            await startSession();
            setIsRecording(true);
        } catch (err) {
            log.error('Failed to start session:', err);
            setError(err instanceof Error ? err.message : 'Failed to start voice session');
            setIsRecording(false);
        }
    };

    // Handle stop button
    const handleStop = async () => {
        if (!client || !isRecording) return;
        try {
            log.info('Stopping voice session...');
            await stopSession();
            setIsRecording(false);
        } catch (err) {
            log.error('Failed to stop session:', err);
            setError(err instanceof Error ? err.message : 'Failed to stop voice session');
        }
    };

    // Handle reset button
    const handleReset = async () => {
        if (!client) return;
        try {
            log.info('Resetting voice session...');
            setError(null);
            await resetSession();
            setIsRecording(false);
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

    const handleDismissError = () => {
        setError(null);
        setIsMicrophoneError(false);
        setShowMicHelpPopover(false);
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
            </div>

            {/* Debug Panel */}
            {showDebug && (
                <VoiceModeDebugPanel
                    debugReport={debugReport}
                    onRunTest={handleDebugTest}
                />
            )}

            {/* Main Content - Orb Visualization */}
            <div className="voice-mode-content">
                {isInitialized && inputNode && outputNode ? (
                    <VoicePoweredOrb
                        enableVoiceControl={isRecording}
                        agentSpeaking={isModelSpeaking}
                        outputNode={outputNode}
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
            <VoiceModeStatusDisplay
                status={status}
                isExecutingTools={isExecutingTools}
            />

            {/* Error Display */}
            {error && (
                <ErrorNotification
                    error={error}
                    isMicrophoneError={isMicrophoneError}
                    showMicHelpPopover={showMicHelpPopover}
                    onShowMicHelpPopover={setShowMicHelpPopover}
                    onDismiss={handleDismissError}
                />
            )}

            {/* Warning Display */}
            {warningMessage && !error && (
                <WarningNotification
                    message={warningMessage}
                    onDismiss={() => setWarningMessage(null)}
                />
            )}

            {/* Setup Notification */}
            {showSetupNotification && <SetupNotification />}

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
