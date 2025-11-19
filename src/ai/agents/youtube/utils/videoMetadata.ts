import { createLogger } from '~logger';
import { BrowserAPIError, parseError } from '../../../../errors';
import { formatDuration } from './formatting';

const log = createLogger('YouTube-Metadata');

// Maximum chunk duration in seconds (30 minutes)
export const MAX_CHUNK_DURATION = 30 * 60; // 1800 seconds

/**
 * Extract video ID from YouTube URL
 * @param youtubeUrl - The YouTube video URL
 * @returns Video ID or undefined if not found
 */
export function extractVideoId(youtubeUrl: string): string | undefined {
    const videoIdMatch = youtubeUrl.match(/[?&]v=([^&]+)/);
    return videoIdMatch ? videoIdMatch[1] : undefined;
}

/**
 * Extract video duration from YouTube page
 * @param youtubeUrl - The YouTube video URL
 * @returns Duration in seconds, or undefined if not found
 */
export async function getVideoDuration(youtubeUrl: string): Promise<number | undefined> {
    try {
        log.info('📹 Attempting to extract video duration', { youtubeUrl });

        const videoId = extractVideoId(youtubeUrl);
        if (!videoId) {
            log.warn('❌ Could not extract video ID from URL', { youtubeUrl });
            return undefined;
        }

        log.info('✅ Video ID extracted', { videoId });

        // Query the active tab to get video duration
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        log.info('🔍 Active tab queried', {
            tabId: tab?.id,
            tabUrl: tab?.url,
            isYouTubePage: tab?.url?.includes('youtube.com/watch')
        });

        if (!tab || !tab.id) {
            log.warn('⚠️ No active tab found');
            return undefined;
        }

        if (!tab.url?.includes('youtube.com/watch')) {
            log.warn('⚠️ Active tab is not a YouTube video page', {
                tabId: tab.id,
                tabUrl: tab.url
            });
            return undefined;
        }

        log.info('💉 Injecting script to extract duration from page', { tabId: tab.id });

        // Execute script to extract duration from page
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                try {
                    console.log('[YT Duration] Starting extraction...');

                    // Try to get ytInitialPlayerResponse
                    let ytData = (window as any).ytInitialPlayerResponse;
                    console.log('[YT Duration] window.ytInitialPlayerResponse exists:', !!ytData);

                    // If not found, try to extract from script tag
                    if (!ytData) {
                        console.log('[YT Duration] Searching script tags...');
                        const scripts = Array.from(document.querySelectorAll('script'));
                        const playerScript = scripts.find(s => s.textContent?.includes('ytInitialPlayerResponse'));
                        console.log('[YT Duration] Found script with ytInitialPlayerResponse:', !!playerScript);

                        if (playerScript?.textContent) {
                            const match = playerScript.textContent.match(/var ytInitialPlayerResponse\s*=\s*({.+?});/);
                            if (match && match[1]) {
                                ytData = JSON.parse(match[1]);
                                console.log('[YT Duration] Successfully parsed ytData from script tag');
                            } else {
                                console.log('[YT Duration] Failed to match ytInitialPlayerResponse in script');
                            }
                        }
                    }

                    if (ytData?.videoDetails) {
                        console.log('[YT Duration] Video details found:', {
                            videoId: ytData.videoDetails.videoId,
                            title: ytData.videoDetails.title,
                            lengthSeconds: ytData.videoDetails.lengthSeconds
                        });
                    } else {
                        console.log('[YT Duration] No videoDetails found in ytData');
                    }

                    const lengthSeconds = ytData?.videoDetails?.lengthSeconds;
                    const duration = lengthSeconds ? parseInt(lengthSeconds, 10) : undefined;
                    console.log('[YT Duration] Final duration:', duration);

                    return duration;
                } catch (error) {
                    console.error('[YT Duration] Error extracting duration:', error);
                    return undefined;
                }
            },
        });

        const duration = results[0]?.result;

        if (duration) {
            log.info('✅ Video duration extracted successfully', {
                duration,
                formatted: formatDuration(duration),
                willRequireChunking: duration > MAX_CHUNK_DURATION,
                estimatedChunks: duration > MAX_CHUNK_DURATION ? Math.ceil(duration / MAX_CHUNK_DURATION) : 1
            });
        } else {
            log.warn('⚠️ Could not extract video duration from page', {
                scriptResult: results[0]?.result
            });
        }

        return duration;
    } catch (error) {
        // Check for Chrome API permission errors
        const parsedError = parseError(error, { context: 'chrome-api' });

        if (parsedError instanceof BrowserAPIError) {
            log.error('❌ Browser API error getting video duration:', parsedError.userMessage);
            // Don't throw - just return undefined and fallback to video analysis
            return undefined;
        }

        log.error('❌ Error getting video duration:', error);
        return undefined;
    }
}

/**
 * Extract video description from YouTube page
 * @param youtubeUrl - The YouTube video URL
 * @returns Video description or undefined if not found
 */
export async function getVideoDescription(youtubeUrl: string): Promise<string | undefined> {
    try {
        log.info('📝 Attempting to extract video description', { youtubeUrl });

        // Query the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.id || !tab.url?.includes('youtube.com/watch')) {
            log.warn('⚠️ Active tab is not a YouTube video page');
            return undefined;
        }

        log.info('💉 Injecting script to extract description from page', { tabId: tab.id });

        // Execute script to extract description from page
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                return new Promise((resolve) => {
                    try {
                        console.log('[YT Description] Starting extraction...');

                        // Find the main description container element
                        const descriptionExpander = document.getElementById('description-inline-expander');

                        if (!descriptionExpander) {
                            console.error('[YT Description] Could not find description container');
                            resolve(undefined);
                            return;
                        }

                        // Check if the description is currently collapsed
                        const isCollapsed = !descriptionExpander.hasAttribute('is-expanded');

                        // Function to extract the description text
                        const extractDescription = () => {
                            const fullDescriptionElement = descriptionExpander.querySelector('#description-inline-expander #description-inner yt-attributed-string');
                            if (fullDescriptionElement && fullDescriptionElement.textContent) {
                                const description = fullDescriptionElement.textContent.trim();
                                console.log('[YT Description] Successfully extracted description, length:', description.length);
                                return description;
                            } else {
                                console.error('[YT Description] Could not find description text element');
                                return undefined;
                            }
                        };

                        // If collapsed, expand first
                        if (isCollapsed) {
                            console.log('[YT Description] Description is collapsed, expanding...');
                            const expandButton = descriptionExpander.querySelector('#expand') as HTMLElement;

                            if (expandButton) {
                                expandButton.click();
                                // Wait for DOM to update
                                setTimeout(() => {
                                    const description = extractDescription();
                                    // Collapse back to original state
                                    const collapseButton = descriptionExpander.querySelector('#collapse') as HTMLElement;
                                    if (collapseButton) {
                                        collapseButton.click();
                                    }
                                    resolve(description);
                                }, 500);
                            } else {
                                console.error('[YT Description] Could not find expand button');
                                resolve(undefined);
                            }
                        } else {
                            // Already expanded, extract directly
                            console.log('[YT Description] Description already expanded');
                            resolve(extractDescription());
                        }
                    } catch (error) {
                        console.error('[YT Description] Error extracting description:', error);
                        resolve(undefined);
                    }
                });
            },
        });

        const description = results[0]?.result;

        if (description && typeof description === 'string') {
            log.info('✅ Video description extracted successfully', {
                descriptionLength: description.length,
            });
            return description;
        } else {
            log.warn('⚠️ Could not extract video description from page');
            return undefined;
        }
    } catch (error) {
        log.error('❌ Error getting video description:', error);
        return undefined;
    }
}


