'use client';

import { createContext, useContext } from 'react';

export interface WebMcpContextValue {
    /** Whether navigator.modelContext API is available */
    isAvailable: boolean;
    /** Whether WebMCP has been initialized */
    isInitialized: boolean;
    /** Initialization error, if any */
    error: Error | null;
}

export const WebMcpContext = createContext<WebMcpContextValue>({
    isAvailable: false,
    isInitialized: false,
    error: null,
});

/**
 * Hook to access WebMCP state
 */
export function useWebMcp(): WebMcpContextValue {
    const context = useContext(WebMcpContext);
    if (!context) {
        throw new Error('useWebMcp must be used within a WebMcpProvider');
    }
    return context;
}
