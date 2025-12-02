/**
 * Register all workflows
 * Call this hook in the app to make workflows available
 */

import { useEffect } from 'react';
import { registerWorkflow } from './registry';
import { getResearchWorkflowWithSettings } from './definitions/researchWorkflow';
import { youtubeToNotionWorkflow } from './definitions/youtubeToNotionWorkflow';
import { createLogger } from '~logger';

const log = createLogger('Workflow-Registration');

/**
 * Register all workflow definitions
 * Note: Research workflow is loaded async to use user-configured settings from storage
 */
export function useRegisterAllWorkflows() {
    useEffect(() => {
        const registerWorkflows = async () => {
            log.info('🔌 Registering all workflows...');

            // Register research workflow with settings from storage
            try {
                const researchWorkflow = await getResearchWorkflowWithSettings();
                registerWorkflow(researchWorkflow);
                log.info('✅ Research workflow registered with settings', {
                    stepCount: researchWorkflow.stepCount
                });
            } catch (err) {
                log.error('Failed to load research workflow settings, using defaults', err);
                // Import default and register it as fallback
                const { researchWorkflow } = await import('./definitions/researchWorkflow');
                registerWorkflow(researchWorkflow);
            }

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
        };

        registerWorkflows();
    }, []);
}

