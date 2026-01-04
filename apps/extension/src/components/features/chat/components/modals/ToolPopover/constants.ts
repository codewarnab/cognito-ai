export const TOOL_WARNING_THRESHOLD = 40;

export const CHAT_MODE_TOOLS: string[] = [
    'readPageContent',
    'takeScreenshot',
    'getActiveTab',
    'getAllTabs',
    'switchTabs',

    'getYouTubeTranscript',
];

export const AGENT_MODE_TOOLS: string[] = [
    // Navigation & Tab Management
    'navigateTo',
    'switchTabs',
    'getActiveTab',
    'getAllTabs',
    'applyTabGroups',
    'ungroupTabs',
    'organizeTabsByContext',
    // Content Reading & Extraction
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
    // History (removed - consolidated in search.tsx)
    // Reminders (disabled by default - can be enabled via custom mode)
    // Agent Tools
    'getYouTubeTranscript',
];

export const ADAPTIVE_MODE_TOOLS: string[] = [
    // Meta-tools for on-demand discovery and execution
    'discoverTools',
    'executeTools',
    // Pre-loaded popular tools (cold start optimization)
    'readPageContent',
    'takeScreenshot',
    'getActiveTab',
];

// Tools that should ONLY be visible in Adaptive mode (hidden in Chat/Agent)
export const ADAPTIVE_ONLY_TOOLS: string[] = [
    'discoverTools',
    'executeTools',
];

// CLI mode - use same tools as agent mode (browser operation via CLI agent)
export const CLI_MODE_TOOLS: string[] = [...AGENT_MODE_TOOLS];
