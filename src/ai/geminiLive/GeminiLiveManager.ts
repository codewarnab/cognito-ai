/**
 * GeminiLiveManager - Singleton Manager for GeminiLiveClient
 * 
 * Architecture Pattern: Singleton with Instance Management
 * 
 * Purpose:
 * - Prevents multiple simultaneous instances of GeminiLiveClient
 * - Ensures proper cleanup before creating new instances
 * - Provides centralized access to the active voice client
 * - Handles lifecycle management and state transitions
 * 
 * Benefits:
 * - Resource efficiency (only one WebSocket connection)
 * - Prevents audio conflicts (one microphone stream)
 * - Avoids WebSocket quota exhaustion
 * - Cleaner state management
 */

import { GeminiLiveClient, type GeminiLiveClientConfig } from './client';
import { createLogger } from '../../logger';

const log = createLogger('GeminiLiveManager');

/**
 * Manager state
 */
type ManagerState = 'idle' | 'initializing' | 'active' | 'cleaning';

/**
 * Singleton Manager for GeminiLiveClient instances
 */
export class GeminiLiveManager {
    private static instance: GeminiLiveManager | null = null;
    private activeClient: GeminiLiveClient | null = null;
    private state: ManagerState = 'idle';
    private initializationPromise: Promise<GeminiLiveClient> | null = null;
    private cleanupPromise: Promise<void> | null = null;
    private instanceId: number = 0;

    private constructor() {
        log.info('🎯 GeminiLiveManager initialized (Singleton)');
    }

    /**
     * Get the singleton instance
     */
    public static getInstance(): GeminiLiveManager {
        if (!GeminiLiveManager.instance) {
            GeminiLiveManager.instance = new GeminiLiveManager();
        }
        return GeminiLiveManager.instance;
    }

    /**
     * Get or create a client instance
     * If an instance exists, cleanup and create new one
     * If initialization is in progress, wait for it
     */
    public async getClient(config: GeminiLiveClientConfig): Promise<GeminiLiveClient> {
        // If currently cleaning up, wait for cleanup to complete
        if (this.cleanupPromise) {
            log.info('⏳ Waiting for cleanup to complete before creating new instance...');
            await this.cleanupPromise;
        }

        // If initialization is in progress, return the same promise
        if (this.initializationPromise) {
            log.info('⏳ Initialization already in progress, waiting...');
            return this.initializationPromise;
        }

        // If there's an active client that's not cleaned up, return it instead of creating a new one
        if (this.activeClient && this.state === 'active') {
            const diagnostics = this.activeClient.getDiagnostics();
            if (!diagnostics.isCleanedUp) {
                log.info('✅ Reusing existing active client', { instanceId: diagnostics.instanceId });
                return this.activeClient;
            }
        }

        // If there's an active client that's cleaned up, we need to create a new one
        if (this.activeClient) {
            log.warn('⚠️ Active client exists but is cleaned up, creating new instance');
            this.activeClient = null;
            this.state = 'idle';
        }

        // Start initialization
        this.state = 'initializing';
        this.instanceId++;
        const currentInstanceId = this.instanceId;

        log.info(`🚀 Creating new GeminiLiveClient instance #${currentInstanceId}`);

        this.initializationPromise = (async () => {
            try {
                const client = new GeminiLiveClient(config);
                await client.initialize();

                // Double-check we haven't been cleaned up during initialization
                if (this.instanceId !== currentInstanceId) {
                    log.warn('⚠️ Instance ID changed during initialization, discarding this instance');
                    client.cleanup();
                    throw new Error('Instance was superseded during initialization');
                }

                this.activeClient = client;
                this.state = 'active';
                this.initializationPromise = null;

                log.info(`✅ GeminiLiveClient instance #${currentInstanceId} initialized successfully`);
                return client;

            } catch (error) {
                this.state = 'idle';
                this.initializationPromise = null;
                this.activeClient = null;

                log.error(`❌ Failed to initialize GeminiLiveClient instance #${currentInstanceId}:`, error);
                throw error;
            }
        })();

        return this.initializationPromise;
    }

    /**
     * Get the active client (if any) without creating a new one
     */
    public getActiveClient(): GeminiLiveClient | null {
        return this.activeClient;
    }

    /**
     * Check if a client is currently active
     */
    public hasActiveClient(): boolean {
        return this.activeClient !== null && this.state === 'active';
    }

    /**
     * Get current manager state
     */
    public getState(): ManagerState {
        return this.state;
    }

    /**
     * Cleanup the active client
     * Safe to call multiple times
     */
    public async cleanup(): Promise<void> {
        // If already cleaning up, wait for it
        if (this.cleanupPromise) {
            log.info('⏳ Cleanup already in progress, waiting...');
            return this.cleanupPromise;
        }

        // If no active client, nothing to clean
        if (!this.activeClient && this.state === 'idle') {
            log.info('✅ No active client to cleanup');
            return;
        }

        this.state = 'cleaning';
        const clientToClean = this.activeClient;

        log.info('🧹 Starting cleanup of active GeminiLiveClient instance...');

        this.cleanupPromise = (async () => {
            try {
                // Stop session if active
                if (clientToClean?.isActive()) {
                    log.info('⏹️ Stopping active session...');
                    await clientToClean.stopSession();
                }

                // Cleanup resources
                if (clientToClean) {
                    log.info('🗑️ Cleaning up client resources...');
                    clientToClean.cleanup();
                }

                this.activeClient = null;
                this.state = 'idle';
                this.cleanupPromise = null;

                log.info('✅ Cleanup completed successfully');

            } catch (error) {
                log.error('❌ Error during cleanup:', error);
                // Force state reset even on error
                this.activeClient = null;
                this.state = 'idle';
                this.cleanupPromise = null;
            }
        })();

        return this.cleanupPromise;
    }

    /**
     * Force reset the manager state
     * Use with caution - for error recovery only
     */
    public forceReset(): void {
        log.warn('⚠️ Force resetting GeminiLiveManager state');

        if (this.activeClient) {
            try {
                this.activeClient.cleanup();
            } catch (error) {
                log.error('Error during force cleanup:', error);
            }
        }

        this.activeClient = null;
        this.state = 'idle';
        this.initializationPromise = null;
        this.cleanupPromise = null;
        this.instanceId++;

        log.info('✅ Manager state force reset');
    }

    /**
     * Get diagnostic information
     */
    public getDiagnostics(): {
        state: ManagerState;
        hasActiveClient: boolean;
        isInitializing: boolean;
        isCleaningUp: boolean;
        instanceId: number;
        clientStatus: string | null;
    } {
        return {
            state: this.state,
            hasActiveClient: this.activeClient !== null,
            isInitializing: this.initializationPromise !== null,
            isCleaningUp: this.cleanupPromise !== null,
            instanceId: this.instanceId,
            clientStatus: this.activeClient?.getStatus() ?? null,
        };
    }
}

/**
 * Convenience function to get the manager instance
 */
export function getGeminiLiveManager(): GeminiLiveManager {
    return GeminiLiveManager.getInstance();
}
