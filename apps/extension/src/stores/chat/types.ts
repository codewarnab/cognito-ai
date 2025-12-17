/**
 * Chat & Model Store Types
 */

import type { UIMessage } from 'ai';
import type { AppUsage } from '@/types/ai/usage';

// ============================================================================
// Model Store Types
// ============================================================================

export type AIMode = 'local' | 'remote' | 'agent' | 'adaptive';
export type RemoteModel = 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'gemini-3-pro-preview';

export interface ModelState {
  /** Current AI mode */
  mode: AIMode;
  /** Selected remote model */
  remoteModel: RemoteModel;
  /** Whether API key is configured */
  hasApiKey: boolean;
  /** Mode at conversation start (for agent mode detection) */
  conversationStartMode: AIMode | null;
  /** Loading state during initialization */
  isLoading: boolean;
  /** Hydration state */
  isHydrated: boolean;

  // Actions
  setMode: (mode: AIMode) => void;
  setRemoteModel: (model: RemoteModel) => void;
  setConversationStartMode: (mode: AIMode | null) => void;
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
