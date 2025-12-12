/// <reference types="vite/client" />

/**
 * WXT Environment Variables Type Definitions
 * 
 * Environment variables follow WXT convention:
 * - WXT_* prefix for extension-specific variables
 * - Accessed via import.meta.env.WXT_*
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

    // Add more environment variables as needed during migration
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}


