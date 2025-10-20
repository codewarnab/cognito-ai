/**
 * Suggest Save Memory Action
 * Migrated from CopilotKit useFrontendTool to AI SDK v5 tool format
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/toolRegistryUtils';
import { useToolUI } from '../../ai/ToolUIContext';
import { createLogger } from '../../logger';
import { ToolCard } from '../../components/ui/ToolCard';
import { canonicalizeKey } from '../../memory/types';
import type { ToolUIState } from '../../ai/ToolUIContext';

const log = createLogger('Tool-SuggestSaveMemory');

export function useSuggestSaveMemory() {
    const { registerToolUI, unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering suggestSaveMemory tool...');

        registerTool({
            name: 'suggestSaveMemory',
            description: 'Suggest saving information to memory. Use this AFTER completing tasks when you\'ve discovered useful info (credentials, preferences, emails, etc.). ALWAYS ask user "Do you want me to remember this?" and wait for consent before calling saveMemory.',
            parameters: z.object({
                key: z.string()
                    .describe('Suggested memory key (e.g., "user.email", "api.token")'),
                value: z.string()
                    .describe('The value to potentially save'),
                category: z.enum(['fact', 'behavior'])
                    .describe('Suggested category: "fact" or "behavior"'),
                reason: z.string().optional()
                    .describe('Brief explanation of why this should be saved'),
            }),
            execute: async ({ key, value, category, reason }) => {
                try {
                    log.debug('TOOL CALL: suggestSaveMemory', { key, category });
                    // This tool just returns a suggestion; actual saving requires user consent
                    log.info('✅ Memory suggestion prepared', { key });
                    return {
                        suggested: true,
                        key: canonicalizeKey(key),
                        value,
                        category,
                        reason: reason || 'This might be useful to remember.',
                        message: 'Ask the user if they want to save this memory before calling saveMemory.',
                    };
                } catch (error) {
                    log.error('[Tool] Error in suggestSaveMemory:', error);
                    return { suggested: false, error: String(error) };
                }
            },
        });

        registerToolUI('suggestSaveMemory', (state: ToolUIState) => {
            const { state: toolState, output } = state;

            if (toolState === 'input-streaming' || toolState === 'input-available') {
                return (
                    <ToolCard
                        title="Suggesting Memory"
                        state="loading"
                        icon="💡"
                    />
                );
            }

            if (toolState === 'output-available' && output) {
                if (output.error) {
                    return (
                        <ToolCard
                            title="Error in Memory Suggestion"
                            subtitle={output.error}
                            state="error"
                            icon="💡"
                        />
                    );
                }
                return (
                    <ToolCard title="Memory Suggestion" state="success" icon="💡">
                        <div style={{ fontSize: '13px' }}>
                            <div><strong>{output.key}:</strong> {String(output.value)}</div>
                            <div style={{ opacity: 0.7, fontSize: '11px', marginTop: '4px' }}>
                                {output.reason}
                            </div>
                            <div style={{
                                marginTop: '8px',
                                padding: '6px',
                                background: 'rgba(198, 254, 30, 0.1)',
                                borderRadius: '4px',
                                fontSize: '12px'
                            }}>
                                ℹ️ Awaiting user consent to save
                            </div>
                        </div>
                    </ToolCard>
                );
            }

            if (toolState === 'output-error') {
                return (
                    <ToolCard
                        title="Memory Suggestion Failed"
                        subtitle={state.errorText}
                        state="error"
                        icon="💡"
                    />
                );
            }

            return null;
        });

        log.info('✅ suggestSaveMemory tool registration complete');

        return () => {
            log.info('🧹 Cleaning up suggestSaveMemory tool');
            unregisterToolUI('suggestSaveMemory');
        };
    }, []);
}
