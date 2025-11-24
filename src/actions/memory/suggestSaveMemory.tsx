/**
 * Suggest Save Memory Action
 * Migrated from CopilotKit useFrontendTool to AI SDK v5 tool format
 */

import { z } from 'zod';
import { useEffect } from 'react';
import { registerTool } from '@ai/tools';
import { useToolUI } from '@ai/tools/components';
import { createLogger } from '~logger';
import { canonicalizeKey } from '../../memory/types';

const log = createLogger('Tool-SuggestSaveMemory');

export function useSuggestSaveMemory() {
    const { unregisterToolUI } = useToolUI();

    useEffect(() => {
        log.info('🔧 Registering suggestSaveMemory tool...');

        registerTool({
            name: 'suggestSaveMemory',
            description: `Suggest saving information to memory after discovering useful info during task completion. Prepares suggestion but does NOT save - must ask user first.

WHEN TO USE:
- AFTER completing a task where you discovered useful information
- Found credentials, API keys, preferences, email addresses, etc.
- Learned user's workflow preferences or rules
- Discovered information that would be useful in future sessions

PRECONDITIONS:
- Must have completed a task or interaction that revealed information
- Information must be appropriate to save (not sensitive passwords)
- MUST ask user for consent before calling saveMemory

WORKFLOW:
1. Complete task and discover useful information
2. Call suggestSaveMemory to prepare suggestion
3. Ask user: "Do you want me to remember this?"
4. Wait for user confirmation
5. If confirmed, call saveMemory with the suggested key/value/category

LIMITATIONS:
- Does NOT actually save memory (just prepares suggestion)
- Requires follow-up with saveMemory after user consent
- Cannot save without explicit user permission

EXAMPLE: After finding user's email -> suggestSaveMemory(key="user.email", value="john@example.com", category="fact", reason="Found in profile") -> Ask user -> If yes, call saveMemory`,
            parameters: z.object({
                key: z.string()
                    .describe('Suggested memory key using dot notation. Examples: "user.email", "user.name", "api.token", "behavior.no_emails". Will be canonicalized.'),
                value: z.string()
                    .describe('The value to potentially save. Examples: "john@example.com", "John Smith", "React". Keep concise but complete.'),
                category: z.enum(['fact', 'behavior'])
                    .describe('Suggested category. "fact": personal information, preferences, context. "behavior": rules and AI behavior preferences.'),
                reason: z.string().optional()
                    .describe('Brief explanation of why this should be saved. Examples: "Found in profile", "User mentioned preference", "Discovered during task". Helps user understand the suggestion.'),
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


