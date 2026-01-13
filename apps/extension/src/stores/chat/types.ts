/**
 * Chat & Model Store Types
 * 
 * ## Mode Types in Extension
 * 
 * | Type | Values | Purpose | Store |
 * |------|--------|---------|-------|
 * | AIProviderMode | local/remote | Where AI runs | useModelStore.mode |
 * | ToolsMode | chat/agent/adaptive/custom | Available tools | useToolsStore.currentMode |
 * | ChatMode | text/voice | Input method | useUINavigationStore.chatMode |
 * | Backend Mode | boolean | Use hosted API | useSettingsStore.useBackendMode |
 * 
 * See `@/components/features/chat/types.ts` for detailed documentation.
 */

import type { UIMessage } from 'ai';
import type { AppUsage } from '@/types/ai/usage';

// ============================================================================
// Model Store Types
// ============================================================================

/**
 * AI Provider Mode - where the AI inference runs
 * 
 * - `local`: Uses Chrome's built-in AI (on-device Gemini Nano)
 * - `remote`: Uses cloud API (Gemini Pro/Flash)
 */
export type AIProviderMode = 'local' | 'remote';

/**
 * AIMode - alias for AIProviderMode
 * 
 * Many files import `AIMode` instead of `AIProviderMode`.
 * Both refer to the same concept: where AI inference runs.
 */
export type AIMode = AIProviderMode;

export type RemoteModel = 'gemini-3-flash-preview' | 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'gemini-3-pro-preview';

export interface ModelState {
  /** Current AI mode */
  mode: AIProviderMode;
  /** Selected remote model */
  remoteModel: RemoteModel;
  /** Selected remote provider */
  remoteProvider: string;
  /** Whether API key is configured */
  hasApiKey: boolean;
  /** Mode at conversation start (for agent mode detection) */
  conversationStartMode: AIProviderMode | null;
  /** Loading state during initialization */
  isLoading: boolean;
  /** Hydration state */
  isHydrated: boolean;

  // Actions
  setMode: (mode: AIProviderMode) => void;
  setRemoteModel: (model: RemoteModel) => void;
  setRemoteProvider: (provider: string) => void;
  setConversationStartMode: (mode: AIProviderMode | null) => void;
  clearConversationStartMode: () => void;
  refreshApiKeyStatus: () => Promise<void>;
  initialize: () => Promise<void>;
}

// ============================================================================
// Chat Store Types
// ============================================================================

export type ChatStatus = 'idle' | 'submitted' | 'streaming' | 'error';

export interface ErrorToast {
  message: string;
  details?: string;
}

export interface ChatState {
  /** Current thread ID */
  currentThreadId: string | null;
  /** Messages in current thread */
  messages: UIMessage[];
  /** Chat status */
  status: ChatStatus;
  /** Computed loading state */
  isLoading: boolean;
  /** Token usage for current conversation */
  usage: AppUsage | null;
  /** Context warning percentage (shown when >= 85%) */
  contextWarningPercent: number | null;
  /** Last error */
  lastError: Error | null;
  /** Error toast to display */
  errorToast: ErrorToast | null;
  /** Current input text */
  input: string;
  /** Hydration state */
  isHydrated: boolean;

  // Thread Management Actions
  setCurrentThreadId: (id: string | null) => void;
  createNewThread: () => Promise<string>;
  selectThread: (threadId: string) => Promise<void>;
  clearChat: () => Promise<void>;

  // Message Actions
  setMessages: (messages: UIMessage[]) => void;
  addMessage: (message: UIMessage) => void;
  updateMessage: (id: string, updates: Partial<UIMessage>) => void;
  removeMessage: (id: string) => void;

  // Input Actions
  setInput: (input: string) => void;
  clearInput: () => void;

  // Usage Actions
  setUsage: (usage: AppUsage | null) => void;
  resetUsage: () => void;

  // Status Actions
  setStatus: (status: ChatStatus) => void;
  setError: (error: Error | null) => void;
  showErrorToast: (message: string, details?: string) => void;
  dismissErrorToast: () => void;

  // Initialize
  initialize: () => Promise<void>;
}
