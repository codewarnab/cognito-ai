/**
 * Delete Memory Action
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

        // Register UI with custom renderers
        registerToolUI('deleteMemory', (state: ToolUIState) => {
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
                    {output.success && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', opacity: 0.7 }}>Deleted:</span>
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
                    )}
                    {!output.success && output.message && (
                        <div style={{ fontSize: '12px', opacity: 0.7 }}>
                            {output.message}
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

        log.info('✅ deleteMemory tool registration complete');

        return () => {
            log.info('🧹 Cleaning up deleteMemory tool');
            unregisterToolUI('deleteMemory');
        };
    }, []);
}

