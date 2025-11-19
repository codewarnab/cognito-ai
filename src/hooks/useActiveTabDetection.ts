import { useState, useEffect } from 'react';
import { createLogger } from '@logger';

const log = createLogger('useActiveTabDetection');

/**
 * Information about a detected local PDF file
 */
export interface LocalPdfInfo {
    /** The full file:/// URL of the PDF */
    url: string;
    /** The extracted filename from the URL */
    filename: string;
    /** The full file path (decoded) */
    filePath: string;
}

/**
 * Return type for the useActiveTabDetection hook
 */
export interface ActiveTabDetection {
    /** The current active tab URL */
    url?: string;
    /** Whether the active tab is displaying a local PDF file */
    isLocalPdf: boolean;
    /** The extracted filename if it's a local PDF */
    filename?: string;
    /** The full file path if it's a local PDF */
    filePath?: string;
}

/**
 * Regex pattern to detect local PDF files
 * Matches: file:///path/to/file.pdf or file:///C:/path/to/file.pdf
 */
const LOCAL_PDF_PATTERN = /^file:\/\/\/.*\.pdf$/i;

/**
 * Extract filename from a file:/// URL
 * Handles URL encoding and platform-specific paths
 * 
 * @param url - The file:/// URL
 * @returns The decoded filename
 */
function extractFilename(url: string): string {
    try {
        // Remove file:/// prefix
        const path = url.replace(/^file:\/\/\//, '');

        // Decode URL encoding (spaces, special characters)
        const decodedPath = decodeURIComponent(path);

        // Extract filename (everything after the last slash or backslash)
        const filename = decodedPath.split(/[/\\]/).pop() || '';

        return filename;
    } catch (error) {
        log.error('Error extracting filename from URL', { url, error });
        return '';
    }
}

/**
 * Extract full file path from a file:/// URL
 * 
 * @param url - The file:/// URL
 * @returns The decoded file path
 */
function extractFilePath(url: string): string {
    try {
        // Remove file:/// prefix
        const path = url.replace(/^file:\/\/\//, '');

        // Decode URL encoding
        const decodedPath = decodeURIComponent(path);

        return decodedPath;
    } catch (error) {
        log.error('Error extracting file path from URL', { url, error });
        return '';
    }
}

/**
 * Check if a URL is a local PDF file
 * 
 * @param url - The URL to check
 * @returns True if the URL is a local PDF file
 */
function isLocalPdfUrl(url?: string): boolean {
    if (!url) return false;
    return LOCAL_PDF_PATTERN.test(url);
}

/**
 * Hook to detect when the user is viewing a local PDF file
 * 
 * This hook:
 * - Uses chrome.tabs.query() to get the active tab URL
 * - Sets up listeners for chrome.tabs.onActivated and chrome.tabs.onUpdated
 * - Detects local PDF files (file:///*.pdf)
 * - Extracts filename and file path from the URL
 * - Handles URL decoding for spaces and special characters
 * 
 * @returns Object containing URL, isLocalPdf flag, filename, and filePath
 */
export function useActiveTabDetection(): ActiveTabDetection {
    const [tabInfo, setTabInfo] = useState<ActiveTabDetection>({
        isLocalPdf: false,
    });

    useEffect(() => {
        /**
         * Update the tab information based on the current active tab
         */
        const updateTabInfo = async () => {
            try {
                const [tab] = await chrome.tabs.query({
                    active: true,
                    currentWindow: true
                });

                if (!tab || !tab.url) {
                    log.debug('No active tab or URL found');
                    setTabInfo({ isLocalPdf: false });
                    return;
                }

                const url = tab.url;
                const isPdf = isLocalPdfUrl(url);

                if (isPdf) {
                    const filename = extractFilename(url);
                    const filePath = extractFilePath(url);

                    log.info('Local PDF detected', { url, filename, filePath });

                    setTabInfo({
                        url,
                        isLocalPdf: true,
                        filename,
                        filePath,
                    });
                } else {
                    log.debug('Active tab is not a local PDF', { url });
                    setTabInfo({
                        url,
                        isLocalPdf: false,
                    });
                }
            } catch (error) {
                log.error('Failed to get active tab information', error);
                setTabInfo({ isLocalPdf: false });
            }
        };

        // Initial load
        updateTabInfo();

        /**
         * Handler for when a tab is activated (user switches tabs)
         */
        const handleTabActivated = (_activeInfo: chrome.tabs.TabActiveInfo) => {
            log.debug('Tab activated, updating tab info');
            updateTabInfo();
        };

        /**
         * Handler for when a tab is updated (URL or other properties change)
         */
        const handleTabUpdated = (
            tabId: number,
            changeInfo: chrome.tabs.TabChangeInfo
        ) => {
            // Only update if the URL changed and it's the active tab
            if (changeInfo.url) {
                chrome.tabs.query({ active: true, currentWindow: true }, ([activeTab]) => {
                    if (activeTab && activeTab.id === tabId) {
                        log.debug('Active tab URL updated', { url: changeInfo.url });
                        updateTabInfo();
                    }
                });
            }
        };

        // Register event listeners
        chrome.tabs.onActivated.addListener(handleTabActivated);
        chrome.tabs.onUpdated.addListener(handleTabUpdated);

        // Cleanup listeners on unmount
        return () => {
            chrome.tabs.onActivated.removeListener(handleTabActivated);
            chrome.tabs.onUpdated.removeListener(handleTabUpdated);
        };
    }, []);

    return tabInfo;
}
