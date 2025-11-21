/**
 * Enabled Tools Configuration
 * Single source of truth for which extension-native tools are exposed to the AI model.
 * 
 * This list controls tool availability. Tools not listed here will not be accessible
 * to the model, even if they are registered in the tool registry.
 * 
 * Note: MCP tools are managed separately and not included in this list.
 */

export const enabledTools: string[] = [
  // Navigation & Tab Management
  'navigateTo',
  'switchTabs',
  'getActiveTab',
  'getAllTabs',
  'applyTabGroups',
  'ungroupTabs',
  'organizeTabsByContext',

  // Content Reading & Extraction
  // 'getSelectedText',
  'takeScreenshot',
  'readPageContent',
  'extractText',
  'findSearchBar',

  // Interaction Tools
  'typeInField',
  'clickByText',
  'pressKey',
  'focusElement',
  'scrollTo',

  // Search Functionality
  'chromeSearch',
  'getSearchResults',
  'openSearchResult',

  // History
  'searchHistory',
  'getUrlVisits',

  // Memory Management
  'saveMemory',
  'getMemory',
  'listMemories',
  'deleteMemory',
  'suggestSaveMemory',

  // Reminders
  'createReminder',
  'listReminders',
  'cancelReminder',

  // Agent Tools
  'analyzeYouTubeVideo',

  // Report Generation (workflow-specific, may be filtered in certain modes)
  'generateMarkdown',
  'generatePDF',
  'getReportTemplate',
];
