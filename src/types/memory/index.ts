/**
 * Memory system types
 */

// TODO: Define memory-specific types when implementing memory features
export interface MemoryContext {
    id: string;
    type: 'short-term' | 'long-term' | 'episodic';
    content: string;
    metadata?: Record<string, unknown>;
    timestamp: number;
}
