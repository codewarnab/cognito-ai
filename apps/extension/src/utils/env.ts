/**
 * Environment Variable Compatibility Layer
 * 
 * This module provides a unified way to access environment variables
 * during the Plasmo to WXT migration. It checks WXT variables first,
 * then falls back to Plasmo variables, then to default values.
 * 
 * After migration is complete (Phase 12), this can be simplified to
 * only use import.meta.env.WXT_* variables.
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
} as const;

/**
 * Type for accessing ENV keys
 */
export type EnvKey = keyof typeof ENV;
