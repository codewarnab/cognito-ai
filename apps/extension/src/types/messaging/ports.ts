/**
 * Port-Based Communication Types
 *
 * Type definitions for streaming connections: summarizer, writer, rewriter.
 * These ports are used for long-running or streaming operations.
 *
 * @see /docs/TYPE_SAFE_MESSAGING.md for API reference
 */

import type {
    SummaryType,
    SummaryLength,
    PageContext,
} from '@/types/textSummarizer';
import type {
    WriteTone,
    WritePageContext,
    WriteAttachmentPayload,
} from '@/types/writeCommand';
import type { RewritePreset, RewritePageContext } from '@/types/rewriteCommand';

// =============================================================================
// PORT NAMES
// =============================================================================

/**
 * Valid port names for streaming connections
 */
export type PortName = 'text-summarizer' | 'write-command' | 'text-rewriter';

// =============================================================================
// SUMMARIZER PORT MESSAGES
// =============================================================================

/**
 * Summarizer port outgoing messages (content script → background)
 */
export interface SummarizerPortOutgoing {
    /** Request to summarize text */
    SUMMARIZE_REQUEST: {
        text: string;
        pageContext: PageContext;
        settings?: {
            summaryType?: SummaryType;
            summaryLength?: SummaryLength;
        };
    };
}

/**
 * Summarizer port incoming messages (background → content script)
 */
export interface SummarizerPortIncoming {
    /** Streaming chunk of the summary */
    SUMMARIZE_STREAM_CHUNK: {
        text: string;
        done: boolean;
    };
    /** Error during summarization */
    SUMMARIZE_ERROR: {
        error: string;
        code?: string;
    };
}

/**
 * Summarizer port message types
 */
export interface SummarizerPortMessages {
    outgoing: SummarizerPortOutgoing;
    incoming: SummarizerPortIncoming;
}

// =============================================================================
// WRITER PORT MESSAGES
// =============================================================================

/**
 * Writer port outgoing messages (content script → background)
 */
export interface WriterPortOutgoing {
    /** Request to generate text */
    WRITE_GENERATE: {
        prompt: string;
        pageContext?: WritePageContext;
        settings?: {
            tone?: WriteTone;
            maxTokens?: number;
            enableUrlContext?: boolean;
            enableGoogleSearch?: boolean;
            enableSupermemorySearch?: boolean;
        };
        attachment?: WriteAttachmentPayload;
    };
}

/**
 * Writer port incoming messages (background → content script)
 */
export interface WriterPortIncoming {
    /** Streaming chunk of generated text */
    WRITE_STREAM_CHUNK: {
        text: string;
        done: boolean;
    };
    /** Error during text generation */
    WRITE_ERROR: {
        error: string;
        code?: string;
    };
}

/**
 * Writer port message types
 */
export interface WriterPortMessages {
    outgoing: WriterPortOutgoing;
    incoming: WriterPortIncoming;
}

// =============================================================================
// REWRITER PORT MESSAGES
// =============================================================================

/**
 * Rewriter port outgoing messages (content script → background)
 */
export interface RewriterPortOutgoing {
    /** Request to rewrite text */
    REWRITE_REQUEST: {
        selectedText: string;
        instruction: string;
        preset?: RewritePreset;
        pageContext?: RewritePageContext;
        enableUrlContext?: boolean;
        enableGoogleSearch?: boolean;
        enableSupermemorySearch?: boolean;
    };
}

/**
 * Rewriter port incoming messages (background → content script)
 */
export interface RewriterPortIncoming {
    /** Complete rewritten text (non-streaming) */
    REWRITE_COMPLETE: {
        text: string;
    };
    /** Error during rewriting */
    REWRITE_ERROR: {
        error: string;
        code?: string;
    };
}

/**
 * Rewriter port message types
 */
export interface RewriterPortMessages {
    outgoing: RewriterPortOutgoing;
    incoming: RewriterPortIncoming;
}

// =============================================================================
// PORT MESSAGE MAP
// =============================================================================

/**
 * Maps port names to their message types
 */
export interface PortMessageMap {
    'text-summarizer': SummarizerPortMessages;
    'write-command': WriterPortMessages;
    'text-rewriter': RewriterPortMessages;
}

// =============================================================================
// TYPE UTILITIES
// =============================================================================

/**
 * Get outgoing message types for a port
 */
export type PortOutgoingMessages<P extends PortName> = PortMessageMap[P]['outgoing'];

/**
 * Get incoming message types for a port
 */
export type PortIncomingMessages<P extends PortName> = PortMessageMap[P]['incoming'];

/**
 * Get all outgoing action names for a port
 */
export type PortOutgoingAction<P extends PortName> = keyof PortOutgoingMessages<P>;

/**
 * Get all incoming action names for a port
 */
export type PortIncomingAction<P extends PortName> = keyof PortIncomingMessages<P>;

/**
 * Get the payload type for an outgoing action
 */
export type PortOutgoingPayload<
    P extends PortName,
    A extends PortOutgoingAction<P>,
> = PortOutgoingMessages<P>[A];

/**
 * Get the payload type for an incoming action
 */
export type PortIncomingPayload<
    P extends PortName,
    A extends PortIncomingAction<P>,
> = PortIncomingMessages<P>[A];

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Check if a value is a valid port name
 */
export function isPortName(value: unknown): value is PortName {
    return (
        typeof value === 'string' &&
        (value === 'text-summarizer' ||
            value === 'write-command' ||
            value === 'text-rewriter')
    );
}

/**
 * Check if a message has a valid action property
 */
export function isPortMessage(
    message: unknown
): message is { action: string;[key: string]: unknown } {
    return (
        typeof message === 'object' &&
        message !== null &&
        'action' in message &&
        typeof (message as { action: unknown }).action === 'string'
    );
}

/**
 * Check if a message is a specific outgoing action for a port
 */
export function isOutgoingAction<P extends PortName, A extends PortOutgoingAction<P>>(
    _portName: P,
    message: unknown,
    action: A
): message is { action: A } & PortOutgoingPayload<P, A> {
    return isPortMessage(message) && message.action === action;
}

/**
 * Check if a message is a specific incoming action for a port
 */
export function isIncomingAction<P extends PortName, A extends PortIncomingAction<P>>(
    _portName: P,
    message: unknown,
    action: A
): message is { action: A } & PortIncomingPayload<P, A> {
    return isPortMessage(message) && message.action === action;
}
