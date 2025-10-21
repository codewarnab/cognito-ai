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

        // Using default CompactToolRenderer - no custom UI needed

        log.info('✅ listMemories tool registration complete');

        return () => {
            log.info('🧹 Cleaning up listMemories tool');
            unregisterToolUI('listMemories');
        };
    }, []);
}
