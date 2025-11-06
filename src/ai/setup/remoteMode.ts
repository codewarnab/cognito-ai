/**
 * Remote Mode Setup
 * Handles Gemini API model initialization and tool configuration
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createLogger } from '../../logger';
import { getAllTools } from '../tools/registryUtils';
import { getMCPToolsFromBackground } from '../mcp/proxy';
import { youtubeAgentAsTool } from '../agents/youtube';
import { validateAndGetApiKey } from '../../utils/geminiApiKey';
import type { WorkflowDefinition } from '../../workflows/types';

const log = createLogger('AI-RemoteMode');

export interface RemoteModeSetup {
    model: any;
    tools: Record<string, any>;
    systemPrompt: string;
}

/**
 * Workflow-only tools (only available in workflow mode)
 */
const WORKFLOW_ONLY_TOOLS = ['generateMarkdown', 'generatePDF', 'getReportTemplate'];

/**
 * Setup remote mode (Gemini API) with tools
 */
export async function setupRemoteMode(
    modelName: string,
    workflowConfig: WorkflowDefinition | null,
    remoteSystemPrompt: string,
): Promise<RemoteModeSetup> {
    log.info('🔧 Using REMOTE model:', modelName);

    // Validate and get API key (throws APIError if invalid)
    const apiKey = await validateAndGetApiKey();

    // Custom fetch to remove referrer header (fixes 403 errors in Chrome extensions)
    const customFetch = async (url: RequestInfo | URL, init?: RequestInit) => {
        const newInit = { ...init };
        if (newInit.headers) {
            delete (newInit.headers as any).Referer;
        }

        const response = await fetch(url, newInit);

        // Handle error responses to provide better error messages
        if (!response.ok && (response.status === 403 || response.status === 401)) {
            // Clone the response to read the body without consuming it
            const clonedResponse = response.clone();
            try {
                const errorText = await clonedResponse.text();
                log.error('API authentication error:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorText: errorText.substring(0, 500) // Log first 500 chars
                });
            } catch (e) {
                log.error('Failed to read error response:', e);
            }
        }

        return response;
    };

    // Initialize model
    const google = createGoogleGenerativeAI({ apiKey, fetch: customFetch });
    const model = google(modelName);

    // Get all registered tools (Chrome extension tools)
    const allExtensionTools = getAllTools();

    // Filter extension tools based on workflow
    let extensionTools: Record<string, any>;
    if (workflowConfig) {
        // Workflow mode: Only allowed tools
        extensionTools = Object.fromEntries(
            Object.entries(allExtensionTools).filter(([name]) =>
                workflowConfig.allowedTools.includes(name)
            )
        );
        log.info('🔧 Filtered tools for workflow:', {
            workflow: workflowConfig.name,
            allowed: workflowConfig.allowedTools,
            filtered: Object.keys(extensionTools)
        });
    } else {
        // Normal mode: All tools except workflow-only
        extensionTools = Object.fromEntries(
            Object.entries(allExtensionTools).filter(([name]) =>
                !WORKFLOW_ONLY_TOOLS.includes(name)
            )
        );
        log.info('🔧 Normal mode - excluding workflow-only tools:', {
            excluded: WORKFLOW_ONLY_TOOLS,
            available: Object.keys(extensionTools)
        });
    }

    log.info('🔧 Extension tools loaded:', {
        count: Object.keys(extensionTools).length,
        names: Object.keys(extensionTools)
    });

    // Get MCP tools from background service worker (not in workflow mode)
    let mcpTools = {};
    if (!workflowConfig) {
        try {
            const mcpManager = await getMCPToolsFromBackground();
            mcpTools = mcpManager.tools;
            log.info('🔧 MCP tools loaded:', {
                count: Object.keys(mcpTools).length,
                names: Object.keys(mcpTools)
            });
        } catch (error) {
            log.warn('⚠️ MCP tools unavailable:', error);
        }
    }

    // Add agent tools (not in workflow mode unless allowed)
    const agentTools = workflowConfig ? {} : {
        analyzeYouTubeVideo: youtubeAgentAsTool,
    };
    log.info('🔧 Agent tools loaded:', {
        count: Object.keys(agentTools).length,
        names: Object.keys(agentTools)
    });

    // Combine all tools
    const tools = { ...extensionTools, ...agentTools, ...mcpTools };
    log.info('🔧 Total tools available:', {
        count: Object.keys(tools).length,
        extension: Object.keys(extensionTools).length,
        mcp: Object.keys(mcpTools).length,
        agents: Object.keys(agentTools).length,
        workflowMode: !!workflowConfig
    });

    // Use remote or workflow-specific prompt
    const systemPrompt = workflowConfig ? workflowConfig.systemPrompt : remoteSystemPrompt;

    return { model, tools, systemPrompt };
}
