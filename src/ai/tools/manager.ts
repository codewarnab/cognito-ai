/**
 * Tool Management and Filtering
 * Handles tool configuration, filtering, and workflow-specific logic
 */

import { createLogger } from '~logger';
import { getToolsForMode } from './registry';
import { getAllTools } from './registryUtils';
import { getMCPToolsFromBackground } from '../mcp/proxy';
import { youtubeAgentAsTool } from '../agents/youtube';
import { pdfAgentAsTool } from '../agents/pdf';
import type { WorkflowDefinition } from '../../workflows/types';

const log = createLogger('ToolManager', 'TOOLS_EXECUTION');

export interface ToolSetup {
  tools: Record<string, any>;
  systemPrompt: string;
}

/**
 * Workflow-only tools (only available in workflow mode)
 */
const WORKFLOW_ONLY_TOOLS = ['generateMarkdown', 'generatePDF', 'getReportTemplate'];

/**
 * Setup tools for local mode
 */
export function setupLocalTools(
  workflowConfig: WorkflowDefinition | null,
  localSystemPrompt: string
): ToolSetup {
  // Get limited tool set (basic tools only) from tool registry
  const localTools = getToolsForMode('local');

  let tools: Record<string, any>;
  let systemPrompt: string;

  // In workflow mode, filter to only allowed tools
  if (workflowConfig) {
    tools = Object.fromEntries(
      Object.entries(localTools).filter(([name]) =>
        workflowConfig.allowedTools.includes(name)
      )
    );
    systemPrompt = workflowConfig.systemPrompt;

    log.info('🔧 Filtered local tools for workflow:', {
      workflow: workflowConfig.name,
      allowed: workflowConfig.allowedTools,
      filtered: Object.keys(tools)
    });
  } else {
    tools = localTools;
    systemPrompt = localSystemPrompt;
  }

  log.info('🔧 Local tools available:', {
    count: Object.keys(tools).length,
    names: Object.keys(tools)
  });

  return { tools, systemPrompt };
}

/**
 * Setup tools for remote mode
 */
export async function setupRemoteTools(
  workflowConfig: WorkflowDefinition | null,
  remoteSystemPrompt: string,
  abortSignal?: AbortSignal
): Promise<ToolSetup> {
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
    analyzePdfDocument: pdfAgentAsTool,
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

  return { tools, systemPrompt };
}

/**
 * Build enhanced prompt with initial page context
 */
export function buildEnhancedPrompt(
  systemPrompt: string,
  initialPageContext: string | undefined,
  effectiveMode: 'local' | 'remote',
  workflowConfig: WorkflowDefinition | null
): string {
  // Skip page context for local mode (Gemini Nano)
  let enhancedPrompt = systemPrompt;

  if (initialPageContext && effectiveMode === 'remote') {
    enhancedPrompt = `${enhancedPrompt}\n\n[INITIAL PAGE CONTEXT - Captured at thread start]\n${initialPageContext}\n\nNote: This is the page context from when this conversation started. If you navigate to different pages or need updated context, use the readPageContent or getActiveTab tools.`;
    log.info('📄 Enhanced system prompt with initial page context');
  } else if (initialPageContext && effectiveMode === 'local') {
    log.info('⏭️ Skipping initial page context for local mode');
  }

  if (workflowConfig) {
    log.info('📋 Using workflow system prompt:', {
      workflow: workflowConfig.name,
      promptLength: enhancedPrompt.length
    });
  }

  return enhancedPrompt;
}

