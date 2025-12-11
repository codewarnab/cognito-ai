/**
 * useElevenLabsClient - Custom hook for managing ElevenLabs Conversational AI
 * Replaces useGeminiLiveClient for ElevenLabs voice mode
 */

import { useConversation } from '@elevenlabs/react';
import { useState, useCallback, useRef } from 'react';
import { createLogger } from '~logger';
import { getSignedUrl } from '@/services/elevenlabs/api';
import { getSelectedVoiceId, getVoiceSettings } from '@/services/elevenlabs/settings';
import { buildDynamicVariables } from '@/services/elevenlabs/dynamicVariables';
import { buildClientTools } from '@/services/elevenlabs/clientTools';

const log = createLogger('useElevenLabsClient', 'VOICE_CLIENT');

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface UseElevenLabsClientOptions {
  onStatusChange?: (status: ConnectionStatus) => void;
  onError?: (error: string) => void;
  onMessage?: (message: { role: string; content: string }) => void;
  onModeChange?: (mode: 'speaking' | 'listening') => void;
}

export interface UseElevenLabsClientReturn {
  status: ConnectionStatus;
  isSpeaking: boolean;
  isConnected: boolean;
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;
  getInputVolume: () => number;
  getOutputVolume: () => number;
}

export function useElevenLabsClient(
  options: UseElevenLabsClientOptions = {}
): UseElevenLabsClientReturn {
  const { onStatusChange, onError, onMessage, onModeChange } = options;

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const isConnectingRef = useRef(false);

  // Build client tools for ElevenLabs
  const clientTools = buildClientTools();

  // Initialize ElevenLabs conversation hook
  const conversation = useConversation({
    clientTools,
    onConnect: () => {
      log.info('Connected to ElevenLabs');
      setConnectionStatus('connected');
      onStatusChange?.('connected');
    },
    onDisconnect: () => {
      log.info('Disconnected from ElevenLabs');
      setConnectionStatus('disconnected');
      onStatusChange?.('disconnected');
    },
    onMessage: (message) => {
      log.debug('Message received', { source: message.source });
      if (message.message) {
        onMessage?.({
          role: message.source === 'user' ? 'user' : 'assistant',
          content: message.message,
        });
      }
    },
    onError: (error) => {
      // ElevenLabs onError provides error as a string
      const errorMessage = typeof error === 'string' ? error : 'Unknown error';
      log.error('ElevenLabs error', { error: errorMessage });
      setConnectionStatus('error');
      onError?.(errorMessage);
    },
    onModeChange: (mode) => {
      log.debug('Mode changed', { mode: mode.mode });
      onModeChange?.(mode.mode === 'speaking' ? 'speaking' : 'listening');
    },
  });


  const startSession = useCallback(async () => {
    if (isConnectingRef.current || conversation.status === 'connected') {
      log.warn('Already connecting or connected');
      return;
    }

    isConnectingRef.current = true;
    setConnectionStatus('connecting');
    onStatusChange?.('connecting');

    try {
      // Get signed URL from Cloudflare Worker
      const signedUrl = await getSignedUrl();

      // Get user preferences in parallel
      const [voiceId, voiceSettings, dynamicVariables] = await Promise.all([
        getSelectedVoiceId(),
        getVoiceSettings(),
        buildDynamicVariables(),
      ]);

      log.info('Starting ElevenLabs session', {
        hasVoiceId: !!voiceId,
        enabledToolsCount: (dynamicVariables.capabilities_section ?? '').split('**').length - 1,
      });

      // Build overrides based on user settings
      const overrides: Record<string, unknown> = {};

      if (voiceId) {
        overrides.tts = {
          voiceId,
          stability: voiceSettings.stability,
          similarityBoost: voiceSettings.similarityBoost,
          speed: voiceSettings.speed,
        };
      }

      // Build worklet paths for CSP compliance in Chrome extensions
      // Chrome extensions block data: URLs in AudioWorklets, so we self-host the worklet files
      const workletPaths = {
        rawAudioProcessor: chrome.runtime.getURL(
          'assets/elevenlabs/rawAudioProcessor.worklet.js'
        ),
        audioConcatProcessor: chrome.runtime.getURL(
          'assets/elevenlabs/audioConcatProcessor.worklet.js'
        ),
      };

      log.debug('Using self-hosted worklet paths', { workletPaths });

      // Start the session with configuration
      await conversation.startSession({
        signedUrl,
        dynamicVariables,
        overrides,
        workletPaths,
      });

      log.info('ElevenLabs session started successfully', {
        hasVoiceOverride: !!overrides.tts,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect';
      log.error('Failed to start ElevenLabs session', { error: errorMessage });
      setConnectionStatus('error');
      onStatusChange?.('error');
      onError?.(errorMessage);
    } finally {
      isConnectingRef.current = false;
    }
  }, [conversation, onStatusChange, onError]);

  const endSession = useCallback(async () => {
    try {
      await conversation.endSession();
      log.info('ElevenLabs session ended');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error('Failed to end session', { error: errorMessage });
    }
  }, [conversation]);

  const getInputVolume = useCallback(() => {
    return conversation.getInputVolume?.() || 0;
  }, [conversation]);

  const getOutputVolume = useCallback(() => {
    return conversation.getOutputVolume?.() || 0;
  }, [conversation]);

  return {
    status: connectionStatus,
    isSpeaking: conversation.isSpeaking,
    isConnected: conversation.status === 'connected',
    startSession,
    endSession,
    getInputVolume,
    getOutputVolume,
  };
}
