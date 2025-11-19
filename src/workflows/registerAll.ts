/**
 * Register all workflows
 * Call this hook in the app to make workflows available
 */

import { useEffect } from 'react';
import { registerWorkflow } from './registry';
import { researchWorkflow } from './definitions/researchWorkflow';
import { youtubeToNotionWorkflow } from './definitions/youtubeToNotionWorkflow';
import { createLogger } from '@logger';

const log = createLogger('Workflow-Registration');

/**
 * Register all workflow definitions
 */
export function useRegisterAllWorkflows() {
    useEffect(() => {
        log.info('🔌 Registering all workflows...');

        // Register research workflow
        registerWorkflow(researchWorkflow);

        // Register YouTube to Notion workflow
        registerWorkflow(youtubeToNotionWorkflow);

        // Future workflows can be added here:
        // registerWorkflow(debugWorkflow);
        // registerWorkflow(summarizeWorkflow);
        // etc.

        log.info('✅ All workflows registered', {
            count: 2, // Update as more workflows are added
            workflows: ['research', 'youtube-to-notion']
        });
    }, []);
}
