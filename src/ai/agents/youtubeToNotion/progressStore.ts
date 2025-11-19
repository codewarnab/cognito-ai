/**
 * Progress Store - In-memory event store for workflow progress updates
 * 
 * Enables agents to emit progress updates that UI components can subscribe to.
 * Uses singleton pattern for global access. Supports multiple concurrent workflows.
 */

import { createLogger } from '@logger';
import type { ProgressUpdate, ProgressListener } from './progressTypes';

const log = createLogger('ProgressStore');

class ProgressStore {
    private updates: Map<string, ProgressUpdate> = new Map();
    private listeners: Set<ProgressListener> = new Set();
    private currentWorkflowId: string | null = null;
    private updateOrder: string[] = [];

    /**
     * Start new workflow - clears previous updates
     */
    startWorkflow(workflowId: string): void {
        log.info('🚀 Starting new workflow', { workflowId });
        this.currentWorkflowId = workflowId;
        this.updates.clear();
        this.updateOrder = [];
        this.notifyListeners();
    }

    /**
     * Get current workflow ID
     */
    getCurrentWorkflowId(): string | null {
        return this.currentWorkflowId;
    }

    /**
     * Add progress update and return its ID
     */
    add(update: Omit<ProgressUpdate, 'id' | 'timestamp'>): string {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const fullUpdate: ProgressUpdate = {
            ...update,
            id,
            timestamp: Date.now()
        };

        this.updates.set(id, fullUpdate);
        this.updateOrder.push(id);

        log.debug('➕ Progress update added', {
            id,
            title: fullUpdate.title,
            status: fullUpdate.status,
            type: fullUpdate.type
        });

        this.notifyListeners();

        return id;
    }

    /**
     * Update existing progress step
     */
    update(id: string, changes: Partial<Omit<ProgressUpdate, 'id'>>): void {
        const existing = this.updates.get(id);
        if (!existing) {
            log.warn('⚠️ Update failed: ID not found', { id });
            return;
        }

        const updated: ProgressUpdate = {
            ...existing,
            ...changes,
            timestamp: Date.now()
        };

        this.updates.set(id, updated);

        log.debug('🔄 Progress update modified', {
            id,
            title: updated.title,
            status: updated.status
        });

        this.notifyListeners();
    }

    /**
     * Subscribe to progress updates
     * Returns unsubscribe function
     */
    subscribe(callback: ProgressListener): () => void {
        this.listeners.add(callback);

        log.debug('👂 Listener subscribed', {
            listenerCount: this.listeners.size
        });

        // Immediately call with current state (trigger update)
        const triggerUpdate: ProgressUpdate = {
            id: 'init',
            title: '',
            status: 'pending',
            timestamp: Date.now()
        };
        callback(triggerUpdate);

        return () => {
            this.listeners.delete(callback);
            log.debug('👋 Listener unsubscribed', {
                listenerCount: this.listeners.size
            });
        };
    }

    /**
     * Get all updates in order
     */
    getAll(): ProgressUpdate[] {
        return this.updateOrder
            .map(id => this.updates.get(id))
            .filter((u): u is ProgressUpdate => u !== undefined);
    }

    /**
     * Clear all updates
     */
    clear(): void {
        log.info('🧹 Clearing all progress updates');
        this.updates.clear();
        this.updateOrder = [];
        this.currentWorkflowId = null;
        this.notifyListeners();
    }

    /**
     * Notify all listeners of update
     */
    private notifyListeners(): void {
        // Create a dummy update to trigger re-render
        const triggerUpdate: ProgressUpdate = {
            id: 'trigger',
            title: '',
            status: 'pending',
            timestamp: Date.now()
        };

        this.listeners.forEach(listener => {
            try {
                listener(triggerUpdate);
            } catch (error) {
                log.error('❌ Listener error:', error);
            }
        });
    }
}

// Singleton instance
export const progressStore = new ProgressStore();
