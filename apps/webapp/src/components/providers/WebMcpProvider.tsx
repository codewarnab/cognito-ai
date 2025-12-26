'use client';

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { initializeWebModelContext } from '@mcp-b/global';
import { WebMcpContext } from './WebMcpContext';
import { ToolRegistryProvider } from '@/components/webmcp/ToolRegistry';

export interface WebMcpProviderProps {
    children: ReactNode;
}

/**
 * WebMCP Provider
 * 
 * Initializes the WebMCP environment and provides context to child components.
 * This ensures `navigator.modelContext` API is ready for use by tools.
 */
export default function WebMcpProvider({ children }: WebMcpProviderProps) {
    const [isAvailable, setIsAvailable] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const initializationAttemptedRef = useRef(false);

    useEffect(() => {
        // Skip on server-side
        if (typeof window === 'undefined' || typeof navigator === 'undefined') {
            return;
        }

        // Check if browser supports modelContext (or extension is installed)
        if (!('modelContext' in navigator)) {
            console.warn('[WebMCP] navigator.modelContext not available. WebMCP tools will not be registered.');
            setIsAvailable(false);
            return;
        }

        setIsAvailable(true);

        // Prevent double initialization
        if (initializationAttemptedRef.current || isInitialized) {
            return;
        }
        initializationAttemptedRef.current = true;

        try {
            // Initialize the global WebMCP context
            initializeWebModelContext({
                transport: {
                    tabServer: { allowedOrigins: ['*'] },
                },
            });

            console.log('[WebMCP] Initialized successfully');
            setIsInitialized(true);
        } catch (err) {
            const normalizedError = err instanceof Error ? err : new Error('WebMCP initialization failed');
            setError(normalizedError);
            console.error('[WebMCP] Initialization failed:', normalizedError);
        }
    }, [isInitialized]);

    const contextValue = useMemo(() => ({
        isAvailable,
        isInitialized,
        error,
    }), [isAvailable, isInitialized, error]);

    return (
        <WebMcpContext.Provider value={contextValue}>
            <ToolRegistryProvider>
                {children}
            </ToolRegistryProvider>
        </WebMcpContext.Provider>
    );
}
