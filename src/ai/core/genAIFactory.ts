/**
 * Gen AI Factory
 * Centralized initialization logic for @google/genai SDK
 * Used by agents that require the native Gen AI SDK (YouTube, Browser, Live API)
 * 
 * For agents using AI SDK (PDF, Suggestions), use modelFactory.ts instead
 */

import { GoogleGenAI } from '@google/genai';
import { createLogger } from '@logger';
import { APIError, ErrorType } from '../../errors/errorTypes';
import { getActiveProvider, getVertexCredentials, getGoogleApiKey } from '../../utils/providerCredentials';
import type { AIProvider } from '../../utils/providerTypes';

const log = createLogger('GenAIFactory', 'AI_CHAT');

/**
 * Initialize GoogleGenAI client respecting user's provider selection
 * - If Vertex AI configured: uses service account credentials
 * - Otherwise: uses Google AI with API key
 * 
 * @returns GoogleGenAI client instance configured for the active provider
 * @throws {APIError} If credentials are not configured or invalid
 */
export async function initializeGenAIClient(): Promise<GoogleGenAI> {
    log.info('🏭 Initializing Gen AI client');

    // Determine active provider
    let activeProvider: AIProvider;
    try {
        activeProvider = await getActiveProvider();
        log.info('🎯 Active provider determined:', activeProvider);

        // Log if both providers are configured (Vertex is preferred)
        const hasVertex = await getVertexCredentials();
        const hasGoogle = await getGoogleApiKey();
        if (hasVertex && hasGoogle) {
            log.info('ℹ️  Both Google AI and Vertex AI are configured. Using Vertex AI as default.');
        }
    } catch (error) {
        log.error('❌ No provider configured:', error);
        throw error;
    }

    if (activeProvider === 'vertex') {
        return initializeVertexClient();
    } else {
        return initializeGoogleClient();
    }
}

/**
 * Initialize GoogleGenAI client for Vertex AI
 * Uses service account credentials from settings
 * 
 * @returns GoogleGenAI client configured for Vertex AI
 * @throws {APIError} If Vertex credentials are not configured or invalid
 */
async function initializeVertexClient(): Promise<GoogleGenAI> {
    log.info('🔧 Initializing Gen AI client for Vertex AI');

    // Get Vertex credentials
    const credentials = await getVertexCredentials();
    if (!credentials) {
        const error = new APIError({
            message: 'Vertex AI credentials not configured',
            statusCode: 401,
            retryable: false,
            userMessage: 'Please configure Vertex AI credentials in settings to use this provider.',
            technicalDetails: 'No Vertex credentials found in storage',
            errorCode: ErrorType.API_AUTH_FAILED,
        });
        log.error('❌ Vertex credentials missing:', error);
        throw error;
    }

    // Validate required fields
    if (!credentials.projectId || !credentials.location || !credentials.clientEmail || !credentials.privateKey) {
        const error = new APIError({
            message: 'Incomplete Vertex AI credentials',
            statusCode: 401,
            retryable: false,
            userMessage: 'Vertex AI credentials are incomplete. Please reconfigure in settings.',
            technicalDetails: 'Missing required fields in Vertex credentials',
            errorCode: ErrorType.API_AUTH_FAILED,
        });
        log.error('❌ Incomplete Vertex credentials:', error);
        throw error;
    }

    try {
        const client = new GoogleGenAI({
            vertexai: true,
            project: credentials.projectId,
            location: credentials.location,
            // Authentication handled by google-auth-library
            // Uses service account JSON credentials
            googleAuthOptions: {
                credentials: {
                    client_email: credentials.clientEmail,
                    private_key: credentials.privateKey,
                }
            }
        });

        log.info('✅ Vertex AI Gen AI client initialized successfully:', {
            projectId: credentials.projectId,
            location: credentials.location,
        });

        return client;
    } catch (error) {
        log.error('❌ Failed to initialize Vertex AI Gen AI client:', error);
        throw new APIError({
            message: 'Failed to initialize Vertex AI',
            statusCode: 500,
            retryable: false,
            userMessage: 'Could not connect to Vertex AI. Please check your credentials.',
            technicalDetails: error instanceof Error ? error.message : String(error),
            errorCode: ErrorType.API_AUTH_FAILED,
        });
    }
}

/**
 * Initialize GoogleGenAI client for Google AI
 * Uses API key from settings
 * 
 * @returns GoogleGenAI client configured for Google AI
 * @throws {APIError} If API key is not configured or invalid
 */
async function initializeGoogleClient(): Promise<GoogleGenAI> {
    log.info('🔧 Initializing Gen AI client for Google AI');

    // Get Google API key
    const apiKey = await getGoogleApiKey();
    if (!apiKey || apiKey.trim().length === 0) {
        const error = new APIError({
            message: 'Google AI API key not configured',
            statusCode: 401,
            retryable: false,
            userMessage: 'Please configure Google AI API key in settings.',
            technicalDetails: 'No API key found in storage',
            errorCode: ErrorType.API_AUTH_FAILED,
        });
        log.error('❌ Google API key missing:', error);
        throw error;
    }

    try {
        const client = new GoogleGenAI({
            apiKey,
            // Optional: use v1 stable API instead of beta
            // apiVersion: 'v1'
        });

        log.info('✅ Google AI Gen AI client initialized successfully');

        return client;
    } catch (error) {
        log.error('❌ Failed to initialize Google AI Gen AI client:', error);
        throw new APIError({
            message: 'Failed to initialize Google AI',
            statusCode: 500,
            retryable: false,
            userMessage: 'Could not connect to Google AI. Please check your API key.',
            technicalDetails: error instanceof Error ? error.message : String(error),
            errorCode: ErrorType.API_AUTH_FAILED,
        });
    }
}

/**
 * Get appropriate model name for Live API based on provider
 * Vertex AI and Google AI use different model names for the Live API
 * 
 * @returns Model name string for the active provider's Live API
 * @throws {APIError} If no provider is configured
 */
export async function getLiveModelName(): Promise<string> {
    log.info('🎯 Determining Live API model name');

    try {
        const activeProvider = await getActiveProvider();

        // Different model names for different providers
        const modelName = activeProvider === 'vertex'
            ? 'gemini-2.5-flash'  // Vertex AI Live model
            : 'gemini-2.5-flash';        // Google AI Live model

        log.info('✅ Live API model name:', { provider: activeProvider, modelName });

        return modelName;
    } catch (error) {
        log.error('❌ Failed to determine Live API model:', error);
        throw error;
    }
}

/**
 * Get the currently active provider without initializing a client
 * Useful for UI display and logging
 * 
 * @returns Active provider or 'none' if not configured
 */
export async function getCurrentProvider(): Promise<AIProvider | 'none'> {
    try {
        return await getActiveProvider();
    } catch (error) {
        return 'none';
    }
}
