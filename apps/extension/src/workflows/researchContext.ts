/**
 * Research Workflow Context
 * 
 * Module-level state to track active research sessions.
 * This allows tools like readPageContent to detect when they're
 * running in a research workflow and auto-store content to IndexedDB.
 * 
 * @remarks
 * V2 UPDATE: Now stores original user request and research metadata
 * for complete context reset during synthesis phase transition.
 */

import { createLogger } from '~logger';
import {
    initResearchSession as initDbSession,
    getCurrentResearchSessionId,
    resetReportSectionCounter
} from '@/db';
import { resetTruncatedSources, resetSynthesisPhaseFlag } from './definitions/researchWorkflowPrepareStep';

const log = createLogger('ResearchContext', 'WORKFLOW_ENGINE');

/**
 * Research context state
 */
interface ResearchContextState {
    /** Whether a research workflow is currently active */
    isActive: boolean;
    /** Current research session ID (from IndexedDB layer) */
    sessionId: string | null;
    /** Thread ID associated with this research session */
    threadId: string | null;
    /** Timestamp when the session started */
    startedAt: number | null;
    /** Original user request (for synthesis phase) */
    userRequest: string | null;
    /** Research topic (set by getReportTemplate) */
    topic: string | null;
    /** Report type/template used (set by getReportTemplate) */
    reportType: string | null;
}

/**
 * Module-level state for research context
 */
let researchContext: ResearchContextState = {
    isActive: false,
    sessionId: null,
    threadId: null,
    startedAt: null,
    userRequest: null,
    topic: null,
    reportType: null,
};

/**
 * Start a research context for the current workflow
 * 
 * @param params - Context initialization parameters
 * @param params.threadId - The thread ID for this research session
 * @param params.userRequest - Optional original user request text
 * @returns The session ID for this research session
 * 
 * @remarks
 * Called when a research workflow starts. Initializes the IndexedDB
 * session and sets the module-level context so tools can detect it.
 * Resets all counters and flags for clean state.
 */
export function startResearchContext(params: {
    threadId: string;
    userRequest?: string;
}): string {
    const { threadId, userRequest } = params;

    // Reset all counters and flags for the new session
    resetTruncatedSources();
    resetReportSectionCounter();
    resetSynthesisPhaseFlag();

    // Initialize the IndexedDB session
    const sessionId = initDbSession();

    researchContext = {
        isActive: true,
        sessionId,
        threadId,
        startedAt: Date.now(),
        userRequest: userRequest || null,
        topic: null,
        reportType: null,
    };

    log.info('Research context started', {
        sessionId,
        threadId,
        hasUserRequest: !!userRequest,
    });

    return sessionId;
}

/**
 * Set research metadata (called by getReportTemplate tool)
 * 
 * @param params - Metadata to store
 * @param params.topic - Research topic
 * @param params.reportType - Report template type
 */
export function setResearchMetadata(params: {
    topic: string;
    reportType: string;
}): void {
    researchContext.topic = params.topic;
    researchContext.reportType = params.reportType;
    log.debug('Research metadata set', params);
}

/**
 * Get original user request
 * 
 * @returns The original user request text, or null if not set
 */
export function getOriginalUserRequest(): string | null {
    return researchContext.userRequest;
}

/**
 * Get research metadata
 * 
 * @returns Object with topic and reportType
 */
export function getResearchMetadata(): { topic: string | null; reportType: string | null } {
    return {
        topic: researchContext.topic,
        reportType: researchContext.reportType
    };
}

/**
 * End the current research context
 * 
 * @remarks
 * Called when a research workflow completes or is cancelled.
 * Clears the module-level context.
 */
export function endResearchContext(): void {
    if (researchContext.isActive) {
        const duration = researchContext.startedAt
            ? Date.now() - researchContext.startedAt
            : 0;

        log.info('Research context ended', {
            sessionId: researchContext.sessionId,
            threadId: researchContext.threadId,
            durationMs: duration,
        });
    }

    researchContext = {
        isActive: false,
        sessionId: null,
        threadId: null,
        startedAt: null,
        userRequest: null,
        topic: null,
        reportType: null,
    };
}

/**
 * Check if a research workflow is currently active
 * 
 * @returns True if a research workflow is active
 */
export function isResearchContextActive(): boolean {
    return researchContext.isActive;
}

/**
 * Get the current research context
 * 
 * @returns The current research context state, or null if not active
 */
export function getResearchContext(): ResearchContextState | null {
    if (!researchContext.isActive) {
        return null;
    }
    return { ...researchContext };
}

/**
 * Get the current research session ID
 * 
 * @returns The session ID if active, null otherwise
 * 
 * @remarks
 * This is a convenience function for tools that need the session ID.
 * Falls back to the IndexedDB layer's getCurrentResearchSessionId.
 */
export function getActiveResearchSessionId(): string | null {
    if (researchContext.isActive && researchContext.sessionId) {
        return researchContext.sessionId;
    }
    // Fallback to IndexedDB layer
    return getCurrentResearchSessionId();
}

/**
 * Check if the given thread has an active research context
 * 
 * @param threadId - The thread ID to check
 * @returns True if this thread has an active research context
 */
export function isResearchThread(threadId: string): boolean {
    return researchContext.isActive && researchContext.threadId === threadId;
}
