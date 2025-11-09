/**
 * Formatter registry - Maps tool names to their formatters
 */

import type { ActionFormatter } from './types';
import { navigateToFormatter } from './formatters/navigation';
import {
    getSearchResultsFormatter,
    chromeSearchFormatter,
    openSearchResultFormatter
} from './formatters/search';
import {
    readPageContentFormatter,
    getSelectedTextFormatter,
    extractTextFormatter,
    scrollIntoViewFormatter,
    findSearchBarFormatter
} from './formatters/content';
import {
    clickElementFormatter,
    focusElementFormatter,
    clickByTextFormatter,
    typeInFieldFormatter,
    pressKeyFormatter,
    globalTypeTextFormatter,
    scrollFormatter,
    waitForElementFormatter
} from './formatters/interaction';
import {
    switchTabsFormatter,
    getActiveTabFormatter,
    getAllTabsFormatter,
    openNewTabFormatter,
    closeTabFormatter,
    listTabsFormatter,
    organizeTabsByContextFormatter,
    applyTabGroupsFormatter,
    ungroupTabsFormatter
} from './formatters/tabs';
import {
    saveMemoryFormatter,
    getMemoryFormatter,
    deleteMemoryFormatter,
    listMemoriesFormatter,
    cancelReminderFormatter
} from './formatters/memory';
import {
    getHistoryFormatter,
    getRecentHistoryFormatter,
    getUrlVisitsFormatter
} from './formatters/history';
import {
    getYoutubeTranscriptFormatter,
    youtubeAgentFormatter
} from './formatters/youtube';
import {
    pdfAgentFormatter
} from './formatters/pdf';
import {
    getReportTemplateFormatter,
    generatePDFFormatter,
    generateMarkdownFormatter
} from './formatters/reports';
import { takeScreenshotFormatter } from './formatters/screenshot';

export const formatters: Record<string, ActionFormatter> = {
    // Navigation
    navigateTo: navigateToFormatter,
    navigate: navigateToFormatter,
    goTo: navigateToFormatter,

    // Search
    getSearchResults: getSearchResultsFormatter,
    searchGoogle: getSearchResultsFormatter,
    search: getSearchResultsFormatter,
    chromeSearch: chromeSearchFormatter,
    openSearchResult: openSearchResultFormatter,

    // Content
    readPageContent: readPageContentFormatter,
    getPageContent: readPageContentFormatter,
    extractContent: readPageContentFormatter,
    getSelectedText: getSelectedTextFormatter,
    getSelection: getSelectedTextFormatter,
    extractText: extractTextFormatter,
    scrollIntoView: scrollIntoViewFormatter,
    findSearchBar: findSearchBarFormatter,

    // Screenshot
    takeScreenshot: takeScreenshotFormatter,
    screenshot: takeScreenshotFormatter,

    // Interactions
    clickElement: clickElementFormatter,
    click: clickElementFormatter,
    clickByText: clickByTextFormatter,
    focusElement: focusElementFormatter,
    typeInField: typeInFieldFormatter,
    type: typeInFieldFormatter,
    pressKey: pressKeyFormatter,
    globalTypeText: globalTypeTextFormatter,
    scroll: scrollFormatter,
    waitForElement: waitForElementFormatter,
    waitFor: waitForElementFormatter,

    // Tabs
    switchTabs: switchTabsFormatter,
    switchTab: switchTabsFormatter,
    getActiveTab: getActiveTabFormatter,
    getAllTabs: getAllTabsFormatter,
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

    // Reminders
    cancelReminder: cancelReminderFormatter,

    // History
    getHistory: getHistoryFormatter,
    searchHistory: getHistoryFormatter,
    getRecentHistory: getRecentHistoryFormatter,
    getUrlVisits: getUrlVisitsFormatter,

    // YouTube
    getYoutubeTranscript: getYoutubeTranscriptFormatter,
    youtubeTranscript: getYoutubeTranscriptFormatter,
    analyzeYouTubeVideo: youtubeAgentFormatter,
    youtubeAgentAsTool: youtubeAgentFormatter,

    // PDF
    analyzePdfDocument: pdfAgentFormatter,
    pdfAgentAsTool: pdfAgentFormatter,

    // Reports
    getReportTemplate: getReportTemplateFormatter,
    generatePDF: generatePDFFormatter,
    generateMarkdown: generateMarkdownFormatter,
};
