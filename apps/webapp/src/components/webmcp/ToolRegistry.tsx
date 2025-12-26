'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface RegisteredTool {
    name: string;
    description: string;
    callCount: number;
    lastCalledAt?: Date;
    lastError?: Error;
}

interface ToolRegistryContextValue {
    tools: RegisteredTool[];
    registerTool: (tool: { name: string; description: string }) => void;
    unregisterTool: (name: string) => void;
    recordToolCall: (name: string) => void;
    recordToolError: (name: string, error: Error) => void;
}

const ToolRegistryContext = createContext<ToolRegistryContextValue | null>(null);

/**
 * ToolRegistry Provider
 * 
 * Internal state manager that tracks registered WebMCP tools.
 * Useful for diagnostics, debugging, and UI feedback.
 */
export function ToolRegistryProvider({ children }: { children: ReactNode }) {
    const [tools, setTools] = useState<RegisteredTool[]>([]);

    const registerTool = useCallback((tool: { name: string; description: string }) => {
        setTools(prev => {
            // Avoid duplicate registrations
            if (prev.some(t => t.name === tool.name)) {
                return prev;
            }
            return [...prev, { ...tool, callCount: 0 }];
        });
    }, []);

    const unregisterTool = useCallback((name: string) => {
        setTools(prev => prev.filter(t => t.name !== name));
    }, []);

    const recordToolCall = useCallback((name: string) => {
        setTools(prev => prev.map(t =>
            t.name === name
                ? { ...t, callCount: t.callCount + 1, lastCalledAt: new Date() }
                : t
        ));
    }, []);

    const recordToolError = useCallback((name: string, error: Error) => {
        setTools(prev => prev.map(t =>
            t.name === name
                ? { ...t, lastError: error }
                : t
        ));
    }, []);

    return (
        <ToolRegistryContext.Provider value={{
            tools,
            registerTool,
            unregisterTool,
            recordToolCall,
            recordToolError,
        }}>
            {children}
        </ToolRegistryContext.Provider>
    );
}

/**
 * Hook to access the tool registry
 */
export function useToolRegistry(): ToolRegistryContextValue {
    const context = useContext(ToolRegistryContext);
    if (!context) {
        throw new Error('useToolRegistry must be used within a ToolRegistryProvider');
    }
    return context;
}
