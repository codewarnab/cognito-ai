/// <reference types="vite/client" />

/**
 * WXT Environment Variables Type Definitions
 * 
 * Environment variables follow WXT convention:
 * - WXT_* prefix for extension-specific variables
 * - Accessed via import.meta.env.WXT_*
 * - ALL env var access should go through @/utils/env
 * 
 * NOTE: Gemini/Vertex API keys are NOT stored in environment variables.
 * They are stored in chrome.storage.local via the credentials system
 * (see src/utils/credentials/) and entered by users in Settings > Provider Setup.
 * 
 * @see https://wxt.dev/guide/essentials/config/environment-variables
 */

interface ImportMetaEnv {
    /**
     * ElevenLabs Worker URL for voice mode TTS proxy
     * @example "https://elevenlabs-proxy.codewarnab.workers.dev"
     */
    readonly WXT_ELEVENLABS_WORKER_URL?: string;

    /**
     * Backend API URL for AI chat, summarizer, writer, rewriter
     * @example "https://youtube-transcript-generator-five.vercel.app"
     */
    readonly WXT_BACKEND_API_URL?: string;

    /**
     * Metadata API URL for YouTube video metadata
     * @example "https://youtube-transcript-generator-five.vercel.app/metadata"
     */
    readonly WXT_METADATA_API_URL?: string;

    /**
     * Webapp URL for settings, providers, etc.
     * @example "https://cognito-ai-webapp.vercel.app"
     */
    readonly WXT_WEBAPP_URL_DEV?: string;
    readonly WXT_WEBAPP_URL_PROD?: string;

    /**
     * Transcript API URL for YouTube transcripts
     */
    readonly WXT_TRANSCRIPT_API_URL?: string;

    /**
     * Retrieve API URL for content retrieval
     */
    readonly WXT_RETRIEVE_API_URL?: string;

    /**
     * Web Search Backend API URL
     */
    readonly WXT_WEB_SEARCH_API_URL?: string;

    /**
     * Logger preset name
     */
    readonly WXT_LOG_PRESET?: string;

    /**
     * Hide local mode flag
     */
    readonly WXT_HIDE_LOCAL_MODE?: string;

    /**
     * YouTube badge prefetch flag
     */
    readonly WXT_YOUTUBE_BADGE_PREFETCH?: string;

    /**
     * Development mode flag (built-in Vite)
     */
    readonly DEV: boolean;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}


