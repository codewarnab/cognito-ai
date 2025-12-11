/**
 * Initialize Research Session Tool
 * Creates a new research session for context-optimized memory storage
 */

import { useEffect } from 'react';
import { z } from 'zod';
import { registerTool } from '@/ai/tools';
import { initResearchSession } from '@/db';
import { createLogger } from '~logger';

const log = createLogger('Tool-InitResearchSession');

export function useInitResearchSessionTool() {
    useEffect(() => {
        registerTool({
            name: 'initResearchSession',
            description: `Initialize a new research session for context-optimized memory storage.

USE: At the very start of research workflow, before first readPageContent.
REQUIRES: Nothing.
BEHAVIOR: Creates unique session ID, resets source counter.
RETURNS: Session ID.

CRITICAL: Must be called BEFORE any readPageContent calls in research workflow.
This enables automatic content storage to IndexedDB instead of context window.

EXAMPLE: initResearchSession() → Returns { sessionId: 'research_1733654400000_abc123' }`,

            parameters: z.object({}),

            execute: async () => {
                try {
                    const sessionId = initResearchSession();

                    log.info('Research session initialized', { sessionId });

                    return {
                        success: true,
                        sessionId,
                        message: `Research session initialized. Session ID: ${sessionId}. Ready to store sources with readPageContent.`
                    };
                } catch (err) {
                    const message = err instanceof Error ? err.message : 'Unknown error';
                    log.error('Failed to initialize research session', { error: message });
                    return {
                        success: false,
                        error: message
                    };
                }
            }
        });

        return () => {
            log.debug('Cleanup: initResearchSession tool');
        };
    }, []);
}
