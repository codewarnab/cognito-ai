/**
 * Suggest Save Memory Action
 * Migrated from CopilotKit useFrontendTool to AI SDK v5 tool format
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '../../ai/tools';
import { useToolUI } from '../../ai/tools/components';
import { createLogger } from '../../logger';
import { canonicalizeKey } from '../../memory/types';

const log = createLogger('Tool-SuggestSaveMemory');

export function useSuggestSaveMemory() {
    const {  unregisterToolUI } = useToolUI();

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

        // Using default CompactToolRenderer - no custom UI needed

        log.info('✅ suggestSaveMemory tool registration complete');

        return () => {
            log.info('🧹 Cleaning up suggestSaveMemory tool');
            unregisterToolUI('suggestSaveMemory');
        };
    }, []);
}

