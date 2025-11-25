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

/**
 * Tools that should be disabled by default in the UI
 * These tools will appear in Settings but require explicit user opt-in
 */
export const TOOLS_DISABLED_BY_DEFAULT: string[] = [
  'createBookmark',
  'searchBookmarks',
  'listBookmarks',
  'deleteBookmark',
  'updateBookmark',
  'getBookmarkTree',
  'organizeBookmarks',
];

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
  'analyzeDom',

  // Interaction Tools
  'typeInField',
  'clickByText',
  'pressKey',
  'focusElement',
  'scrollTo',
  'executeScript',

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

  // Reminders
  'createReminder',
  'listReminders',
  'cancelReminder',

  // Agent Tools
  'getYouTubeTranscript',

  // Report Generation (workflow-specific, may be filtered in certain modes)
  'generatePDF',
  'getReportTemplate',

  // Bookmarks
  'createBookmark',
  'searchBookmarks',
  'listBookmarks',
  'deleteBookmark',
  'updateBookmark',
  'getBookmarkTree',
  'organizeBookmarks',
];

/**
 * Effective enabled tools (mutable)
 * Initialized with defaults minus the disabled-by-default tools
 * Updated when user overrides are loaded or changed.
 */
const initialEnabledTools = DEFAULT_ENABLED_TOOLS.filter(
  tool => !TOOLS_DISABLED_BY_DEFAULT.includes(tool)
);
export const enabledTools: string[] = [...initialEnabledTools];

function applyOverride(override?: string[]) {
  // Reset and apply new contents to preserve reference identity
  enabledTools.length = 0;
  if (override && Array.isArray(override) && override.length > 0) {
    // User has explicitly set their preferences
    enabledTools.push(...override);
  } else {
    // No override: use defaults minus disabled-by-default tools
    enabledTools.push(...initialEnabledTools);
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

