/**
 * Voice Mode Store
 *
 * Manages voice recording state (text mode) and ElevenLabs voice mode state.
 * Replaces useVoiceRecording hook.
 */

import { create } from 'zustand';
import { createLogger } from '~logger';
import type { VoiceModeState, VoiceConnectionStatus } from './types';

const log = createLogger('VoiceModeStore', 'VOICE');

export const useVoiceModeStore = create<VoiceModeState>((set, get) => ({
  // Recording state (text mode voice input)
  isRecording: false,
  showRecordingPill: false,

  // ElevenLabs voice mode
  isVoiceModeActive: false,
  connectionStatus: 'disconnected',
  isSpeaking: false,

  // Error state
  lastError: null,
  showSetupNotification: false,

  // Actions - Recording (text mode)
  setIsRecording: (recording) => set({ isRecording: recording }),

  setShowRecordingPill: (show) => set({ showRecordingPill: show }),

  handleRecordingChange: (recording) => {
    log.debug('Recording state changed', { recording });
    set({
      isRecording: recording,
      showRecordingPill: recording,
    });

    if (recording) {
      log.info('Voice recording started');
    }
  },

  // Actions - Voice Mode (ElevenLabs)
  setConnectionStatus: (status) => {
    log.debug('Connection status changed', { status });
    set({ connectionStatus: status });
  },

  setIsVoiceModeActive: (active) => set({ isVoiceModeActive: active }),

  setIsSpeaking: (speaking) => set({ isSpeaking: speaking }),

  setLastError: (error) => set({ lastError: error }),

  setShowSetupNotification: (show) => set({ showSetupNotification: show }),

  // Actions - Reset
  resetVoiceMode: () => {
    log.info('Resetting voice mode state');
    set({
      isRecording: false,
      showRecordingPill: false,
      isVoiceModeActive: false,
      connectionStatus: 'disconnected',
      isSpeaking: false,
      lastError: null,
      showSetupNotification: false,
    });
  },
}));

// Selectors for optimized re-renders
export const selectIsRecording = (state: VoiceModeState) => state.isRecording;
export const selectShowRecordingPill = (state: VoiceModeState) => state.showRecordingPill;
export const selectConnectionStatus = (state: VoiceModeState) => state.connectionStatus;
export const selectIsSpeaking = (state: VoiceModeState) => state.isSpeaking;
export const selectLastError = (state: VoiceModeState) => state.lastError;
