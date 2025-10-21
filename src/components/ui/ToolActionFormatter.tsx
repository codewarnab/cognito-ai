/**
 * ToolActionFormatter - Transforms technical tool names into human-readable action descriptions
 * Shows contextual information from tool input/output instead of raw function names
 */

export interface ActionFormatterContext {
    toolName: string;
    state: 'loading' | 'success' | 'error';
    input?: any;
    output?: any;
}

export interface FormattedAction {
    action: string;
    description?: string;
}

type ActionFormatter = (ctx: ActionFormatterContext) => FormattedAction;

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
    const url = output?.url || input?.url || input?.targetUrl;
    const domain = url ? extractDomain(url) : '';
    const newTab = input?.newTab || output?.newTab;

    if (state === 'loading') {
        return {
            action: 'Navigating',
            description: domain ? truncateText(domain, 40) : undefined
        };
    }
    if (state === 'success') {
        return {
            action: newTab ? 'Opened in new tab' : 'Navigated',
            description: domain ? truncateText(domain, 40) : undefined
        };
    }
    return {
        action: 'Navigation failed',
        description: domain ? truncateText(domain, 40) : undefined
    };
};

// Search Tools
const getSearchResultsFormatter: ActionFormatter = ({ state, output }) => {
    if (state === 'loading') {
        return { action: 'Reading search results' };
    }
    if (state === 'success') {
        const count = output?.results?.length || output?.count || 0;
        const engine = output?.engine || 'search';
        return {
            action: `Found ${count} results`,
            description: engine
        };
    }
    return { action: 'Search failed' };
};

const openSearchResultFormatter: ActionFormatter = ({ state, input, output }) => {
    const title = output?.title || input?.title;
    const rank = output?.rank || input?.rank || input?.index;

    if (state === 'loading') {
        return {
            action: 'Opening search result',
            description: rank !== undefined ? `Result #${rank}` : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'Opened search result',
            description: title ? truncateText(title, 40) : rank !== undefined ? `Result #${rank}` : undefined
        };
    }
    return { action: 'Failed to open result' };
};

// Content Tools
const readPageContentFormatter: ActionFormatter = ({ state, output }) => {
    const title = output?.title;
    const contentLength = output?.content?.length || output?.contentLength || 0;
    const formattedLength = contentLength >= 1000 ? `${Math.round(contentLength / 1000)}k chars` : `${contentLength} chars`;

    if (state === 'loading') {
        return {
            action: 'Reading page content',
            description: title ? truncateText(title, 40) : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'Read page content',
            description: title ? `${truncateText(title, 30)} (${formattedLength})` : formattedLength
        };
    }
    return { action: 'Failed to read content' };
};

const getSelectedTextFormatter: ActionFormatter = ({ state, output }) => {
    const text = output?.text || output?.selectedText;
    const length = text?.length || 0;

    if (state === 'loading') {
        return { action: 'Getting selected text' };
    }
    if (state === 'success') {
        if (length > 0) {
            return {
                action: 'Got selected text',
                description: `${length} characters`
            };
        }
        return { action: 'No text selected' };
    }
    return { action: 'Failed to get selection' };
};

// Interaction Tools
const clickElementFormatter: ActionFormatter = ({ state, input, output }) => {
    const clicked = output?.clicked;
    const text = clicked?.text || clicked?.innerText;
    const selector = input?.selector;

    if (state === 'loading') {
        return {
            action: 'Clicking element',
            description: selector ? truncateText(selector, 40) : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'Clicked',
            description: text ? truncateText(text, 40) : selector ? truncateText(selector, 40) : undefined
        };
    }
    return { action: 'Click failed' };
};

const typeInFieldFormatter: ActionFormatter = ({ state, input, output }) => {
    const target = input?.target;
    const text = input?.text || '';
    const length = text.length;
    const preview = truncateText(text, 20);

    if (state === 'loading') {
        return {
            action: 'Typing',
            description: target ? `"${preview}" • ${target}` : `"${preview}"`
        };
    }
    if (state === 'success') {
        const message = output?.message;
        const typed = output?.typed || length;
        const pressedEnter = input?.pressEnter || message?.includes('Enter');

        return {
            action: 'Text Typed',
            description: target
                ? `${typed} chars${pressedEnter ? ' + Enter' : ''} • ${target}`
                : `${typed} chars${pressedEnter ? ' + Enter' : ''}`
        };
    }
    return {
        action: 'Typing failed',
        description: target ? truncateText(target, 40) : undefined
    };
};

const pressKeyFormatter: ActionFormatter = ({ state, input }) => {
    const key = input?.key;

    if (state === 'loading') {
        return {
            action: 'Pressing key',
            description: key
        };
    }
    if (state === 'success') {
        return {
            action: 'Pressed key',
            description: key
        };
    }
    return { action: 'Key press failed' };
};

const scrollFormatter: ActionFormatter = ({ state, input }) => {
    const direction = input?.direction || 'down';

    if (state === 'loading') {
        return {
            action: 'Scrolling',
            description: direction
        };
    }
    if (state === 'success') {
        return {
            action: 'Scrolled',
            description: direction
        };
    }
    return { action: 'Scroll failed' };
};

const waitForElementFormatter: ActionFormatter = ({ state, input }) => {
    const selector = input?.selector;

    if (state === 'loading') {
        return {
            action: 'Waiting for element',
            description: selector ? truncateText(selector, 40) : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'Element found',
            description: selector ? truncateText(selector, 40) : undefined
        };
    }
    return { action: 'Wait timeout' };
};

// Tab Tools
const switchTabsFormatter: ActionFormatter = ({ state, input, output }) => {
    const title = output?.title || input?.title;

    if (state === 'loading') {
        return { action: 'Switching tab' };
    }
    if (state === 'success') {
        return {
            action: 'Switched tab',
            description: title ? truncateText(title, 40) : undefined
        };
    }
    return { action: 'Tab switch failed' };
};

const getActiveTabFormatter: ActionFormatter = ({ state, output }) => {
    const title = output?.title;

    if (state === 'loading') {
        return { action: 'Getting active tab' };
    }
    if (state === 'success') {
        return {
            action: 'Active tab',
            description: title ? truncateText(title, 40) : undefined
        };
    }
    return { action: 'Failed to get tab' };
};

const openNewTabFormatter: ActionFormatter = ({ state, input, output }) => {
    const url = input?.url;
    const title = output?.title;
    const domain = url ? extractDomain(url) : '';

    if (state === 'loading') {
        return {
            action: 'Opening new tab',
            description: domain ? truncateText(domain, 40) : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'New tab opened',
            description: title ? truncateText(title, 40) : domain ? truncateText(domain, 40) : undefined
        };
    }
    return { action: 'Failed to open tab' };
};

const closeTabFormatter: ActionFormatter = ({ state, input }) => {
    const title = input?.title;

    if (state === 'loading') {
        return { action: 'Closing tab' };
    }
    if (state === 'success') {
        return {
            action: 'Tab closed',
            description: title ? truncateText(title, 40) : undefined
        };
    }
    return { action: 'Failed to close tab' };
};

const listTabsFormatter: ActionFormatter = ({ state, output }) => {
    if (state === 'loading') {
        return { action: 'Listing tabs' };
    }
    if (state === 'success') {
        const count = output?.tabs?.length || output?.count || 0;
        return {
            action: 'Found tabs',
            description: `${count} open tabs`
        };
    }
    return { action: 'Failed to list tabs' };
};

const organizeTabsByContextFormatter: ActionFormatter = ({ state, input, output }) => {
    if (state === 'loading') {
        return { action: 'Organizing tabs' };
    }
    if (state === 'success') {
        if (output?.needsAIAnalysis) {
            const tabCount = output?.tabs?.length || 0;
            return {
                action: 'Prepared for analysis',
                description: `${tabCount} tabs`
            };
        }
        if (output?.groups) {
            const groupCount = output?.groups?.length || 0;
            return {
                action: 'Tabs organized',
                description: `${groupCount} groups`
            };

        }
        if (output?.error) {
            return { action: 'Organization failed' };
        }
        return { action: 'Tabs organized' };
    }
    return { action: 'Failed to organize tabs' };
};

const applyTabGroupsFormatter: ActionFormatter = ({ state, input, output }) => {
    const groupCount = input?.groups?.length || 0;
    const groupsCreated = output?.groupsCreated || output?.groups?.length || 0;

    if (state === 'loading') {
        return {
            action: 'Applying tab groups',
            description: groupCount > 0 ? `${groupCount} groups` : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'Tab groups applied',
            description: groupsCreated > 0 ? `${groupsCreated} groups created` : undefined
        };
    }
    return { action: 'Failed to apply groups' };
};

const ungroupTabsFormatter: ActionFormatter = ({ state, input, output }) => {
    const groupCount = input?.groupIds?.length || 0;
    const ungrouped = output?.ungroupedCount || 0;

    if (state === 'loading') {
        if (input?.ungroupAll) {
            return { action: 'Ungrouping all tabs' };
        }
        return {
            action: 'Ungrouping tabs',
            description: groupCount > 0 ? `${groupCount} group(s)` : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'Tabs ungrouped',
            description: ungrouped > 0 ? `${ungrouped} group(s)` : undefined
        };
    }
    return { action: 'Failed to ungroup tabs' };
};

// Memory Tools
const saveMemoryFormatter: ActionFormatter = ({ state, input }) => {
    const key = input?.key || input?.name;

    if (state === 'loading') {
        return {
            action: 'Saving memory',
            description: key ? humanizeKey(key) : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'Memory saved',
            description: key ? humanizeKey(key) : undefined
        };
    }
    return { action: 'Failed to save memory' };
};

const getMemoryFormatter: ActionFormatter = ({ state, input, output }) => {
    const key = input?.key || input?.name;
    const found = output?.value !== undefined || output?.found;

    if (state === 'loading') {
        return {
            action: 'Retrieving memory',
            description: key ? humanizeKey(key) : undefined
        };
    }
    if (state === 'success') {
        if (found) {
            return {
                action: 'Memory retrieved',
                description: key ? humanizeKey(key) : undefined
            };
        }
        return {
            action: 'Memory not found',
            description: key ? humanizeKey(key) : undefined
        };
    }
    return { action: 'Failed to retrieve memory' };
};

const deleteMemoryFormatter: ActionFormatter = ({ state, input }) => {
    const key = input?.key || input?.name;

    if (state === 'loading') {
        return {
            action: 'Deleting memory',
            description: key ? humanizeKey(key) : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'Memory deleted',
            description: key ? humanizeKey(key) : undefined
        };
    }
    return { action: 'Failed to delete memory' };
};

const listMemoriesFormatter: ActionFormatter = ({ state, output }) => {
    if (state === 'loading') {
        return { action: 'Listing memories' };
    }
    if (state === 'success') {
        const count = output?.memories?.length || output?.count || 0;
        return {
            action: 'Found memories',
            description: `${count} items`
        };
    }
    return { action: 'Failed to list memories' };
};

// History Tools
const getHistoryFormatter: ActionFormatter = ({ state, input, output }) => {
    const query = input?.query;

    if (state === 'loading') {
        return {
            action: 'Searching history',
            description: query ? truncateText(query, 30) : undefined
        };
    }
    if (state === 'success') {
        const count = output?.results?.length || output?.count || 0;
        return {
            action: 'Found history items',
            description: `${count} results`
        };
    }
    return { action: 'History search failed' };
};

// YouTube Tools
const getYoutubeTranscriptFormatter: ActionFormatter = ({ state, input, output }) => {
    const videoTitle = output?.videoTitle;
    const lang = input?.lang;

    if (state === 'loading') {
        return {
            action: 'Fetching transcript',
            description: videoTitle ? truncateText(videoTitle, 40) : undefined
        };
    }
    if (state === 'success') {
        // Check if actually successful (YouTube tool returns success:false on error)
        if (output?.success === false || output?.error) {
            return {
                action: 'Transcript unavailable',
                description: videoTitle ? truncateText(videoTitle, 40) : output?.error ? truncateText(output.error, 40) : undefined
            };
        }
        const segmentCount = output?.transcript?.length || 0;
        const duration = output?.transcript?.[output.transcript.length - 1]?.timestamp || 0;
        const minutes = Math.floor(duration / 60);
        const durationStr = duration > 0 ? `${minutes}m ${Math.floor(duration % 60)}s` : '';

        return {
            action: 'Transcript retrieved',
            description: videoTitle
                ? `${truncateText(videoTitle, 30)} (${segmentCount} segments${durationStr ? ', ' + durationStr : ''})`
                : `${segmentCount} segments${durationStr ? ', ' + durationStr : ''}`
        };
    }
    return {
        action: 'Transcript failed',
        description: videoTitle ? truncateText(videoTitle, 40) : undefined
    };
};

const youtubeAgentFormatter: ActionFormatter = ({ state, input, output }) => {
    const question = input?.question;
    const wasChunked = output?.wasChunked;

    if (state === 'loading') {
        return {
            action: 'Analyzing YouTube video',
            description: question ? truncateText(question, 40) : undefined
        };
    }
    if (state === 'success') {
        const answerLength = output?.answer?.length || 0;
        const duration = output?.videoDuration;
        const durationText = duration
            ? duration >= 3600
                ? `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`
                : duration >= 60
                    ? `${Math.floor(duration / 60)}m`
                    : `${duration}s`
            : '';

        return {
            action: 'Video analyzed',
            description: wasChunked
                ? `Long video (${durationText}) - chunked analysis`
                : durationText
                    ? `${durationText} video`
                    : `Analysis complete`
        };
    }
    return {
        action: 'Analysis failed',
        description: question ? truncateText(question, 40) : undefined
    };
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
    organizeTabsByContext: organizeTabsByContextFormatter,
    applyTabGroups: applyTabGroupsFormatter,
    ungroupTabs: ungroupTabsFormatter,

    // Memory
    saveMemory: saveMemoryFormatter,
    getMemory: getMemoryFormatter,
    retrieveMemory: getMemoryFormatter,
    deleteMemory: deleteMemoryFormatter,
    listMemories: listMemoriesFormatter,

    // History
    getHistory: getHistoryFormatter,
    searchHistory: getHistoryFormatter,

    // YouTube
    getYoutubeTranscript: getYoutubeTranscriptFormatter,
    youtubeTranscript: getYoutubeTranscriptFormatter,
    youtubeAgentAsTool: youtubeAgentFormatter,
};

// Default formatter for tools without specific formatters
function defaultFormatter(ctx: ActionFormatterContext): FormattedAction {
    const { toolName, state } = ctx;
    const friendlyName = camelToTitle(toolName);

    if (state === 'loading') {
        return { action: friendlyName };
    }
    if (state === 'success') {
        return { action: friendlyName };
    }
    return { action: `${friendlyName} failed` };
}

/**
 * Format a tool action into a human-readable description
 * @param ctx - Action context with tool name, state, input, and output
 * @returns Formatted action with optional description
 */
export function formatToolAction(ctx: ActionFormatterContext): FormattedAction {
    const formatter = formatters[ctx.toolName] || defaultFormatter;
    try {
        return formatter(ctx);
    } catch (error) {
        console.error(`Error formatting tool action for ${ctx.toolName}:`, error);
        return defaultFormatter(ctx);
    }
}
