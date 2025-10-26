/**
 * Speech Recognition Hook with Silence Detection
 * Automatically stops recording after 5 seconds of silence
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  RecognitionState,
  UseSpeechRecognitionReturn,
  SpeechRecognitionOptions,
  SpeechRecognitionError,
} from './types';
import { createLogger } from '../logger';
import { requestMicrophoneWithUI } from './micPermission';

const log = createLogger('SpeechRecognition');

const DEFAULT_OPTIONS: SpeechRecognitionOptions = {
  lang: 'en-US',
  continuous: true,
  interimResults: true,
  maxAlternatives: 1,
  silenceTimeout: 5000, // 5 seconds
};

export function useSpeechRecognition(
  options: SpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // State
  const [isRecording, setIsRecording] = useState(false);
  const [state, setState] = useState<RecognitionState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [silenceTimeRemaining, setSilenceTimeRemaining] = useState(0);
  const [isSupported, setIsSupported] = useState(false);

  // Refs
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const silenceCountdownRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const finalTranscriptRef = useRef<string>('');

  // Check browser support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);

    if (!SpeechRecognition) {
      log.warn('Speech Recognition API not supported in this browser');
    }
  }, []);

  // Clear silence timers
  const clearSilenceTimers = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (silenceCountdownRef.current) {
      clearInterval(silenceCountdownRef.current);
      silenceCountdownRef.current = null;
    }
    setSilenceTimeRemaining(0);
  }, []);

  // Start silence detection
  const startSilenceDetection = useCallback(() => {
    clearSilenceTimers();

    startTimeRef.current = Date.now();
    setSilenceTimeRemaining(opts.silenceTimeout!);

    // Countdown interval for UI feedback
    silenceCountdownRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, opts.silenceTimeout! - elapsed);
      setSilenceTimeRemaining(remaining);

      if (remaining === 0) {
        clearInterval(silenceCountdownRef.current!);
        silenceCountdownRef.current = null;
      }
    }, 100);

    // Auto-stop timer
    silenceTimerRef.current = setTimeout(() => {
      log.info('Silence detected - auto-stopping recording');

      // Get final transcript before stopping
      const finalText = finalTranscriptRef.current;

      // Clear state immediately
      clearSilenceTimers();
      setIsRecording(false);
      setState('idle');

      // Stop recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          log.error('Error stopping recognition', err);
        }
      }

      // Trigger callback immediately
      opts.onSilenceDetected?.();
      if (finalText && finalText.trim()) {
        log.info('Triggering onFinalTranscript from silence timeout', { text: finalText });
        opts.onFinalTranscript?.(finalText);
        finalTranscriptRef.current = '';
      }
    }, opts.silenceTimeout);
  }, [opts, clearSilenceTimers]);

  // Reset transcript
  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setFinalTranscript('');
    setError(null);
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    console.log('useSpeechRecognition: stopRecording called, isRecording:', isRecording);
    if (recognitionRef.current && isRecording) {
      try {
        recognitionRef.current.stop();
        clearSilenceTimers();
        console.log('useSpeechRecognition: Setting isRecording to false');
        setIsRecording(false);
        setState('idle');
        log.info('Recording stopped');

        // Trigger final transcript callback
        if (finalTranscript && opts.onFinalTranscript) {
          opts.onFinalTranscript(finalTranscript);
        }
      } catch (err) {
        log.error('Error stopping recognition', err);
      }
    }
  }, [isRecording, finalTranscript, opts, clearSilenceTimers]);

  // Start recording
  const startRecording = useCallback(async () => {
    if (!isSupported) {
      const errorMsg = 'Speech Recognition is not supported in this browser';
      setError(errorMsg);
      opts.onError?.({ error: 'not-supported', message: errorMsg });
      return;
    }

    if (isRecording) {
      log.warn('Recording already in progress');
      return;
    }

    try {
      // Request microphone permission first
      log.info('Requesting microphone permission...');
      const permissionResult = await requestMicrophoneWithUI();

      if (!permissionResult.granted) {
        const errorMsg = permissionResult.error || 'Microphone access denied';
        log.error('Microphone permission denied', permissionResult);
        setError(errorMsg);
        setState('error');
        opts.onError?.({
          error: permissionResult.errorType || 'permission-denied',
          message: errorMsg
        });
        return;
      }

      log.info('Microphone permission granted, starting recognition...');

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.lang = opts.lang;
      recognition.continuous = opts.continuous;
      recognition.interimResults = opts.interimResults;
      recognition.maxAlternatives = opts.maxAlternatives;

      // Handle results
      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcriptText = result[0].transcript;

          if (result.isFinal) {
            final += transcriptText + ' ';
          } else {
            interim += transcriptText;
          }
        }

        // Update state
        if (interim) {
          setInterimTranscript(interim);
          setTranscript(finalTranscript + interim);
        }

        if (final) {
          const newFinal = finalTranscript + final;
          setFinalTranscript(newFinal);
          finalTranscriptRef.current = newFinal; // Update ref
          setTranscript(newFinal);
          setInterimTranscript('');
          opts.onTranscriptChange?.(newFinal);
        }

        // Reset silence timer on speech detection
        clearSilenceTimers();
        startSilenceDetection();

        log.debug('Speech detected', { interim, final });
      };

      // Handle errors
      recognition.onerror = (event: any) => {
        const errorMsg = `Speech recognition error: ${event.error}`;
        log.error(errorMsg, event);
        setError(errorMsg);
        setState('error');
        opts.onError?.({ error: event.error, message: errorMsg });

        clearSilenceTimers();
        setIsRecording(false);
      };

      // Handle end
      recognition.onend = () => {
        const finalText = finalTranscriptRef.current;
        log.info('Recognition ended', { finalTranscript: finalText });
        clearSilenceTimers();
        setIsRecording(false);
        setState('idle');

        // Only trigger callback if we still have text (wasn't triggered by silence timeout)
        if (finalText && finalText.trim()) {
          log.info('Triggering onFinalTranscript callback from onend', { text: finalText });
          opts.onFinalTranscript?.(finalText);
          finalTranscriptRef.current = '';
        }
      };

      // Handle start
      recognition.onstart = () => {
        log.info('Recording started');
        console.log('useSpeechRecognition: Setting isRecording to true');
        setIsRecording(true);
        setState('recording');
        setError(null);
        startSilenceDetection();
      };

      recognitionRef.current = recognition;
      recognition.start();

    } catch (err: any) {
      const errorMsg = err.name === 'NotAllowedError'
        ? 'Microphone permission denied'
        : 'Failed to start recording';

      log.error(errorMsg, err);
      setError(errorMsg);
      setState('error');
      opts.onError?.({ error: err.name, message: errorMsg });
    }
  }, [
    isSupported,
    isRecording,
    opts,
    finalTranscript,
    startSilenceDetection,
    clearSilenceTimers,
  ]);

  // Cleanup on unmount - consolidate all timer and recognition cleanup
  useEffect(() => {
    return () => {
      // Clear all timers
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (silenceCountdownRef.current) {
        clearInterval(silenceCountdownRef.current);
        silenceCountdownRef.current = null;
      }

      // Stop recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          // Ignore errors on cleanup
        }
      }
    };
  }, []); // No dependencies - cleanup function uses refs directly

  return {
    // State
    isRecording,
    state,
    transcript,
    interimTranscript,
    finalTranscript,
    error,
    isSupported,
    silenceTimeRemaining,

    // Actions
    startRecording,
    stopRecording,
    resetTranscript,
  };
}
