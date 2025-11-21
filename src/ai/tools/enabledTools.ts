/**
 * Enabled Tools Configuration
 * Single source of truth for which extension-native tools are exposed to the AI model.
 * 
 * This list controls tool availability. Tools not listed here will not be accessible
 * to the model, even if they are registered in the tool registry.
 * 
 * Note: MCP tools are managed separately and not included in this list.
 * 
 * Runtime overrides:
 * - Users can override this list via Settings. We keep a mutable exported array
 *   so downstream imports always reference the latest effective list.
 */

import { getEnabledToolsOverride } from '../../utils/settingsStorage';

export const DEFAULT_ENABLED_TOOLS: string[] = [
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

/**
 * Effective enabled tools (mutable)
 * Initialized with defaults; updated when user overrides are loaded or changed.
 */
export const enabledTools: string[] = [...DEFAULT_ENABLED_TOOLS];

function applyOverride(override?: string[]) {
  // Reset and apply new contents to preserve reference identity
  enabledTools.length = 0;
  if (override && Array.isArray(override) && override.length > 0) {
    enabledTools.push(...override);
  } else {
    enabledTools.push(...DEFAULT_ENABLED_TOOLS);
  }
}

async function loadAndApplyEnabledToolsOverride() {
  try {
    const override = await getEnabledToolsOverride();
    applyOverride(override);
  } catch {
    applyOverride(undefined);
  }
}

// Fire-and-forget initial load
void loadAndApplyEnabledToolsOverride();

// Listen for storage changes to keep the array up to date
try {
  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes.userSettings) {
      // Reload on any userSettings change; it's cheap
      await loadAndApplyEnabledToolsOverride();
    }
  });
} catch {
  // chrome might be unavailable in non-extension contexts; ignore
}

