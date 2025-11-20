import { useState, useEffect } from 'react';
import { createLogger } from '~logger';

const log = createLogger('useYouTubeVideoDetection');

/**
 * Information about a detected YouTube video
 */
export interface YouTubeVideoInfo {
    /** The full YouTube video URL */
    url: string;
    /** The video ID extracted from the URL */
    videoId: string;
    /** The video title from the page */
    title: string;
}

/**
 * Return type for the useYouTubeVideoDetection hook
 */
export interface YouTubeVideoDetection {
    /** The current active tab URL */
    url?: string;
    /** Whether the active tab is a YouTube watch page */
    isYouTubeVideo: boolean;
    /** The video ID if it's a YouTube video */
    videoId?: string;
    /** The video title if available */
    title?: string;
}

/**
 * Regex pattern to detect YouTube watch pages
 * Matches: youtube.com/watch?v=VIDEO_ID or youtu.be/VIDEO_ID
 */
const YOUTUBE_WATCH_PATTERN = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;

/**
 * Extract video ID from a YouTube URL
 * 
 * @param url - The YouTube URL
 * @returns The video ID or null if not found
 */
function extractVideoId(url: string): string | null {
    const match = url.match(YOUTUBE_WATCH_PATTERN);
    return match ? match[3] : null;
}

/**
 * Check if a URL is a YouTube watch page
 * 
 * @param url - The URL to check
 * @returns True if the URL is a YouTube watch page
 */
function isYouTubeWatchUrl(url?: string): boolean {
    if (!url) return false;
    return YOUTUBE_WATCH_PATTERN.test(url);
}

/**
 * Extract video title from the active tab
 * 
 * @param tabId - The tab ID
 * @returns The video title or a default value
 */
async function extractVideoTitle(tabId: number): Promise<string> {
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                // Try multiple selectors for video title
                const titleElement = 
                    document.querySelector('h1.ytd-watch-metadata yt-formatted-string') ||
                    document.querySelector('h1.title yt-formatted-string') ||
                    document.querySelector('meta[name="title"]');
                
                if (titleElement) {
                    return titleElement.textContent?.trim() || 
                           (titleElement as HTMLMetaElement).content?.trim() ||
                           'YouTube Video';
                }
                
                return document.title.replace(' - YouTube', '') || 'YouTube Video';
            }
        });

        return results[0]?.result || 'YouTube Video';
    } catch (error) {
        log.warn('Failed to extract video title', error);
        return 'YouTube Video';
    }
}

/**
 * Hook to detect when the user is viewing a YouTube video
 * 
 * This hook:
 * - Uses chrome.tabs.query() to get the active tab URL
 * - Sets up listeners for chrome.tabs.onActivated and chrome.tabs.onUpdated
 * - Detects YouTube watch pages
 * - Extracts video ID and title from the page
 * 
 * @returns Object containing URL, isYouTubeVideo flag, videoId, and title
 */
export function useYouTubeVideoDetection(): YouTubeVideoDetection {
    const [videoInfo, setVideoInfo] = useState<YouTubeVideoDetection>({
        isYouTubeVideo: false,
    });

    useEffect(() => {
        let pollingInterval: NodeJS.Timeout | null = null;

        /**
         * Update the video information based on the current active tab
         */
        const updateVideoInfo = async () => {
            try {
                const [tab] = await chrome.tabs.query({
                    active: true,
                    currentWindow: true
                });

                if (!tab || !tab.url || !tab.id) {
                    log.debug('No active tab or URL found');
                    setVideoInfo({ isYouTubeVideo: false });
                    return;
                }

                const url = tab.url;
                const isYouTube = isYouTubeWatchUrl(url);

                if (isYouTube) {
                    const videoId = extractVideoId(url);
                    
                    if (!videoId) {
                        log.warn('YouTube URL detected but no video ID found', { url });
                        setVideoInfo({ isYouTubeVideo: false });
                        return;
                    }

                    // Extract video title from the page
                    const title = await extractVideoTitle(tab.id);

                    log.info('YouTube video detected', { url, videoId, title });

                    setVideoInfo({
                        url,
                        isYouTubeVideo: true,
                        videoId,
                        title,
                    });
                } else {
                    log.debug('Active tab is not a YouTube video', { url });
                    setVideoInfo({
                        url,
                        isYouTubeVideo: false,
                    });
                }
            } catch (error) {
                log.error('Failed to get active tab information', error);
                setVideoInfo({ isYouTubeVideo: false });
            }
        };

        // Initial load
        updateVideoInfo();

        /**
         * Handler for when a tab is activated (user switches tabs)
         */
        const handleTabActivated = (_activeInfo: chrome.tabs.TabActiveInfo) => {
            log.debug('Tab activated, updating video info');
            updateVideoInfo();
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
                        updateVideoInfo();
                    }
                });
            }
        };

        // Register event listeners
        chrome.tabs.onActivated.addListener(handleTabActivated);
        chrome.tabs.onUpdated.addListener(handleTabUpdated);

        // Poll every 2 seconds to catch any missed updates
        pollingInterval = setInterval(() => {
            log.debug('Polling for video info updates');
            updateVideoInfo();
        }, 2000);

        // Cleanup listeners on unmount
        return () => {
            chrome.tabs.onActivated.removeListener(handleTabActivated);
            chrome.tabs.onUpdated.removeListener(handleTabUpdated);
            if (pollingInterval) {
                clearInterval(pollingInterval);
            }
        };
    }, []);

    return videoInfo;
}
