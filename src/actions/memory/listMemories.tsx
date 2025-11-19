/**
 * List Memories Action
 * Migrated from CopilotKit useFrontendTool to AI SDK v5 tool format
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/tools';
import { useToolUI } from '../../ai/tools/components';
import { createLogger } from '@logger';
import { CompactToolRenderer } from '../../ai/tools/components';
import * as memoryStore from '../../memory/store';
import { type MemoryCategory } from '../../memory/types';
import type { ToolUIState } from '../../ai/tools/components';

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

        // Register UI with custom renderers
        registerToolUI('listMemories', (state: ToolUIState) => {
            return <CompactToolRenderer state={state} />;
        }, {
            renderInput: (input: any) => (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    fontSize: '13px',
                    color: 'var(--text-secondary)'
                }}>
                    {input.category && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', opacity: 0.7 }}>Category:</span>
                            <span style={{
                                fontSize: '11px',
                                padding: '2px 6px',
                                background: 'var(--bg-tertiary)',
                                borderRadius: '3px',
                                border: '1px solid var(--border-color)',
                                opacity: 0.9
                            }}>
                                {input.category}
                            </span>
                        </div>
                    )}
                    {input.limit && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', opacity: 0.7 }}>Limit:</span>
                            <span style={{ fontSize: '11px', padding: '2px 6px', opacity: 0.9 }}>
                                {input.limit}
                            </span>
                        </div>
                    )}
                </div>
            ),
            renderOutput: (output: any) => (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    fontSize: '13px',
                    color: 'var(--text-secondary)'
                }}>
                    {output.success && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px', opacity: 0.7 }}>Found:</span>
                                <span style={{ fontSize: '11px', padding: '2px 6px', opacity: 0.9 }}>
                                    {output.count} {output.count === 1 ? 'memory' : 'memories'}
                                </span>
                            </div>
                            {output.memories && output.memories.length > 0 && (
                                <div style={{
                                    marginTop: '4px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '3px'
                                }}>
                                    {output.memories.slice(0, 3).map((memory: any, i: number) => (
                                        <div key={i} style={{
                                            padding: '5px 8px',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: '3px',
                                            border: '1px solid var(--border-color)',
                                            fontSize: '11px'
                                        }}>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                marginBottom: '2px'
                                            }}>
                                                <code style={{
                                                    fontSize: '10px',
                                                    padding: '1px 4px',
                                                    background: 'var(--bg-primary)',
                                                    borderRadius: '2px',
                                                    opacity: 0.9
                                                }}>
                                                    {memory.key}
                                                </code>
                                                <span style={{
                                                    fontSize: '10px',
                                                    padding: '1px 4px',
                                                    background: 'var(--bg-primary)',
                                                    borderRadius: '2px',
                                                    opacity: 0.7
                                                }}>
                                                    {memory.category}
                                                </span>
                                            </div>
                                            <div style={{
                                                color: 'var(--text-primary)',
                                                opacity: 0.9,
                                                fontSize: '11px'
                                            }}>
                                                {memory.value}
                                            </div>
                                        </div>
                                    ))}
                                    {output.memories.length > 3 && (
                                        <div style={{
                                            fontSize: '10px',
                                            opacity: 0.5,
                                            padding: '3px 6px',
                                            textAlign: 'center'
                                        }}>
                                            +{output.memories.length - 3} more
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                    {output.error && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', opacity: 0.7, color: 'var(--error-color)' }}>
                                {output.error}
                            </span>
                        </div>
                    )}
                </div>
            )
        });

        log.info('✅ listMemories tool registration complete');

        return () => {
            log.info('🧹 Cleaning up listMemories tool');
            unregisterToolUI('listMemories');
        };
    }, []);
}

