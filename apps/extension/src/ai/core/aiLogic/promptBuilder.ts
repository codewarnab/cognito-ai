/**
 * Prompt Builder
 * Selects and builds appropriate system prompt based on mode
 */

import { createLogger } from '~logger';

import { remoteSystemPrompt, chatModeSystemPrompt } from '../../prompts/templates/remote';
import { buildAdaptiveSystemPrompt, adaptiveSystemPromptStatic } from '../../prompts/templates/adaptivePrompt';
import { getSearchPromptAddition } from '../../prompts/searchPrompt';
import { getToolsMode } from '@/utils/settings';

import type { WorkflowDefinition } from '../../../workflows/types';
import type { ToolsMode } from '@/types/settings';

const log = createLogger('AI-PromptBuilder', 'AI_CHAT');

export interface PromptBuildResult {
    systemPrompt: string;
    toolsMode: ToolsMode;
}

/**
 * Select and build the appropriate system prompt based on current mode
 * 
 * @param workflowConfig - Optional workflow configuration
 * @param isSearchModeActive - Whether search mode is enabled
 * @returns The built system prompt and current tools mode
 */
export async function buildSystemPromptForMode(
    workflowConfig: WorkflowDefinition | null,
    isSearchModeActive: boolean
): Promise<PromptBuildResult> {
    const toolsMode = await getToolsMode();
    let usePrompt: string;

    if (toolsMode === 'chat' && !workflowConfig) {
        usePrompt = chatModeSystemPrompt;
    } else if (toolsMode === 'adaptive' && !workflowConfig) {
        // Adaptive mode: Build dynamic prompt with tool index
        try {
            usePrompt = await buildAdaptiveSystemPrompt();
        } catch (error) {
            log.warn('Failed to build adaptive prompt, using static version:', error);
            usePrompt = adaptiveSystemPromptStatic;
        }
    } else {
        usePrompt = remoteSystemPrompt;
    }

    // Append search instructions if search mode enabled (non-adaptive only)
    // In adaptive mode, search tools are discoverable via discoverTools
    if (isSearchModeActive && toolsMode !== 'adaptive') {
        usePrompt += '\n\n' + getSearchPromptAddition(true);
        log.info('🔍 SEARCH MODE ACTIVE - Appending search instructions to prompt');
    }

    log.info('📝 System prompt selection:', {
        toolsMode,
        isWorkflow: !!workflowConfig,
        isSearchModeActive,
        usingChatPrompt: toolsMode === 'chat' && !workflowConfig,
        usingAdaptivePrompt: toolsMode === 'adaptive' && !workflowConfig,
        searchInstructionsAppended: isSearchModeActive && toolsMode !== 'adaptive'
    });

    return { systemPrompt: usePrompt, toolsMode };
}
