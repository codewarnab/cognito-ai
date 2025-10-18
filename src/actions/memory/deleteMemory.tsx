/**
 * Delete Memory Action
 * Migrated from CopilotKit useFrontendTool to AI SDK v5 tool format
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/toolRegistryUtils';
import { useToolUI } from '../../ai/ToolUIContext';
import { createLogger } from '../../logger';
import { ToolCard } from '../../components/ui/ToolCard';
import * as memoryStore from '../../memory/store';
import { canonicalizeKey } from '../../memory/types';
import type { ToolUIState } from '../../ai/ToolUIContext';

const log = createLogger('Tool-DeleteMemory');

export function useDeleteMemory() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering deleteMemory tool...');

        registerTool({
            name: 'deleteMemory',
            description: 'Delete a memory by its key. Use when user asks to forget something or remove a saved memory.',
            parameters: z.object({
                key: z.string().describe('The memory key to delete (will be auto-canonicalized)'),
            }),
            execute: async ({ key }) => {
                try {
                    log.info('TOOL CALL: deleteMemory', { key });
                    const canonKey = canonicalizeKey(key);
                    const deleted = await memoryStore.deleteMemoryByKey(canonKey);

                    if (!deleted) {
                        log.warn('Memory not found for deletion', { canonKey });
                        return { success: false, message: `No memory found with key: ${canonKey}` };
                    }

                    log.info('✅ Memory deleted successfully', { canonKey });
                    return { success: true, key: canonKey, message: 'Memory deleted successfully.' };
                } catch (error) {
                    log.error('[Tool] Error deleting memory:', error);
                    return { success: false, error: String(error) };
                }
            },
        });

        registerToolUI('deleteMemory', (state: ToolUIState) => {
            const { state: toolState, input, output } = state;

            if (toolState === 'input-streaming' || toolState === 'input-available') {
                return (
                    <ToolCard
                        title="Deleting Memory"
                        subtitle={`Key: ${input?.key}`}
                        state="loading"
                        icon="🗑️"
                    />
                );
            }

            if (toolState === 'output-available' && output) {
                if (output.error || !output.success) {
                    return (
                        <ToolCard
                            title="Failed to Delete Memory"
                            subtitle={output.error || output.message}
                            state="error"
                            icon="🗑️"
                        />
                    );
                }
                return (
                    <ToolCard title="Memory Deleted" state="success" icon="🗑️">
                        <div style={{ fontSize: '13px' }}>
                            <div>Removed: <strong>{output.key}</strong></div>
                        </div>
                    </ToolCard>
                );
            }

            if (toolState === 'output-error') {
                return (
                    <ToolCard
                        title="Failed to Delete Memory"
                        subtitle={state.errorText}
                        state="error"
                        icon="🗑️"
                    />
                );
            }

            return null;
        });

        log.info('✅ deleteMemory tool registration complete');

        return () => {
            log.info('🧹 Cleaning up deleteMemory tool');
            unregisterToolUI('deleteMemory');
        };
    }, []);
}
