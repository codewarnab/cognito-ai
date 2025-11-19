/**
 * Save Memory Action
 * Migrated from CopilotKit useFrontendTool to AI SDK v5 tool format
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/tools';
import { useToolUI } from '../../ai/tools/components';
import { createLogger } from '~logger';
import { CompactToolRenderer } from '../../ai/tools/components';
import * as memoryStore from '../../memory/store';
import { createMemory, type MemoryCategory, type MemorySource } from '../../memory/types';
import type { ToolUIState } from '../../ai/tools/components';

const log = createLogger('Tool-SaveMemory');

export function useSaveMemory() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering saveMemory tool...');

        registerTool({
            name: 'saveMemory',
            description: 'Save information to memory after user consent. MUST ask user "Do you want me to remember this?" before calling. Only save after user confirms. Categories: "fact" (personal info like name, email, preferences) or "behavior" (rules like "never ask about X", "always do Y").',
            parameters: z.object({
                category: z.enum(['fact', 'behavior'])
                    .describe('Memory category: "fact" or "behavior"'),
                key: z.string()
                    .describe('Memory key (e.g., "user.name", "user.email", "behavior.no-emails"). Will be auto-canonicalized.'),
                value: z.string()
                    .describe('The value to store'),
                source: z.enum(['user', 'task', 'system']).optional()
                    .describe('Source of memory: "user", "task", or "system". Defaults to "user".'),
            }),
            execute: async ({ category, key, value, source }) => {
                try {
                    log.info('TOOL CALL: saveMemory', { category, key });

                    const memory = createMemory(
                        key,
                        value,
                        category as MemoryCategory,
                        (source as MemorySource) || 'user'
                    );

                    const saved = await memoryStore.saveMemory(memory);

                    log.info('✅ Memory saved successfully', { id: saved.id, key: saved.key });
                    return {
                        success: true,
                        id: saved.id,
                        key: saved.key,
                        message: 'Memory saved! You can ask me to list or delete memories anytime.',
                    };
                } catch (error) {
                    log.error('[Tool] Error saving memory:', error);
                    return { success: false, error: String(error) };
                }
            },
        });

        // Register UI with custom renderers
        registerToolUI('saveMemory', (state: ToolUIState) => {
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', opacity: 0.7 }}>Value:</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-primary)', opacity: 0.9 }}>
                            {input.value}
                        </span>
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
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px', opacity: 0.7 }}>Saved:</span>
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

        log.info('✅ saveMemory tool registration complete');

        return () => {
            log.info('🧹 Cleaning up saveMemory tool');
            unregisterToolUI('saveMemory');
        };
    }, []);
}


