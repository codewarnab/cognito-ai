/**
 * Remote Mode Setup
 * Handles remote AI model initialization and tool configuration
 * Supports both Google Generative AI and Vertex AI providers
 * Optionally includes Supermemory tools for persistent memory
 */

import { createLogger } from '~logger';
import { supermemoryTools } from '@supermemory/tools/ai-sdk';
import { getAllTools } from '../tools/registryUtils';
import { enabledTools } from '../tools/enabledTools';
import { getMCPToolsFromBackground } from '../mcp/proxy';
import { getWebMCPToolsFromBackground } from '../tools/webmcpTools';
import { getYouTubeTranscript } from '../agents/youtube';
import { pdfAgentAsTool } from '../agents/pdf';
import { google } from '@ai-sdk/google';
import { initializeModel } from '../core/modelFactory';
import { getSupermemoryApiKey, isSupermemoryReady, getSupermemoryUserId } from '@/utils/supermemory';
import type { WorkflowDefinition } from '../../workflows/types';
import type { AIProvider } from '@/utils/credentials';

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
const WORKFLOW_ONLY_TOOLS = ['generatePDF', 'getReportTemplate'];

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

    // DEBUG: Log search tool registration status
    log.info('🔍 DEBUG - Search tools registration check:', {
        webSearchRegistered: 'webSearch' in allExtensionTools,
        retrieveRegistered: 'retrieve' in allExtensionTools,
        deepWebSearchRegistered: 'deepWebSearch' in allExtensionTools,
        allRegisteredTools: Object.keys(allExtensionTools),
        enabledToolsArray: [...enabledTools],
        webSearchInEnabled: enabledTools.includes('webSearch'),
        retrieveInEnabled: enabledTools.includes('retrieve'),
        deepWebSearchInEnabled: enabledTools.includes('deepWebSearch'),
    });

    // Filter extension tools based on enabledTools and workflow
    let extensionTools: Record<string, any>;
    if (workflowConfig) {
        // Workflow mode: Use ALL allowed tools from workflow (ignore user's enabledTools filter)
        // Workflows have specific tool requirements that must be met
        extensionTools = Object.fromEntries(
            Object.entries(allExtensionTools).filter(([name]) =>
                workflowConfig.allowedTools.includes(name)
            )
        );
        log.info('🔧 Filtered tools for workflow:', {
            workflow: workflowConfig.name,
            allowedByWorkflow: workflowConfig.allowedTools,
            actuallyAvailable: Object.keys(extensionTools),
            registeredCount: Object.keys(allExtensionTools).length
        });
    } else {
        // Normal mode: All enabled tools except workflow-only
        extensionTools = Object.fromEntries(
            Object.entries(allExtensionTools).filter(([name]) =>
                !WORKFLOW_ONLY_TOOLS.includes(name) && enabledTools.includes(name)
            )
        );
        log.info('🔧 Normal mode - applying enabledTools filter:', {
            excluded: WORKFLOW_ONLY_TOOLS,
            available: Object.keys(extensionTools),
            totalEnabled: enabledTools.length,
            filtered: Object.keys(allExtensionTools).length - Object.keys(extensionTools).length
        });

        // NOTE: Search tools (webSearch, retrieve, deepWebSearch) are NOT force-added here.
        // They are only available when search mode is active, which is handled by
        // filterToolsObjectBySearchMode() in the AI execution pipeline.
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

    // Get WebMCP tools from active tab (not in workflow mode)
    let webmcpTools: Record<string, any> = {};
    if (!workflowConfig) {
        try {
            const webmcpResult = await getWebMCPToolsFromBackground();
            webmcpTools = webmcpResult.tools;
            if (Object.keys(webmcpTools).length > 0) {
                log.info('🌐 WebMCP tools loaded:', {
                    count: Object.keys(webmcpTools).length,
                    names: Object.keys(webmcpTools),
                    domain: webmcpResult.domain
                });
            } else {
                log.debug('🌐 No WebMCP tools available on active tab');
            }
        } catch (error) {
            log.debug('🌐 WebMCP tools unavailable:', error);
        }
    }

    // Add agent tools (not in workflow mode unless allowed, and only if enabled)
    let agentTools: Record<string, any> = {};
    if (!workflowConfig) {
        if (enabledTools.includes('getYouTubeTranscript')) {
            agentTools.getYouTubeTranscript = getYouTubeTranscript;
        }
        if (enabledTools.includes('analyzePdfDocument')) {
            agentTools.analyzePdfDocument = pdfAgentAsTool;
        }
    }
    log.info('🔧 Agent tools loaded:', {
        count: Object.keys(agentTools).length,
        names: Object.keys(agentTools),
        filtered: 2 - Object.keys(agentTools).length
    });

    // Add Supermemory tools if enabled (not in workflow mode)
    let smTools: Record<string, any> = {};
    if (!workflowConfig) {
        try {
            const smReady = await isSupermemoryReady();
            const smApiKey = await getSupermemoryApiKey();
            const userId = await getSupermemoryUserId();

            if (smReady && smApiKey && userId) {
                // Check if Supermemory tools are enabled in user settings
                const smToolsEnabled = enabledTools.some(t =>
                    ['addMemory', 'searchMemories'].includes(t)
                );

                if (smToolsEnabled) {
                    // Create Supermemory tools with user's container tag
                    // The apiKey is passed directly to supermemoryTools (no process.env needed)
                    smTools = supermemoryTools(smApiKey, {
                        containerTags: [userId],
                    });
                    log.info('🧠 Supermemory tools loaded:', {
                        count: Object.keys(smTools).length,
                        names: Object.keys(smTools),
                        userId: userId.substring(0, 8) + '...',
                    });
                } else {
                    log.debug('🧠 Supermemory ready but tools not enabled');
                }
            } else {
                log.debug('🧠 Supermemory not configured, skipping tools');
            }
        } catch (error) {
            log.warn('⚠️ Failed to load Supermemory tools:', error);
        }
    }

    // Add Google Integration tools (not in workflow mode)
    let integrationTools: Record<string, any> = {};
    if (!workflowConfig) {
        if (enabledTools.includes('googleMaps')) {
            try {
                // Initialize Google Maps tool
                // This requires the google provider settings, but the tool itself is initialized here
                // Permission checking happens at runtime or via tool toggle UI
                if (google.tools.googleMaps) {
                    integrationTools.googleMaps = google.tools.googleMaps({});
                    log.info('🗺️ Google Maps tool loaded');
                } else {
                    log.warn('⚠️ Google Maps tool not found in google.tools');
                }
            } catch (error) {
                log.warn('⚠️ Failed to load Google Maps tool:', error);
            }
        }
        if (enabledTools.includes('googleSearch')) {
            try {
                // Initialize Google Search tool for web search grounding
                if (google.tools.googleSearch) {
                    integrationTools.googleSearch = google.tools.googleSearch({});
                    log.info('🔎 Google Search tool loaded');
                } else {
                    log.warn('⚠️ Google Search tool not found in google.tools');
                }
            } catch (error) {
                log.warn('⚠️ Failed to load Google Search tool:', error);
            }
        }
    }

    // Combine all tools
    const tools = { ...extensionTools, ...mcpTools, ...webmcpTools, ...agentTools, ...smTools, };

    log.info('🔧 All tools loaded:', {
        count: Object.keys(tools).length,
        extension: Object.keys(extensionTools).length,
        mcp: Object.keys(mcpTools).length,
        webmcp: Object.keys(webmcpTools).length,
        agents: Object.keys(agentTools).length,
        supermemory: Object.keys(smTools).length,
        integrations: Object.keys(integrationTools).length,
        workflowMode: !!workflowConfig,
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

