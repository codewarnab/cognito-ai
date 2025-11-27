/**
 * Tool descriptions for tooltips
 */
export const TOOL_DESCRIPTIONS: Record<string, string> = {
    // Navigation
    navigateTo: 'Navigate to a specific URL',
    switchTabs: 'Switch between browser tabs',
    getActiveTab: 'Get the currently active tab',
    getAllTabs: 'Get all open tabs',
    applyTabGroups: 'Organize tabs into groups',
    ungroupTabs: 'Remove tabs from groups',
    organizeTabsByContext: 'Auto-organize tabs by context',

    // Content
    takeScreenshot: 'Capture page screenshots',
    readPageContent: 'Extract page text content',
    extractText: 'Extract text from elements',
    findSearchBar: 'Locate search inputs on page',
    analyzeDom: 'Analyze DOM structure and interactive elements',

    // Interaction
    typeInField: 'Type text into input fields',
    clickByText: 'Click elements by text content',
    pressKey: 'Simulate keyboard input',
    focusElement: 'Focus on specific elements',
    scrollTo: 'Scroll to page elements',
    executeScript: 'Execute custom JavaScript on page',

    // Search & History
    chromeSearch: 'Search using Chrome search',
    getSearchResults: 'Get search result listings',
    openSearchResult: 'Open a search result',
    searchHistory: 'Search browsing history',
    getUrlVisits: 'Get visit history for URLs',

    // Reminders
    createReminder: 'Create time-based reminders',
    listReminders: 'List active reminders',
    cancelReminder: 'Cancel existing reminders',

    // Other
    getYouTubeTranscript: 'Fetch YouTube video transcript and metadata',
    generatePDF: 'Generate PDF documents',
    getReportTemplate: 'Get report templates',

    // Bookmarks
    createBookmark: 'Save pages to Chrome bookmarks',
    searchBookmarks: 'Search saved bookmarks by keyword',
    listBookmarks: 'List bookmarks from folders',
    deleteBookmark: 'Remove saved bookmarks',
    updateBookmark: 'Edit bookmark title or URL',
    getBookmarkTree: 'View bookmark folder structure',
    organizeBookmarks: 'AI-powered bookmark organization',

    // Supermemory (Cloud Memory)
    addMemory: 'Save information to persistent cloud memory',
    searchMemories: 'Search memories semantically'
};

/**
 * Tool categories for organization
 */
export const TOOL_CATEGORIES: Record<string, string[]> = {
    'Tabs & Navigation': ['navigateTo', 'switchTabs', 'getActiveTab', 'getAllTabs', 'applyTabGroups', 'ungroupTabs', 'organizeTabsByContext'],
    'Page Interaction': ['typeInField', 'clickByText', 'pressKey', 'focusElement', 'scrollTo', 'findSearchBar', 'executeScript'],
    'Page Content': ['takeScreenshot', 'readPageContent', 'extractText', 'analyzeDom'],
    'Search': ['chromeSearch', 'getSearchResults', 'openSearchResult'],
    'History': ['searchHistory', 'getUrlVisits'],
    'Bookmarks': ['createBookmark', 'searchBookmarks', 'listBookmarks', 'deleteBookmark', 'updateBookmark', 'getBookmarkTree', 'organizeBookmarks'],
    'Reminders': ['createReminder', 'listReminders', 'cancelReminder'],
    'Utilities': ['getYouTubeTranscript', 'generatePDF', 'getReportTemplate'],
    'Memory': ['addMemory', 'searchMemories']
};

/**
 * Tools that require Supermemory to be configured
 */
export const SUPERMEMORY_TOOLS: string[] = ['addMemory', 'searchMemories'];
