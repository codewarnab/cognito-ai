/**
 * List Memories Action
 * Migrated from CopilotKit useFrontendTool to AI SDK v5 tool format
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/toolRegistryUtils';
import { useToolUI } from '../../ai/ToolUIContext';
import { createLogger } from '../../logger';
import { ToolCard } from '../../components/ui/ToolCard';
import * as memoryStore from '../../memory/store';
import { type MemoryCategory } from '../../memory/types';
import type { ToolUIState } from '../../ai/ToolUIContext';

const log = createLogger('Tool-ListMemories');

export function useListMemories() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering listMemories tool...');

        registerTool({
            name: 'listMemories',
            description: 'List all stored memories, optionally filtered by category (\'fact\' or \'behavior\'). Use this when user asks to see their saved information or you need to review multiple memories.',
            parameters: z.object({
                category: z.enum(['fact', 'behavior']).optional()
                    .describe('Optional filter: \'fact\' or \'behavior\'. Leave empty for all memories.'),
                limit: z.number().int().positive().optional()
                    .describe('Maximum number of memories to return. Defaults to 20.'),
            }),
            execute: async ({ category, limit }) => {
                try {
                    log.info('TOOL CALL: listMemories', { category, limit });

                    const memories = await memoryStore.listMemories({
                        category: category as MemoryCategory | undefined,
                        limit: limit || 20,
                    });

                    log.info('✅ Memories retrieved', { count: memories.length });
                    return {
                        success: true,
                        count: memories.length,
                        memories: memories.map((m) => ({
                            id: m.id,
                            key: m.key,
                            value: m.value,
                            category: m.category,
                            source: m.source,
                            createdAt: new Date(m.createdAt).toLocaleString(),
                            pinned: m.pinned || false,
                        })),
                    };
                } catch (error) {
                    log.error('[Tool] Error listing memories:', error);
                    return { success: false, error: String(error) };
                }
            },
        });

        registerToolUI('listMemories', (state: ToolUIState) => {
            const { state: toolState, input, output } = state;

            if (toolState === 'input-streaming' || toolState === 'input-available') {
                return (
                    <ToolCard
                        title="Listing Memories"
                        subtitle={input?.category ? `Category: ${input.category}` : 'All categories'}
                        state="loading"
                        icon="📋"
                    />
                );
            }

            if (toolState === 'output-available' && output) {
                if (output.error) {
                    return (
                        <ToolCard
                            title="Failed to List Memories"
                            subtitle={output.error}
                            state="error"
                            icon="📋"
                        />
                    );
                }
                if (output.count === 0) {
                    return (
                        <ToolCard
                            title="No Memories Found"
                            subtitle="No memories saved yet"
                            state="success"
                            icon="📋"
                        />
                    );
                }
                return (
                    <ToolCard
                        title={`Found ${output.count} ${output.count === 1 ? 'Memory' : 'Memories'}`}
                        state="success"
                        icon="📋"
                    >
                        <div style={{ fontSize: '13px', maxHeight: '300px', overflowY: 'auto' }}>
                            {output.memories.map((memory: any, idx: number) => (
                                <div
                                    key={memory.id}
                                    style={{
                                        marginBottom: '8px',
                                        paddingBottom: '8px',
                                        borderBottom: idx < output.memories.length - 1 ? '1px solid rgba(0,0,0,0.1)' : 'none',
                                    }}
                                >
                                    <div style={{ fontWeight: 600 }}>
                                        {memory.pinned && '📌 '}
                                        {memory.key}
                                    </div>
                                    <div style={{ marginTop: '2px' }}>{String(memory.value)}</div>
                                    <div style={{ opacity: 0.6, fontSize: '11px', marginTop: '4px' }}>
                                        {memory.category} • {memory.source} • {memory.createdAt}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ToolCard>
                );
            }

            if (toolState === 'output-error') {
                return (
                    <ToolCard
                        title="Failed to List Memories"
                        subtitle={state.errorText}
                        state="error"
                        icon="📋"
                    />
                );
            }

            return null;
        });

        log.info('✅ listMemories tool registration complete');

        return () => {
            log.info('🧹 Cleaning up listMemories tool');
            unregisterToolUI('listMemories');
        };
    }, []);
}
