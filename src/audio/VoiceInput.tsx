/**
 * Voice Input Component
 * Speech-to-text with silence detection
 */

import React, { useState } from 'react';
import { useSpeechRecognition } from './useSpeechRecognition';
import { checkMicrophonePermission, openMicrophoneSettings } from './micPermission';
import { createLogger } from '../logger';
import './voice.css';

const log = createLogger('VoiceInput');

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onRecordingChange?: (isRecording: boolean) => void;
  onInterimTranscript?: (text: string) => void;
  onRecordingComplete?: (finalText: string) => void; // Pass the text directly
  className?: string;
  lang?: string;
  silenceTimeout?: number;
  externalRecordingState?: boolean;
  onExternalRecordingToggle?: () => void;
}

export function VoiceInput({
  onTranscript,
  onRecordingChange,
  onInterimTranscript,
  onRecordingComplete,
  className = '',
  lang = 'en-IN',
  silenceTimeout = 3000,
  externalRecordingState,
  onExternalRecordingToggle,
}: VoiceInputProps) {
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'checking' | 'granted' | 'denied'>('unknown');
  
  const {
    isRecording: internalIsRecording,
    transcript,
    interimTranscript,
    error,
    isSupported,
    silenceTimeRemaining,
    startRecording,
    stopRecording,
    resetTranscript,
  } = useSpeechRecognition({
    lang,
    silenceTimeout,
    onTranscriptChange: (text: string) => {
      // Update input in real-time
      onTranscript(text);
    },
    onFinalTranscript: (finalText: string) => {
      if (finalText.trim()) {
        log.info('Final transcript received', { text: finalText });
        const cleanText = finalText.trim();
        onTranscript(cleanText);
        resetTranscript();
        // Trigger auto-send with the text
        onRecordingComplete?.(cleanText);
      }
    },
  });

  // Use external recording state if provided, otherwise use internal state
  const isRecording = externalRecordingState !== undefined ? externalRecordingState : internalIsRecording;

  React.useEffect(() => {
    onRecordingChange?.(isRecording);
  }, [isRecording, onRecordingChange]);

  // Update interim transcript in real-time
  React.useEffect(() => {
    if (interimTranscript) {
      onInterimTranscript?.(interimTranscript);
    }
  }, [interimTranscript, onInterimTranscript]);

  // Check permission status when component mounts
  React.useEffect(() => {
    const checkPermission = async () => {
      setPermissionStatus('checking');
      const status = await checkMicrophonePermission();
      setPermissionStatus(status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'unknown');
    };
    checkPermission();
  }, []);

  const handleToggleRecording = async () => {
    console.log('VoiceInput: handleToggleRecording called, isRecording:', isRecording);
    
    // If external handler is provided, use it instead of internal logic
    if (onExternalRecordingToggle) {
      console.log('VoiceInput: Using external recording toggle');
      onExternalRecordingToggle();
      return;
    }
    
    // Fallback to internal recording logic
    if (isRecording) {
      console.log('VoiceInput: Stopping recording');
      stopRecording();
    } else {
      console.log('VoiceInput: Starting recording');
      // Update permission status before starting
      setPermissionStatus('checking');
      await startRecording();
      // Re-check permission after attempt
      const status = await checkMicrophonePermission();
      setPermissionStatus(status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'unknown');
    }
  };

  const handleOpenSettings = () => {
    const instructions = openMicrophoneSettings();
    alert(instructions);
  };

  const silenceProgress = silenceTimeout ? (silenceTimeRemaining / silenceTimeout) * 100 : 0;
  const silenceSeconds = Math.ceil(silenceTimeRemaining / 1000);
  const showCountdown = isRecording && silenceTimeRemaining > 0 && silenceTimeRemaining < silenceTimeout;

  if (!isSupported) {
    return (
      <div className={`voice-input-error ${className}`}>
        <span className="voice-error-icon">⚠️</span>
        <span className="voice-error-text">Speech recognition not supported</span>
      </div>
    );
  }

  return (
    <div className={`voice-input ${className}`}>
      {/* Regular microphone button - only visible when not recording */}
      {!isRecording && (
        <button
          className={`voice-button ${error ? 'error' : ''} ${permissionStatus === 'checking' ? 'checking' : ''}`}
          onClick={handleToggleRecording}
          aria-label="Start recording"
          title={
            permissionStatus === 'denied' 
              ? 'Microphone access denied - click for help' 
              : permissionStatus === 'checking'
              ? 'Requesting permission...'
              : 'Click to speak'
          }
        >
          <div className="microphone-icon">
            {permissionStatus === 'checking' ? (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="spinner"
              >
                <circle cx="12" cy="12" r="10" opacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
              </svg>
            ) : (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="2" width="6" height="11" rx="3" />
                <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </div>
        </button>
      )}

      {/* Recording pill is now rendered at the top level in sidepanel.tsx */}

      {error && (
        <div className="voice-error">
          <span className="voice-error-icon">⚠️</span>
          <span className="voice-error-text">{error}</span>
          {error.includes('denied') && (
            <button 
              className="voice-settings-button"
              onClick={handleOpenSettings}
              title="Open microphone settings help"
            >
              Settings Help
            </button>
          )}
        </div>
      )}
    </div>
  );
}
