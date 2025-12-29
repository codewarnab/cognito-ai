/**
 * Environment Variable Module
 * 
 * Provides centralized access to WXT environment variables with defaults.
 * ALL environment variable access in the extension should go through this file.
 * 
 * NOTE: API keys for AI providers (Gemini, Vertex) are NOT environment
 * variables. They are stored in chrome.storage.local via the credentials
 * system and configured by users in Settings > Provider Setup.
 * See: src/utils/credentials/providerCredentials.ts
 * 
 * @see https://wxt.dev/guide/essentials/config/environment-variables
 */

import { LOG_PRESETS as _LOG_PRESETS } from '@cognito/shared';

/**
 * Environment Variables
 * 
 * Usage:
 * ```typescript
 * import { ENV } from '@/utils/env';
 * 
 * const workerUrl = ENV.ELEVENLABS_WORKER_URL;
 * ```
 */
export const ENV = {
    /**
     * ElevenLabs Worker URL for TTS proxy
     */
    ELEVENLABS_WORKER_URL: import.meta.env.WXT_ELEVENLABS_WORKER_URL ,
    /**
     * Backend API URL for AI chat, summarizer, writer, rewriter
     */
    BACKEND_API_URL: import.meta.env.WXT_BACKEND_API_URL ,
    /**
     * Metadata API URL for YouTube video metadata
     */
    METADATA_API_URL: import.meta.env.WXT_METADATA_API_URL ,
    /**
     * Webapp URL for settings, providers, etc.
     */
    WEBAPP_URL_DEV: import.meta.env.WXT_WEBAPP_URL_DEV || 'http://localhost:3002',
    WEBAPP_URL_PROD: import.meta.env.WXT_WEBAPP_URL_PROD || 'https://cognito-ai-one.vercel.app',
    /**
     * Transcript API URL for YouTube transcripts
     */
    TRANSCRIPT_API_URL: import.meta.env.WXT_TRANSCRIPT_API_URL ,
    /**
     * Retrieve API URL for content retrieval
     */
    RETRIEVE_API_URL: import.meta.env.WXT_RETRIEVE_API_URL ,
    /**
     * Web Search Backend API URL
     * Used when WEB_SEARCH_SELF_API_KEY_HIDDEN is enabled to proxy requests through the backend
     */
    WEB_SEARCH_API_URL: import.meta.env.WXT_WEB_SEARCH_API_URL ,
    /**
     * Logger preset name for configuring log levels
     * @deprecated LOG_CONFIG is deprecated. Logger configuration is now dynamic.
     */
    LOG_PRESET: import.meta.env.WXT_LOG_PRESET as keyof typeof _LOG_PRESETS | undefined,
    /**
     * Hide Local Mode Configuration
     * When enabled, forces the extension to use remote/cloud mode only.
     * This hides the mode selector UI and requires users to have an API key.
     */
    HIDE_LOCAL_MODE: import.meta.env.WXT_HIDE_LOCAL_MODE !== 'false',
    /**
     * YouTube Badge Prefetch Configuration
     * Controls whether YouTube transcripts are prefetched in the background
     * when a YouTube video is detected, or fetched on-demand when user clicks the badge.
     * 
     * - true: Prefetch transcript immediately when video detected (current behavior)
     * - false: Fetch transcript only when user clicks the badge CTA
     */
    YOUTUBE_BADGE_PREFETCH_ENABLED: import.meta.env.WXT_YOUTUBE_BADGE_PREFETCH !== 'false',
    /**
     * Development mode flag
     */
    DEV: import.meta.env.DEV,
} as const;

/**
 * Type for accessing ENV keys
 */
export type EnvKey = keyof typeof ENV;
