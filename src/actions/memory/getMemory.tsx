/**
 * Get Memory Action
 * Migrated from CopilotKit useFrontendTool to AI SDK v5 tool format
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/tools';
import { useToolUI } from '../../ai/tools/components';
import { createLogger } from '~logger';
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
            description: `Retrieve a specific memory by its key. Use to recall previously saved information about the user.

WHEN TO USE:
- Need to recall user's name, email, preferences, or other saved facts
- User asks "what do you remember about me?" or "what's my X?"
- Personalizing responses based on saved preferences
- Checking if information was previously saved before asking again

PRECONDITIONS:
- Memory must have been previously saved with saveMemory
- Key must match the saved key (auto-canonicalized for flexibility)

WORKFLOW:
1. Provide memory key to retrieve
2. Key is canonicalized (normalized) for matching
3. Returns memory value, category, and creation date if found
4. Returns not found if memory doesn't exist

LIMITATIONS:
- Can only retrieve one memory at a time (use listMemories for multiple)
- Key must be exact match after canonicalization
- Cannot search by value (only by key)

EXAMPLE: getMemory(key="user.name") -> {found: true, value: "John Smith", category: "fact"}`,
            parameters: z.object({
                key: z.string().describe('Memory key to retrieve. Will be auto-canonicalized (normalized). Examples: "user.name", "user.email", "user.favorite_language", "behavior.no_emails". Use dot notation for hierarchy.'),
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


