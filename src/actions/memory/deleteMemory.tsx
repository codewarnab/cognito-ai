/**
 * Delete Memory Action
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

const log = createLogger('Tool-DeleteMemory');

export function useDeleteMemory() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering deleteMemory tool...');

        registerTool({
            name: 'deleteMemory',
            description: `Delete a specific memory by its key. Use when user wants to remove saved information.

WHEN TO USE:
- User asks to "forget X", "delete my Y", "remove that memory"
- User wants to update information (delete old, save new)
- Removing outdated or incorrect information
- User requests privacy/data deletion

PRECONDITIONS:
- Memory must exist with the given key
- Key will be auto-canonicalized for matching

WORKFLOW:
1. Provide memory key to delete
2. Key is canonicalized (normalized) for matching
3. Memory is permanently deleted from storage
4. Returns success confirmation or not found error

LIMITATIONS:
- Cannot undo deletion (permanent)
- Can only delete one memory at a time
- Must know exact key (use listMemories to find keys)

EXAMPLE: deleteMemory(key="user.email") -> {success: true, key: "user.email", message: "Memory deleted"}`,
            parameters: z.object({
                key: z.string().describe('Memory key to delete. Will be auto-canonicalized (normalized). Examples: "user.name", "user.email", "behavior.no_emails". Use listMemories first if unsure of exact key.'),
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


