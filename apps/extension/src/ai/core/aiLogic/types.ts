/**
 * Types for AI Logic Module
 * Shared interfaces and type definitions
 */

import type { UIMessage } from 'ai';
import type { AppUsage } from '../../types/usage';

/**
 * Provider types supported by the AI logic
 */
export type AIProvider = 'local' | 'google' | 'vertex' | 'openai' | 'anthropic' | 'xai';

/**
 * Parameters for streamAIResponse function
 */
export interface StreamAIParams {
    /** Chat history to send to the model */
    messages: UIMessage[];
    /** Optional signal to abort the request */
    abortSignal?: AbortSignal;
    /** Optional page context from conversation start */
    initialPageContext?: string;
    /** Optional callback for error events */
    onError?: (error: Error) => void;
    /** Optional callback for token usage updates */
    onUsageUpdate?: (usage: AppUsage) => void;
    /** Optional workflow ID for workflow-specific behavior */
    workflowId?: string;
    /** Thread ID for workflow session management */
    threadId?: string;
    /** Callback when AI completes response (for notifications, etc.) */
    onFinishCallback?: () => void;
}

/**
 * State tracked during stream execution
 */
export interface StreamState {
    /** Current AI provider */
    provider: AIProvider;
    /** Effective mode (local or remote) */
    effectiveMode: 'local' | 'remote';
    /** Whether search mode is active */
    isSearchModeActive: boolean;
    /** Initial active tools for mode switching */
    initialActiveTools?: string[];
    /** Enhanced system prompt with page context */
    enhancedPrompt: string;
    /** Model instance */
    model: any;
    /** Tools registry */
    tools: Record<string, any>;
}
