/**
 * Get Memory Action
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

const log = createLogger('Tool-GetMemory');

export function useGetMemory() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering getMemory tool...');

        registerTool({
            name: 'getMemory',
            description: 'Retrieve a specific memory by its key. Use this when you need to recall a particular fact (e.g., user\'s name, email, preferences).',
            parameters: z.object({
                key: z.string().describe('The memory key to retrieve (will be auto-canonicalized)'),
            }),
            execute: async ({ key }) => {
                try {
                    log.debug('TOOL CALL: getMemory', { key });
                    const canonKey = canonicalizeKey(key);
                    const memory = await memoryStore.getMemoryByKey(canonKey);

                    if (!memory) {
                        log.warn('Memory not found', { canonKey });
                        return { found: false, key: canonKey };
                    }

                    log.info('✅ Memory retrieved', { key: memory.key });
                    return {
                        found: true,
                        key: memory.key,
                        value: memory.value,
                        category: memory.category,
                        createdAt: new Date(memory.createdAt).toLocaleString(),
                    };
                } catch (error) {
                    log.error('[Tool] Error getting memory:', error);
                    return { found: false, error: String(error) };
                }
            },
        });

        registerToolUI('getMemory', (state: ToolUIState) => {
            const { state: toolState, input, output } = state;

            if (toolState === 'input-streaming' || toolState === 'input-available') {
                return (
                    <ToolCard
                        title="Retrieving Memory"
                        subtitle={`Key: ${input?.key}`}
                        state="loading"
                        icon="🔍"
                    />
                );
            }

            if (toolState === 'output-available' && output) {
                if (output.error) {
                    return (
                        <ToolCard
                            title="Failed to Get Memory"
                            subtitle={output.error}
                            state="error"
                            icon="🔍"
                        />
                    );
                }
                if (!output.found) {
                    return (
                        <ToolCard
                            title="Memory Not Found"
                            subtitle={`No memory with key: ${input?.key}`}
                            state="error"
                            icon="🔍"
                        />
                    );
                }
                return (
                    <ToolCard title="Memory Retrieved" state="success" icon="🔍">
                        <div style={{ fontSize: '13px' }}>
                            <div><strong>{output.key}:</strong> {String(output.value)}</div>
                            <div style={{ opacity: 0.7, fontSize: '11px', marginTop: '4px' }}>
                                Category: {output.category} • Created: {output.createdAt}
                            </div>
                        </div>
                    </ToolCard>
                );
            }

            if (toolState === 'output-error') {
                return (
                    <ToolCard
                        title="Failed to Get Memory"
                        subtitle={state.errorText}
                        state="error"
                        icon="🔍"
                    />
                );
            }

            return null;
        });

        log.info('✅ getMemory tool registration complete');

        return () => {
            log.info('🧹 Cleaning up getMemory tool');
            unregisterToolUI('getMemory');
        };
    }, []);
}
