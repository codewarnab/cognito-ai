/**
 * Central Tool Registry
 * Manages tool availability based on AI mode (local vs remote)
 */

import { createLogger } from '../logger';
import { getAllTools } from './toolRegistryUtils';
import type { AIMode, ToolCapabilities } from './types';

const log = createLogger('ToolRegistry');

// Tool categories
export const LOCAL_TOOLS = [
  'navigateTo',
  'switchTabs',
  'getActiveTab',
  'readPageContent',
  'getSearchResults',
  'openSearchResult',
  'saveMemory',
  'listMemories',
  'getMemory',
  'createReminder',
  'cancelReminder',
  'searchHistory',
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
 */
export function getToolsForMode(mode: AIMode): Record<string, any> {
  const allTools = getAllTools();
  
  if (mode === 'local') {
    // Local mode: Only local tools
    const localTools: Record<string, any> = {};
    
    LOCAL_TOOLS.forEach(toolName => {
      if (allTools[toolName]) {
        localTools[toolName] = allTools[toolName];
      }
    });
    
    log.info('🏠 Local mode: Returning local tools only', { 
      count: Object.keys(localTools).length,
      names: Object.keys(localTools)
    });
    
    return localTools;
  }
  
  // Remote mode: All basic tools
  // MCP tools are added separately in remoteAI.ts
  const extensionTools: Record<string, any> = {};
  
  BASIC_TOOLS.forEach(toolName => {
    if (allTools[toolName]) {
      extensionTools[toolName] = allTools[toolName];
    }
  });
  
  log.info('☁️ Remote mode: Returning all basic tools', {
    count: Object.keys(extensionTools).length,
    names: Object.keys(extensionTools)
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
