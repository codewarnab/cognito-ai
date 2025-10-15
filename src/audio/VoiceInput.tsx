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
  onRecordingComplete?: () => void;
  className?: string;
  lang?: string;
  silenceTimeout?: number;
}

export function VoiceInput({
  onTranscript,
  onRecordingChange,
  onInterimTranscript,
  onRecordingComplete,
  className = '',
  lang = 'en-US',
  silenceTimeout = 5000,
}: VoiceInputProps) {
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'checking' | 'granted' | 'denied'>('unknown');
  
  const {
    isRecording,
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
        onTranscript(finalText.trim());
        resetTranscript();
        // Trigger auto-send immediately
        onRecordingComplete?.();
      }
    },
  });

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
    if (isRecording) {
      stopRecording();
    } else {
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
      <button
        className={`voice-button ${isRecording ? 'recording' : ''} ${showCountdown ? 'countdown-active' : ''} ${error ? 'error' : ''} ${permissionStatus === 'checking' ? 'checking' : ''}`}
        onClick={handleToggleRecording}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        title={
          permissionStatus === 'denied' 
            ? 'Microphone access denied - click for help' 
            : permissionStatus === 'checking'
            ? 'Requesting permission...'
            : isRecording 
            ? 'Click to stop' 
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
          ) : isRecording && showCountdown ? (
            // Show countdown number instead of mic icon
            <div className="countdown-number">{silenceSeconds}</div>
          ) : isRecording ? (
            // Show mic icon while actively recording (before countdown)
            <>
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
              <div className="pulse-ring" />
              <div className="pulse-ring pulse-ring-delay" />
            </>
          ) : (
            // Show mic icon when not recording
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
        
        {/* Progress ring for countdown */}
        {showCountdown && (
          <svg className="countdown-ring" viewBox="0 0 50 50">
            <circle
              cx="25"
              cy="25"
              r="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray={`${silenceProgress * 1.25}, 125`}
              strokeDashoffset="0"
              transform="rotate(-90 25 25)"
            />
          </svg>
        )}
      </button>

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
