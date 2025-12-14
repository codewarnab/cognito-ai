/**
 * useSandbox Hook
 * 
 * React hook to initialize the sandbox bridge for code execution.
 * Should be used in the main App component to ensure the sandbox
 * is ready when needed by executeTools.
 */

import { useEffect, useState } from 'react';
import { initializeSandbox, isSandboxReady } from '@/ai/tools/meta/SandboxBridge';
import { createLogger } from '~logger';

const log = createLogger('useSandbox');

export interface UseSandboxResult {
    /** Whether the sandbox is ready for code execution */
    isReady: boolean;
    /** Whether the sandbox is currently initializing */
    isInitializing: boolean;
    /** Error message if initialization failed */
    error: string | null;
}

/**
 * Hook to initialize and manage the sandbox bridge lifecycle.
 * 
 * @returns Sandbox status including readiness and any errors
 */
export function useSandbox(): UseSandboxResult {
    const [isReady, setIsReady] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const init = async () => {
            try {
                log.info('Initializing sandbox...');
                setIsInitializing(true);
                setError(null);

                await initializeSandbox();

                if (mounted) {
                    setIsReady(true);
                    log.info('Sandbox initialized successfully');
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                log.error('Failed to initialize sandbox:', errorMessage);
                if (mounted) {
                    setError(errorMessage);
                    setIsReady(false);
                }
            } finally {
                if (mounted) {
                    setIsInitializing(false);
                }
            }
        };

        init();

        // Cleanup on unmount
        return () => {
            mounted = false;
            // Note: We don't destroy the sandbox on unmount because it's a singleton
            // that should persist across re-renders. Only destroy when the app closes.
        };
    }, []);

    return {
        isReady,
        isInitializing,
        error,
    };
}

/**
 * Check if the sandbox is currently ready.
 * Useful for non-React contexts.
 */
export function checkSandboxReady(): boolean {
    return isSandboxReady();
}
