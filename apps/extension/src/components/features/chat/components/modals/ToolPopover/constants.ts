export const TOOL_WARNING_THRESHOLD = 40;

export const CHAT_MODE_TOOLS: string[] = [
    'readPageContent',
    'takeScreenshot',
    'getActiveTab',
    'getAllTabs',
    'switchTabs',
    'searchHistory',
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
    // History
    'searchHistory',
    'getUrlVisits',
    // Reminders
    'createReminder',
    'listReminders',
    'cancelReminder',
    // Agent Tools
    'getYouTubeTranscript',
];
