/**
 * Browser Hooks
 *
 * Hooks for Chrome browser and tab interactions including:
 * - Active tab detection and context
 * - YouTube video page detection
 * - Local PDF file detection
 *
 * @example
 * import { useTabContext, useActiveTabDetection } from '@/hooks/browser';
 */

export { useActiveTabDetection } from './useActiveTabDetection';
export type { LocalPdfInfo, ActiveTabDetection } from './useActiveTabDetection';

export { useTabContext } from './useTabContext';

export { useYouTubeVideoDetection } from './useYouTubeVideoDetection';
export type { YouTubeVideoInfo, YouTubeVideoDetection } from './useYouTubeVideoDetection';
