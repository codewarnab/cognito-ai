/**
 * Save Memory Action
 * Migrated from CopilotKit useFrontendTool to AI SDK v5 tool format
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '@/ai/tools';
import { useToolUI } from '@/ai/tools/components';
import { createLogger } from '~logger';
import { CompactToolRenderer } from '@/ai/tools/components';
import * as memoryStore from '../../memory/store';
import { createMemory, type MemoryCategory, type MemorySource } from '../../memory/types';
import type { ToolUIState } from '@/ai/tools/components';

const log = createLogger('Tool-SaveMemory');

export function useSaveMemory() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering saveMemory tool...');

        registerTool({
            name: 'saveMemory',
            description: `Save info to persistent memory. CRITICAL: Ask user consent first ("Want me to remember this?").

USE FOR: Personal info (name, email, preferences), user rules ("never/always do X"), work context, projects.

WORKFLOW: 1) User shares info 2) Ask consent 3) If yes, call tool 4) Confirm saved.

CATEGORIES: "fact"=personal info/preferences/context, "behavior"=AI behavior rules.

LIMITS: Requires consent, keys auto-normalized, strings only, persists across sessions.

EXAMPLE: "My name is John" → ask consent → saveMemory(category="fact", key="user.name", value="John")`,
            parameters: z.object({
                category: z.enum(['fact', 'behavior'])
                    .describe('Memory category. "fact": personal information, preferences, context (name, email, location, projects, tools). "behavior": rules for AI behavior (never/always do X, preferences for how to interact).'),
                key: z.string()
                    .describe('Memory key for retrieval. Use dot notation for hierarchy. Examples: "user.name", "user.email", "user.favorite_language", "behavior.no_emails", "project.current". Will be auto-canonicalized (normalized).'),
                value: z.string()
                    .describe('The value to store. Can be any string. Examples: "John Smith", "john@example.com", "React", "never send emails without asking". Keep concise but complete.'),
                source: z.enum(['user', 'task', 'system']).optional()
                    .describe('Source of memory. "user" (default): directly from user. "task": learned during task execution. "system": system-generated. Use "user" for most cases.'),
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


