/**
 * Remote Mode Setup
 * Handles remote AI model initialization and tool configuration
 * Supports both Google Generative AI and Vertex AI providers
 */

import { createLogger } from '~logger';
import { getAllTools } from '../tools/registryUtils';
import { getMCPToolsFromBackground } from '../mcp/proxy';
import { youtubeAgentAsTool } from '../agents/youtube';
import { pdfAgentAsTool } from '../agents/pdf';
import { initializeModel } from '../core/modelFactory';
import type { WorkflowDefinition } from '../../workflows/types';
import type { AIProvider } from '../../utils/providerTypes';

const log = createLogger('RemoteMode', 'AI_CHAT');

export interface RemoteModeSetup {
    model: any;
    tools: Record<string, any>;
    systemPrompt: string;
    provider: AIProvider;
}

/**
 * Workflow-only tools (only available in workflow mode)
 */
const WORKFLOW_ONLY_TOOLS = ['generateMarkdown', 'generatePDF', 'getReportTemplate'];

/**
 * Setup remote mode with tools
 * Supports both Google Generative AI and Vertex AI providers
 * 
 * @param modelName - Model name (e.g., 'gemini-2.5-flash', 'gemini-2.5-pro')
 * @param workflowConfig - Optional workflow configuration
 * @param remoteSystemPrompt - Base system prompt for remote mode
 * @returns Remote mode setup with model, tools, system prompt, and provider
 */
export async function setupRemoteMode(
    modelName: string,
    workflowConfig: WorkflowDefinition | null,
    remoteSystemPrompt: string,
): Promise<RemoteModeSetup> {
    log.info('🔧 Setting up REMOTE mode with model:', modelName);

    // Initialize model using model factory (handles both Google and Vertex)
    const modelInit = await initializeModel(modelName, 'remote');
    const { model, provider } = modelInit;

    // Type assertion: remote mode will never return 'local' provider
    if (provider === 'local') {
        throw new Error('Remote mode should not return local provider');
    }

    log.info('✅ Model initialized:', { provider, modelName });

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
    let mcpTools: Record<string, any> = {};
    if (!workflowConfig) {
        try {
            const mcpManager = await getMCPToolsFromBackground();
            mcpTools = mcpManager.tools;
            log.info('🔧 MCP tools loaded:', {
                count: Object.keys(mcpTools).length,
            });
        } catch (error) {
            log.warn('⚠️ MCP tools unavailable:', error);
        }
    }

    // Add agent tools (not in workflow mode unless allowed)
    const agentTools = workflowConfig ? {} : {
        analyzeYouTubeVideo: youtubeAgentAsTool,
        analyzePdfDocument: pdfAgentAsTool,
    };
    log.info('🔧 Agent tools loaded:', {
        count: Object.keys(agentTools).length,
        names: Object.keys(agentTools)
    });

    // Combine all tools
    const tools = { ...extensionTools, ...mcpTools, ...agentTools };

    log.info('🔧 All tools loaded:', {
        count: Object.keys(tools).length,
        extension: Object.keys(extensionTools).length,
        mcp: Object.keys(mcpTools).length,
        agents: Object.keys(agentTools).length,
        workflowMode: !!workflowConfig
    });

    // Use workflow system prompt if in workflow mode, otherwise use default remote prompt
    const systemPrompt = workflowConfig ? workflowConfig.systemPrompt : remoteSystemPrompt;

    return {
        model,
        tools,
        systemPrompt,
        provider,
    };
}

