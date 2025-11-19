/**
 * Workflow Session Manager
 * 
 * Manages active workflow sessions to ensure the workflow prompt
 * and tool restrictions persist across multiple tool calls.
 * 
 * Key Problem Solved:
 * - When AI makes tool calls, the stream ends and restarts
 * - Without session management, subsequent requests lose workflow context
 * - This manager stores active workflow state by threadId
 */

import { createLogger } from '@logger';
import type { WorkflowDefinition } from './types';

const log = createLogger('Workflow-Session');

interface WorkflowSession {
    threadId: string;
    workflowId: string;
    workflow: WorkflowDefinition;
    startedAt: number;
}

class WorkflowSessionManager {
    private sessions: Map<string, WorkflowSession> = new Map();

    /**
     * Start a workflow session for a thread
     */
    startSession(threadId: string, workflow: WorkflowDefinition): void {
        log.info('🚀 Starting workflow session', {
            threadId,
            workflowId: workflow.id,
            workflowName: workflow.name
        });

        this.sessions.set(threadId, {
            threadId,
            workflowId: workflow.id,
            workflow,
            startedAt: Date.now()
        });
    }

    /**
     * Get active workflow for a thread (if any)
     */
    getSession(threadId: string): WorkflowSession | null {
        return this.sessions.get(threadId) || null;
    }

    /**
     * Check if a thread has an active workflow session
     */
    hasSession(threadId: string): boolean {
        return this.sessions.has(threadId);
    }

    /**
     * End a workflow session
     */
    endSession(threadId: string): void {
        const session = this.sessions.get(threadId);
        if (session) {
            const duration = Date.now() - session.startedAt;
            log.info('🏁 Ending workflow session', {
                threadId,
                workflowId: session.workflowId,
                durationMs: duration
            });
            this.sessions.delete(threadId);
        }
    }

    /**
     * Clear all sessions
     */
    clearAll(): void {
        log.info('🧹 Clearing all workflow sessions', {
            count: this.sessions.size
        });
        this.sessions.clear();
    }

    /**
     * Get session count
     */
    getSessionCount(): number {
        return this.sessions.size;
    }

    /**
     * Get all active sessions
     */
    getAllSessions(): WorkflowSession[] {
        return Array.from(this.sessions.values());
    }
}

// Singleton instance
const sessionManager = new WorkflowSessionManager();

export { sessionManager as workflowSessionManager };
export type { WorkflowSession };
