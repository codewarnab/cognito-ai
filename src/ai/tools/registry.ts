/**
 * Central Tool Registry
 * Manages tool availability based on AI mode (local vs remote)
 */

import { createLogger } from '~logger';
import { getAllTools } from './registryUtils';
import { enabledTools } from './enabledTools';
import type { AIMode, ToolCapabilities } from '../types';

const log = createLogger('ToolRegistry', 'TOOLS_REGISTRY');

// Tool categories
export const LOCAL_TOOLS = [
  'navigateTo',
  'switchTabs',
  'getActiveTab',
  'takeScreenshot',
  'readPageContent',
  'getSearchResults',
  'openSearchResult',
  'createReminder',
  'cancelReminder',
];

export const BASIC_TOOLS = [
  // Tab management
  'navigateTo',
  'switchTabs',
  'getActiveTab',
  'applyTabGroups',
  'ungroupTabs',
  'organizeTabsByContext',

  // Content reading
  'getSelectedText',
  'takeScreenshot',
  'readPageContent',

  // Basic interactions
  'typeInField',
  'clickByText',
  'pressKey',
  'focusElement',
  'scrollTo',

  // Search functionality
  'chromeSearch',
  'getSearchResults',
  'openSearchResult',

  // History
  'searchHistory',
  'getUrlVisits',

  // Memory management
  'saveMemory',
  'getMemory',
  'listMemories',
  'deleteMemory',
  'suggestSaveMemory',

  // Reminders
  'createReminder',
  'listReminders',
  'cancelReminder',
];

export const INTERACTION_TOOLS = [
  'typeInField',
  'clickByText',
  'pressKey',
  'clickElement',
  'fillInput',
  'scrollTo',
  'waitForElement',
];

export const AGENT_TOOLS = [
  'analyzeYouTubeVideo',
];

// MCP tools are dynamic and fetched from background

/**
 * Get tools based on mode
 * Filters tools against enabledTools list
 */
export function getToolsForMode(mode: AIMode): Record<string, any> {
  const allTools = getAllTools();

  if (mode === 'local') {
    // Local mode: Only local tools that are also enabled
    const localTools: Record<string, any> = {};

    LOCAL_TOOLS.forEach(toolName => {
      if (allTools[toolName] && enabledTools.includes(toolName)) {
        localTools[toolName] = allTools[toolName];
      }
    });

    log.info('Local mode: Returning enabled local tools', {
      count: Object.keys(localTools).length,
      names: Object.keys(localTools),
      filtered: LOCAL_TOOLS.length - Object.keys(localTools).length
    });

    return localTools;
  }

  // Remote mode: All basic tools that are also enabled
  // MCP tools are added separately in remoteAI.ts
  const extensionTools: Record<string, any> = {};

  BASIC_TOOLS.forEach(toolName => {
    if (allTools[toolName] && enabledTools.includes(toolName)) {
      extensionTools[toolName] = allTools[toolName];
    }
  });

  log.info(' Remote mode: Returning enabled basic tools', {
    count: Object.keys(extensionTools).length,
    names: Object.keys(extensionTools),
    filtered: BASIC_TOOLS.length - Object.keys(extensionTools).length
  });

  return extensionTools;
}

/**
 * Get tool capabilities for a mode
 */
export function getToolCapabilities(mode: AIMode): ToolCapabilities {
  if (mode === 'local') {
    return {
      extensionTools: true,   // Limited set
      mcpTools: false,        // Not available
      agentTools: false,      // Not available
      interactionTools: false // Not available
    };
  }

  return {
    extensionTools: true,
    mcpTools: true,
    agentTools: true,
    interactionTools: true
  };
}

/**
 * Get count of cloud tools (extension tools + agent tools, excluding workflow-only tools)
 * This mirrors the logic in aiLogic.ts for remote mode tool selection
 * @returns Number of cloud tools available (excludes MCP tools)
 */
export function getCloudToolsCount(): number {
  const allTools = getAllTools();

  // Workflow-only tools that should be excluded from normal mode
  const workflowOnlyTools = ['generateMarkdown', 'generatePDF', 'getReportTemplate'];

  // Count extension tools (excluding workflow-only)
  const extensionToolCount = Object.keys(allTools).filter(
    name => !workflowOnlyTools.includes(name)
  ).length;

  // Count agent tools (currently just analyzeYouTubeVideo in non-workflow mode)
  const agentToolCount = 1; // analyzeYouTubeVideo

  const totalCount = extensionToolCount + agentToolCount;

  log.info('Cloud tools count:', {
    extension: extensionToolCount,
    agent: agentToolCount,
    total: totalCount,
    excluded: workflowOnlyTools
  });

  return totalCount;
}

