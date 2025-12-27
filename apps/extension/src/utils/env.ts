/**
 * Environment Variable Module
 * 
 * Provides centralized access to WXT environment variables with defaults.
 * 
 * NOTE: API keys for AI providers (Gemini, Vertex) are NOT environment
 * variables. They are stored in chrome.storage.local via the credentials
 * system and configured by users in Settings > Provider Setup.
 * See: src/utils/credentials/providerCredentials.ts
 * 
 * @see https://wxt.dev/guide/essentials/config/environment-variables
 */

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
    ELEVENLABS_WORKER_URL: import.meta.env.WXT_ELEVENLABS_WORKER_URL || 'https://elevenlabs-proxy.codewarnab.workers.dev',
    /**
     * Backend API URL for AI chat, summarizer, writer, rewriter
     */
    BACKEND_API_URL: import.meta.env.WXT_BACKEND_API_URL || 'https://youtube-transcript-generator-five.vercel.app',
    /**
     * Metadata API URL for YouTube video metadata
     */
    /**
     * Metadata API URL for YouTube video metadata
     */
    METADATA_API_URL: import.meta.env.WXT_METADATA_API_URL || 'https://youtube-transcript-generator-five.vercel.app/metadata',
    /**
     * Webapp URL for settings, providers, etc.
     */
    WEBAPP_URL: import.meta.env.WXT_WEBAPP_URL || (import.meta.env.DEV ? 'http://localhost:3002' : 'https://cognito-ai-webapp.vercel.app'),
} as const;

/**
 * Type for accessing ENV keys
 */
export type EnvKey = keyof typeof ENV;
