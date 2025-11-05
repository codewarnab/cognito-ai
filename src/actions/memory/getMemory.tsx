/**
 * Get Memory Action
 * Migrated from CopilotKit useFrontendTool to AI SDK v5 tool format
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/tools';
import { useToolUI } from '../../ai/tools/components';
import { createLogger } from '../../logger';
import { CompactToolRenderer } from '../../ai/tools/components';
import * as memoryStore from '../../memory/store';
import { canonicalizeKey } from '../../memory/types';
import type { ToolUIState } from '../../ai/tools/components';

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

        // Register UI with custom renderers
        registerToolUI('getMemory', (state: ToolUIState) => {
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', opacity: 0.7 }}>Key:</span>
                        <code style={{
                            fontSize: '11px',
                            padding: '2px 6px',
                            background: 'var(--bg-tertiary)',
                            borderRadius: '3px',
                            border: '1px solid var(--border-color)',
                            opacity: 0.9
                        }}>
                            {input.key}
                        </code>
                    </div>
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
                    {output.found && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px', opacity: 0.7 }}>Key:</span>
                                <code style={{
                                    fontSize: '11px',
                                    padding: '2px 6px',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: '3px',
                                    border: '1px solid var(--border-color)',
                                    opacity: 0.9
                                }}>
                                    {output.key}
                                </code>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px', opacity: 0.7 }}>Value:</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-primary)', opacity: 0.9 }}>
                                    {output.value}
                                </span>
                            </div>
                            {output.category && (
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
                                        {output.category}
                                    </span>
                                </div>
                            )}
                        </>
                    )}
                    {!output.found && !output.error && (
                        <div style={{ fontSize: '12px', opacity: 0.7 }}>
                            Memory not found
                        </div>
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

        log.info('✅ getMemory tool registration complete');

        return () => {
            log.info('🧹 Cleaning up getMemory tool');
            unregisterToolUI('getMemory');
        };
    }, []);
}

