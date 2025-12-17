/**
 * Zustand Stores - Central Export
 *
 * All stores are exported from here for easy imports.
 */

// Settings Store
export { useSettingsStore } from './settings/settingsStore';
export type { SettingsState } from './settings/types';

// UI Navigation Store
export { useUINavigationStore } from './ui/navigationStore';
export type { Panel, UINavigationState } from './ui/types';

// Model Store
export { useModelStore } from './chat/modelStore';
export type { ModelState, AIMode, RemoteModel } from './chat/types';

// Chat Store
export {
  useChatStore,
  selectIsLoading,
  selectMessages,
  selectUsage,
  selectStatus,
  selectCurrentThreadId,
} from './chat/chatStore';
export type { ChatState, ChatStatus, ErrorToast } from './chat/types';

// Attachments Store
export { useAttachmentsStore } from './attachments/attachmentsStore';
export type {
  AttachmentsState,
  LocalPdfInfo,
  YouTubeVideoInfo,
  YouTubeVideoMetadata,
  SelectedTextInfo,
} from './attachments/types';

// Tools Store
export {
  useToolsStore,
  selectEnabledMap,
  selectCurrentMode,
  selectDisplayMode,
  selectMcpTools,
  selectMcpDisabledTools,
  selectTotalEnabledCount,
  selectIsTooManyTools,
  selectShowToolsModal,
  selectToolSearchQuery,
  selectExpandedCategories,
  selectSupermemoryConfigured,
  selectIsInitialized,
} from './tools/toolsStore';
export type { ToolsState, ToolMode, McpToolWithServer, WebMcpTool } from './tools/types';

// Voice Mode Store
export {
  useVoiceModeStore,
  selectIsRecording,
  selectShowRecordingPill,
  selectConnectionStatus,
  selectIsSpeaking,
  selectLastError,
} from './voice/voiceModeStore';
export type { VoiceModeState, VoiceConnectionStatus, VoiceModeStatus } from './voice/types';

// MCP Store
export {
  useMcpStore,
  selectServerStatuses,
  selectCustomServers,
  selectMcpToolCount,
  selectCloudToolCount,
  selectTotalToolCount,
  selectSearchQuery,
  selectActiveView,
  selectSelectedServerId,
  selectIsInitialized as selectMcpIsInitialized,
} from './mcp/mcpStore';
export type { McpState, McpServerStatus, CustomServerData } from './mcp/types';
