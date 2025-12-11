/**
 * ElevenLabsVoiceModeUI - Voice mode interface using ElevenLabs Conversational AI
 *
 * This component replaces VoiceModeUI for ElevenLabs integration.
 * Key differences from Gemini Live:
 * - Uses signed URLs from Cloudflare Worker
 * - Client tools execute directly in browser
 * - Dynamic variables control available capabilities
 */

import React, { useState, useCallback } from 'react';
import { Settings2 } from 'lucide-react';
import { Tooltip } from '@/components/ui/primitives/tooltip';
import { VoicePoweredOrb } from '../visualizations/VoicePoweredOrb';
import { VoiceControls } from './VoiceControls';
import { VoiceModeStatusDisplay } from './VoiceModeStatus';
import { ErrorNotification, SetupNotification } from './VoiceModeNotifications';
import { VoiceToolsPopover } from './VoiceToolsPopover';
import { useElevenLabsClient, type ConnectionStatus } from '../hooks/useElevenLabsClient';
import { createLogger } from '~logger';
import type { VoiceModeStatus } from '../types';
import '../styles/VoiceModeUI.css';

const log = createLogger('ElevenLabsVoiceModeUI', 'VOICE_UI');

interface ElevenLabsVoiceModeUIProps {
  onBack?: () => void;
}

// Map ElevenLabs connection status to VoiceModeStatus format
function mapStatusToDisplay(status: ConnectionStatus, isSpeaking: boolean): VoiceModeStatus {
  if (isSpeaking) return 'Speaking...';
  switch (status) {
    case 'connecting':
      return 'Initializing...';
    case 'connected':
      return 'Listening...';
    case 'error':
      return 'Error';
    case 'disconnected':
    default:
      return 'Ready';
  }
}

export const ElevenLabsVoiceModeUI: React.FC<ElevenLabsVoiceModeUIProps> = ({ onBack }) => {
  // Local state
  const [error, setError] = useState<string | null>(null);
  const [showSetupNotification, setShowSetupNotification] = useState(false);
  const [showToolSelector, setShowToolSelector] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);


  // ElevenLabs client hook
  const { status, isConnected, startSession, endSession } = useElevenLabsClient({
    onStatusChange: (newStatus) => {
      log.debug('Status changed', { status: newStatus });
      if (newStatus === 'connected') {
        setIsRecording(true);
        setShowSetupNotification(false);
      } else if (newStatus === 'disconnected' || newStatus === 'error') {
        setIsRecording(false);
      }
    },
    onError: (errorMsg) => {
      log.error('ElevenLabs error', { error: errorMsg });
      setError(errorMsg);
      setIsRecording(false);
    },
    onModeChange: (mode) => {
      setIsSpeaking(mode === 'speaking');
    },
  });

  // Handle start button
  const handleStart = useCallback(async () => {
    if (isRecording || isConnected) return;

    try {
      log.info('Starting ElevenLabs voice session...');
      setError(null);
      setShowSetupNotification(true);
      await startSession();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start voice session';
      log.error('Failed to start session', { error: errorMessage });
      setError(errorMessage);
      setIsRecording(false);
      setShowSetupNotification(false);
    }
  }, [isRecording, isConnected, startSession]);

  // Handle stop button
  const handleStop = useCallback(async () => {
    if (!isRecording && !isConnected) return;

    try {
      log.info('Stopping ElevenLabs voice session...');
      await endSession();
      setIsRecording(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop voice session';
      log.error('Failed to stop session', { error: errorMessage });
      setError(errorMessage);
    }
  }, [isRecording, isConnected, endSession]);

  // Handle reset - just stop and restart
  const handleReset = useCallback(async () => {
    try {
      log.info('Resetting ElevenLabs voice session...');
      setError(null);
      await endSession();
      setIsRecording(false);
      // Small delay before restarting
      setTimeout(() => {
        handleStart();
      }, 500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset voice session';
      log.error('Failed to reset session', { error: errorMessage });
      setError(errorMessage);
    }
  }, [endSession, handleStart]);

  const handleDismissError = () => {
    setError(null);
  };

  const handleToolsChange = (enabledTools: string[]) => {
    log.info('Tools changed', { count: enabledTools.length });
    // Note: Changes take effect on next session start
  };

  const displayStatus = mapStatusToDisplay(status, isSpeaking);

  return (
    <div className="voice-mode-container">
      {/* Header */}
      <div className="voice-mode-header">
        {onBack && (
          <Tooltip
            content={isRecording ? 'Stop voice mode first to exit' : 'Back to Text Mode'}
            position="bottom"
            delay={200}
          >
            <button
              className="voice-mode-back-button"
              onClick={onBack}
              disabled={isRecording}
              aria-label={isRecording ? 'Back button disabled - stop voice mode first' : 'Back to Text Mode'}
              type="button"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
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
          </Tooltip>
        )}

        {/* Settings button with popover */}
        <div className="voice-tools-popover-wrapper">
          <button
            className="voice-mode-settings-button"
            onClick={() => setShowToolSelector(!showToolSelector)}
            title="Voice Mode Settings"
            type="button"
            aria-label="Open voice mode settings"
          >
            <Settings2 size={20} />
          </button>
          <VoiceToolsPopover
            isOpen={showToolSelector}
            onClose={() => setShowToolSelector(false)}
            onToolsChange={handleToolsChange}
          />
        </div>
      </div>

      {/* Main Content - Orb Visualization */}
      <div className="voice-mode-content">
        {status === 'connecting' ? (
          <div className="voice-mode-loading">
            <div className="voice-mode-loading-spinner" />
            <p>Connecting to ElevenLabs...</p>
          </div>
        ) : (
          <VoicePoweredOrb
            enableVoiceControl={isRecording}
            agentSpeaking={isSpeaking}
            outputNode={null}
            voiceSensitivity={1.5}
            maxRotationSpeed={1.2}
            maxHoverIntensity={0.8}
            hue={220}
            className="voice-mode-orb"
          />
        )}
      </div>

      {/* Status Display */}
      <VoiceModeStatusDisplay status={displayStatus} isExecutingTools={false} />

      {/* Error Display */}
      {error && (
        <ErrorNotification
          error={error}
          isMicrophoneError={error.toLowerCase().includes('microphone')}
          showMicHelpPopover={false}
          onShowMicHelpPopover={() => { }}
          onDismiss={handleDismissError}
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
          disabled={status === 'connecting' || !!error}
        />
      </div>
    </div>
  );
};

export default ElevenLabsVoiceModeUI;
