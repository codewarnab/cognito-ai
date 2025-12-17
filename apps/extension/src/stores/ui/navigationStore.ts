/**
 * UI Navigation Store
 * 
 * Centralized UI navigation state management.
 * Replaces useSidepanelUiState hook for panel/view visibility.
 */
import { create } from 'zustand';
import type { Panel, ChatMode, UINavigationState } from './types';

export const useUINavigationStore = create<UINavigationState>((set, get) => ({
  // Initial state
  activePanel: 'chat',
  isThreadsPanelOpen: false,
  isRemindersPanelOpen: false,
  chatMode: 'text',
  isVoiceFabVisible: true,
  isImagePreviewOpen: false,
  imagePreviewUrl: null,
  showChatInterface: true,

  // Actions
  navigateTo: (panel: Panel) => {
    // Close overlays when navigating to a new panel
    set({
      activePanel: panel,
      isThreadsPanelOpen: false,
      isRemindersPanelOpen: false,
    });
  },

  openOverlay: (overlay) => {
    if (overlay === 'threads') {
      set({ isThreadsPanelOpen: true });
    } else if (overlay === 'reminders') {
      set({ isRemindersPanelOpen: true });
    }
  },

  closeOverlay: (overlay) => {
    if (overlay === 'threads') {
      set({ isThreadsPanelOpen: false });
    } else if (overlay === 'reminders') {
      set({ isRemindersPanelOpen: false });
    }
  },

  closeAllOverlays: () => {
    set({
      isThreadsPanelOpen: false,
      isRemindersPanelOpen: false,
    });
  },

  setChatMode: (mode: ChatMode) => set({ chatMode: mode }),

  setVoiceFabVisibility: (visible) => set({ isVoiceFabVisible: visible }),

  openImagePreview: (url) => {
    set({
      isImagePreviewOpen: true,
      imagePreviewUrl: url,
    });
  },

  closeImagePreview: () => {
    set({
      isImagePreviewOpen: false,
      imagePreviewUrl: null,
    });
  },

  setShowChatInterface: (show) => set({ showChatInterface: show }),

  goBack: () => {
    set({ activePanel: 'chat' });
  },
}));
