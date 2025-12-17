/**
 * UI Navigation Store Types
 */

export type Panel =
  | 'chat'
  | 'mcp'
  | 'settings'
  | 'threads'
  | 'reminders'
  | 'troubleshooting'
  | 'features'
  | 'providerSetup'
  | 'loggerPanel';

export type ChatMode = 'text' | 'voice';

export interface UINavigationState {
  // Current active panel
  activePanel: Panel;

  // Overlay panels (can be open while chat is visible)
  isThreadsPanelOpen: boolean;
  isRemindersPanelOpen: boolean;

  // Chat mode
  chatMode: ChatMode;

  // Voice FAB visibility
  isVoiceFabVisible: boolean;

  // Image preview (global overlay)
  isImagePreviewOpen: boolean;
  imagePreviewUrl: string | null;

  // Chat interface visibility (for onboarding)
  showChatInterface: boolean;

  // Actions
  navigateTo: (panel: Panel) => void;
  openOverlay: (overlay: 'threads' | 'reminders') => void;
  closeOverlay: (overlay: 'threads' | 'reminders') => void;
  closeAllOverlays: () => void;
  setChatMode: (mode: ChatMode) => void;
  setVoiceFabVisibility: (visible: boolean) => void;
  openImagePreview: (url: string) => void;
  closeImagePreview: () => void;
  setShowChatInterface: (show: boolean) => void;
  goBack: () => void;
}
