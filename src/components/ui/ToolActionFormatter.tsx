/**
 * ToolActionFormatter - Transforms technical tool names into human-readable action descriptions
 * Shows contextual information from tool input/output instead of raw function names
 */

interface ActionFormatterContext {
    toolName: string;
    state: 'loading' | 'success' | 'error';
    input?: any;
    output?: any;
}

type ActionFormatter = (ctx: ActionFormatterContext) => string;

// Helper Functions
function truncateText(text: string, maxLength: number): string {
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}

function extractDomain(url: string): string {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
    } catch {
        return url;
    }
}

function humanizeKey(key: string): string {
    if (!key) return '';
    return key
        .split(/[._-]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function ordinal(num: number): string {
    const suffix = ['th', 'st', 'nd', 'rd'];
    const v = num % 100;
    return num + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
}

function camelToTitle(text: string): string {
    return text
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
}

// Action Formatters by Category

// Navigation Tools
const navigateToFormatter: ActionFormatter = ({ state, input, output }) => {
    if (state === 'loading') {
        const url = input?.url || input?.targetUrl;
        if (url) {
            return `Navigating to: ${truncateText(extractDomain(url), 30)}`;
        }
        return 'Navigating...';
    }
    if (state === 'success') {
        const url = output?.url || input?.url;
        const newTab = input?.newTab || output?.newTab;
        if (url) {
            const domain = truncateText(extractDomain(url), 30);
            return newTab ? `Opened in new tab: ${domain}` : `Opened: ${domain}`;
        }
        return 'Navigation complete';
    }
    return 'Navigation failed';
};

// Search Tools
const getSearchResultsFormatter: ActionFormatter = ({ state, output }) => {
    if (state === 'loading') {
        return 'Reading search results...';
    }
    if (state === 'success') {
        const count = output?.results?.length || output?.count || 0;
        const engine = output?.engine || 'search';
        return `Found ${count} results from ${engine}`;
    }
    return 'Search failed';
};

const openSearchResultFormatter: ActionFormatter = ({ state, input, output }) => {
    if (state === 'loading') {
        const rank = input?.rank || input?.index;
        if (rank !== undefined) {
            return `Opening search result #${rank}...`;
        }
        return 'Opening search result...';
    }
    if (state === 'success') {
        const title = output?.title || input?.title;
        const rank = output?.rank || input?.rank;
        if (title) {
            return `Opened: ${truncateText(title, 40)}`;
        }
        if (rank !== undefined) {
            return `Opened result #${rank}`;
        }
        return 'Search result opened';
    }
    return 'Failed to open result';
};

// Content Tools
const readPageContentFormatter: ActionFormatter = ({ state, output }) => {
    if (state === 'loading') {
        return 'Reading page content...';
    }
    if (state === 'success') {
        const contentLength = output?.content?.length || output?.contentLength || 0;
        const title = output?.title;
        if (title) {
            return `Read: ${truncateText(title, 30)} (${contentLength} chars)`;
        }
        return `Read ${contentLength} characters`;
    }
    return 'Failed to read content';
};

const getSelectedTextFormatter: ActionFormatter = ({ state, output }) => {
    if (state === 'loading') {
        return 'Getting selected text...';
    }
    if (state === 'success') {
        const text = output?.text || output?.selectedText;
        const length = text?.length || 0;
        if (length > 0) {
            return `Got ${length} characters: "${truncateText(text, 30)}"`;
        }
        return 'No text selected';
    }
    return 'Failed to get selection';
};

// Interaction Tools
const clickElementFormatter: ActionFormatter = ({ state, input, output }) => {
    if (state === 'loading') {
        const selector = input?.selector;
        if (selector) {
            return `Clicking ${truncateText(selector, 30)}...`;
        }
        return 'Clicking element...';
    }
    if (state === 'success') {
        const clicked = output?.clicked;
        const text = clicked?.text || clicked?.innerText;
        const tagName = clicked?.tagName?.toLowerCase();
        if (text) {
            return `Clicked: ${truncateText(text, 30)}`;
        }
        if (tagName) {
            return `Clicked ${tagName} element`;
        }
        return 'Element clicked';
    }
    return 'Click failed';
};

const typeInFieldFormatter: ActionFormatter = ({ state, input, output }) => {
    if (state === 'loading') {
        const field = input?.field || input?.selector;
        if (field) {
            return `Typing in ${truncateText(field, 30)}...`;
        }
        return 'Typing...';
    }
    if (state === 'success') {
        const length = input?.text?.length || 0;
        return `Typed ${length} characters`;
    }
    return 'Typing failed';
};

const pressKeyFormatter: ActionFormatter = ({ state, input }) => {
    if (state === 'loading') {
        const key = input?.key;
        if (key) {
            return `Pressing ${key}...`;
        }
        return 'Pressing key...';
    }
    if (state === 'success') {
        const key = input?.key;
        return `Pressed ${key || 'key'}`;
    }
    return 'Key press failed';
};

const scrollFormatter: ActionFormatter = ({ state, input }) => {
    if (state === 'loading') {
        const direction = input?.direction || 'down';
        return `Scrolling ${direction}...`;
    }
    if (state === 'success') {
        const direction = input?.direction || 'down';
        return `Scrolled ${direction}`;
    }
    return 'Scroll failed';
};

const waitForElementFormatter: ActionFormatter = ({ state, input }) => {
    if (state === 'loading') {
        const selector = input?.selector;
        if (selector) {
            return `Waiting for ${truncateText(selector, 30)}...`;
        }
        return 'Waiting for element...';
    }
    if (state === 'success') {
        return 'Element found';
    }
    return 'Wait timeout';
};

// Tab Tools
const switchTabsFormatter: ActionFormatter = ({ state, input, output }) => {
    if (state === 'loading') {
        return 'Switching tab...';
    }
    if (state === 'success') {
        const title = output?.title || input?.title;
        if (title) {
            return `Switched to: ${truncateText(title, 40)}`;
        }
        return 'Tab switched';
    }
    return 'Tab switch failed';
};

const getActiveTabFormatter: ActionFormatter = ({ state, output }) => {
    if (state === 'loading') {
        return 'Getting active tab...';
    }
    if (state === 'success') {
        const title = output?.title;
        if (title) {
            return `Active: ${truncateText(title, 40)}`;
        }
        return 'Got active tab';
    }
    return 'Failed to get tab';
};

const openNewTabFormatter: ActionFormatter = ({ state, input, output }) => {
    if (state === 'loading') {
        const url = input?.url;
        if (url) {
            return `Opening new tab: ${truncateText(extractDomain(url), 30)}`;
        }
        return 'Opening new tab...';
    }
    if (state === 'success') {
        const title = output?.title;
        if (title) {
            return `Opened: ${truncateText(title, 40)}`;
        }
        return 'New tab opened';
    }
    return 'Failed to open tab';
};

const closeTabFormatter: ActionFormatter = ({ state, input }) => {
    if (state === 'loading') {
        return 'Closing tab...';
    }
    if (state === 'success') {
        const title = input?.title;
        if (title) {
            return `Closed: ${truncateText(title, 40)}`;
        }
        return 'Tab closed';
    }
    return 'Failed to close tab';
};

const listTabsFormatter: ActionFormatter = ({ state, output }) => {
    if (state === 'loading') {
        return 'Listing tabs...';
    }
    if (state === 'success') {
        const count = output?.tabs?.length || output?.count || 0;
        return `Found ${count} open tabs`;
    }
    return 'Failed to list tabs';
};

// Memory Tools
const saveMemoryFormatter: ActionFormatter = ({ state, input }) => {
    if (state === 'loading') {
        const key = input?.key || input?.name;
        if (key) {
            return `Saving memory: ${humanizeKey(key)}`;
        }
        return 'Saving memory...';
    }
    if (state === 'success') {
        const key = input?.key || input?.name;
        return `Saved: ${humanizeKey(key)}`;
    }
    return 'Failed to save memory';
};

const getMemoryFormatter: ActionFormatter = ({ state, input, output }) => {
    if (state === 'loading') {
        const key = input?.key || input?.name;
        if (key) {
            return `Retrieving memory: ${humanizeKey(key)}`;
        }
        return 'Retrieving memory...';
    }
    if (state === 'success') {
        const key = input?.key || input?.name;
        const found = output?.value !== undefined || output?.found;
        if (found) {
            return `Retrieved: ${humanizeKey(key)}`;
        }
        return `Memory not found: ${humanizeKey(key)}`;
    }
    return 'Failed to retrieve memory';
};

const deleteMemoryFormatter: ActionFormatter = ({ state, input }) => {
    if (state === 'loading') {
        const key = input?.key || input?.name;
        if (key) {
            return `Deleting memory: ${humanizeKey(key)}`;
        }
        return 'Deleting memory...';
    }
    if (state === 'success') {
        const key = input?.key || input?.name;
        return `Deleted: ${humanizeKey(key)}`;
    }
    return 'Failed to delete memory';
};

const listMemoriesFormatter: ActionFormatter = ({ state, output }) => {
    if (state === 'loading') {
        return 'Listing memories...';
    }
    if (state === 'success') {
        const count = output?.memories?.length || output?.count || 0;
        return `Found ${count} memories`;
    }
    return 'Failed to list memories';
};

// History Tools
const getHistoryFormatter: ActionFormatter = ({ state, input, output }) => {
    if (state === 'loading') {
        const query = input?.query;
        if (query) {
            return `Searching history: ${truncateText(query, 30)}`;
        }
        return 'Searching history...';
    }
    if (state === 'success') {
        const count = output?.results?.length || output?.count || 0;
        return `Found ${count} history items`;
    }
    return 'History search failed';
};

// Formatter Registry
const formatters: Record<string, ActionFormatter> = {
    // Navigation
    navigateTo: navigateToFormatter,
    navigate: navigateToFormatter,
    goTo: navigateToFormatter,

    // Search
    getSearchResults: getSearchResultsFormatter,
    searchGoogle: getSearchResultsFormatter,
    search: getSearchResultsFormatter,
    openSearchResult: openSearchResultFormatter,

    // Content
    readPageContent: readPageContentFormatter,
    getPageContent: readPageContentFormatter,
    extractContent: readPageContentFormatter,
    getSelectedText: getSelectedTextFormatter,
    getSelection: getSelectedTextFormatter,

    // Interactions
    clickElement: clickElementFormatter,
    click: clickElementFormatter,
    typeInField: typeInFieldFormatter,
    type: typeInFieldFormatter,
    pressKey: pressKeyFormatter,
    scroll: scrollFormatter,
    waitForElement: waitForElementFormatter,
    waitFor: waitForElementFormatter,

    // Tabs
    switchTabs: switchTabsFormatter,
    switchTab: switchTabsFormatter,
    getActiveTab: getActiveTabFormatter,
    openNewTab: openNewTabFormatter,
    newTab: openNewTabFormatter,
    closeTab: closeTabFormatter,
    listTabs: listTabsFormatter,

    // Memory
    saveMemory: saveMemoryFormatter,
    getMemory: getMemoryFormatter,
    retrieveMemory: getMemoryFormatter,
    deleteMemory: deleteMemoryFormatter,
    listMemories: listMemoriesFormatter,

    // History
    getHistory: getHistoryFormatter,
    searchHistory: getHistoryFormatter,
};

// Default formatter for tools without specific formatters
function defaultFormatter(ctx: ActionFormatterContext): string {
    const { toolName, state } = ctx;
    const friendlyName = camelToTitle(toolName);

    if (state === 'loading') {
        return `${friendlyName}...`;
    }
    if (state === 'success') {
        return `${friendlyName} ✓`;
    }
    return `${friendlyName} failed`;
}

/**
 * Format a tool action into a human-readable description
 * @param ctx - Action context with tool name, state, input, and output
 * @returns Formatted action description
 */
export function formatToolAction(ctx: ActionFormatterContext): string {
    const formatter = formatters[ctx.toolName] || defaultFormatter;
    try {
        return formatter(ctx);
    } catch (error) {
        console.error(`Error formatting tool action for ${ctx.toolName}:`, error);
        return defaultFormatter(ctx);
    }
}
