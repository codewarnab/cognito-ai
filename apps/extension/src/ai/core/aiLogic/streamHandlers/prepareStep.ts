/**
 * Prepare Step Handler
 * Handles dynamic mode switching and website detection during multi-step AI execution
 */

import { createLogger } from '~logger';

import { getToolsMode } from '@/utils/settings';
import { getSearchSettings, hasApiKeyForProvider } from '@/utils/settings/searchSettings';
import { WEB_SEARCH_SELF_API_KEY_HIDDEN } from '@/constants';
import { SEARCH_TOOL_NAMES } from '../../../tools/searchToolFilter';
import { getCurrentWebsite, getWebsiteTools, augmentSystemPrompt } from '../../../prompts/website';
import { remoteSystemPrompt, chatModeSystemPrompt } from '../../../prompts/templates/remote';
import { getSearchPromptAddition } from '../../../prompts/searchPrompt';

import type { WorkflowDefinition } from '../../../../workflows/types';

const log = createLogger('AI-PrepareStep', 'AI_CHAT');

interface PrepareStepContext {
    /** All available tools */
    tools: Record<string, any>;
    /** Enhanced system prompt with page context */
    enhancedPrompt: string;
    /** Initial search mode state */
    isSearchModeActive: boolean;
    /** Optional workflow configuration */
    workflowConfig: WorkflowDefinition | null;
}

interface PrepareStepResult {
    activeTools?: string[];
    system?: string;
}

/**
 * Create the prepareStep callback for streamText multi-step execution
 * Handles dynamic mode switching and website-specific tool filtering
 */
export function createPrepareStepCallback(context: PrepareStepContext) {
    const { tools, enhancedPrompt, isSearchModeActive, workflowConfig } = context;

    return async ({ stepNumber }: { stepNumber: number }): Promise<PrepareStepResult> => {
        log.info(`🔄 Step ${stepNumber}: Preparing step with dynamic mode detection`);

        // Re-check search mode settings (may have changed mid-conversation)
        const currentSearchSettings = await getSearchSettings();
        const currentHasSearchKey = WEB_SEARCH_SELF_API_KEY_HIDDEN || await hasApiKeyForProvider(currentSearchSettings.defaultProvider);
        const currentSearchModeActive = currentSearchSettings.enabled && currentHasSearchKey && !workflowConfig;

        // Re-check tools mode (chat vs agent)
        const currentToolsMode = await getToolsMode();

        // Determine if mode changed from initial setup
        // Skip mode change detection when in workflow mode - workflow prompt should be preserved
        const modeChanged = currentSearchModeActive !== isSearchModeActive;
        const toolsModeChanged = !workflowConfig && !currentSearchModeActive && !isSearchModeActive &&
            ((currentToolsMode === 'chat') !== (enhancedPrompt === chatModeSystemPrompt));

        let stepPrompt: string | undefined;
        let stepActiveTools: string[] | undefined;

        if (modeChanged || toolsModeChanged) {
            log.info(`🔄 Mode changed mid-conversation:`, {
                searchMode: { was: isSearchModeActive, now: currentSearchModeActive },
                toolsMode: currentToolsMode,
                modeChanged,
                toolsModeChanged
            });

            // Update system prompt based on new mode (additive model)
            // Use local reference to avoid TypeScript narrowing issues
            const workflow = workflowConfig;
            if (currentToolsMode === 'adaptive' && !workflow) {
                // Adaptive mode: search tools are discoverable, no special prompt needed
                stepActiveTools = Object.keys(tools).filter(t => !SEARCH_TOOL_NAMES.includes(t as any));
                log.info('🌐 Switched to ADAPTIVE MODE - Search tools discoverable');
            } else if (currentSearchModeActive) {
                // Search mode enabled: append search instructions, include all tools
                // Preserve workflow prompt if in workflow mode
                stepPrompt = workflow
                    ? workflow.systemPrompt
                    : (currentToolsMode === 'chat' ? chatModeSystemPrompt : remoteSystemPrompt);
                stepPrompt += '\n\n' + getSearchPromptAddition(true);
                stepActiveTools = Object.keys(tools);
                log.info('🔍 Switched to SEARCH MODE (additive)');
            } else {
                // Preserve workflow prompt if in workflow mode
                stepPrompt = workflow
                    ? workflow.systemPrompt
                    : (currentToolsMode === 'chat' ? chatModeSystemPrompt : remoteSystemPrompt);
                // In non-search mode, exclude search tools
                stepActiveTools = Object.keys(tools).filter(t => !SEARCH_TOOL_NAMES.includes(t as any));
                log.info(`📝 Switched to ${currentToolsMode.toUpperCase()} MODE`);
            }
        }

        // Get current website configuration
        const currentWebsite = await getCurrentWebsite();

        if (!currentWebsite && !stepPrompt) {
            log.info(`No website-specific configuration, using current tools`);
            return stepActiveTools ? { activeTools: stepActiveTools } : {};
        }

        if (!currentWebsite) {
            return {
                ...(stepPrompt && { system: stepPrompt }),
                ...(stepActiveTools && { activeTools: stepActiveTools }),
            };
        }

        log.info(`🌐 Detected website: ${currentWebsite.websiteName}`, {
            id: currentWebsite.websiteId,
            url: currentWebsite.currentUrl,
            toolCount: currentWebsite.allowedTools.length
        });

        // Filter tools based on website
        const websiteTools = getWebsiteTools(tools, currentWebsite);
        const websiteToolNames = Object.keys(websiteTools);

        // Augment system prompt with website-specific docs
        const augmentedPrompt = augmentSystemPrompt(
            stepPrompt || enhancedPrompt,
            currentWebsite
        );

        // Combine website tools with mode-based filtering
        const finalActiveTools = stepActiveTools
            ? websiteToolNames.filter(t => stepActiveTools!.includes(t))
            : websiteToolNames;

        log.info(`🔄 Step ${stepNumber}: Website-aware configuration applied`, {
            website: currentWebsite.websiteName,
            activeTools: finalActiveTools,
            promptAugmented: !!currentWebsite.promptAddition,
            modeChanged: !!stepActiveTools
        });

        return {
            activeTools: finalActiveTools,
            system: augmentedPrompt,
        };
    };
}
