/**
 * YouTube to Notion Actions
 * Exports all YouTube to Notion related tools
 */

import { useYouTubeToNotionAgent } from './useYoutubeToNotionAgent';

/**
 * Register all YouTube to Notion actions
 */
export function registerYouTubeToNotionActions() {
    // This will be called by the main registerAll function
    useYouTubeToNotionAgent();
}

// Re-export for direct use if needed
export { useYouTubeToNotionAgent };
