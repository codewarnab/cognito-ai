/**
 * Model Factory
 * Centralized model initialization logic for all AI providers
 * Supports local (Gemini Nano), Google Generative AI, and Vertex AI
 * Optionally wraps models with Supermemory for persistent user memory
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createVertex } from '@ai-sdk/google-vertex';
import { builtInAI } from '@built-in-ai/core';
import { withSupermemory } from '@supermemory/tools/ai-sdk';
import { createLogger } from '~logger';
import { APIError, ErrorType } from '../../errors/errorTypes';
import { getActiveProvider, getVertexCredentials, getGoogleApiKey } from '@/utils/credentials';
import { getSupermemoryUserId, getSupermemoryApiKey, isSupermemoryReady } from '@/utils/supermemory';
import { customFetch } from '../utils/fetchHelpers';
import type { AIMode } from '../types/types';
import type { AIProvider } from '@/utils/credentials';

// TODO(@ui): when we add more than a couple of providers, update ProviderSetup to use a searchable combo-box instead of simple radio buttons so the selection stays manageable.

// Helper function for compatibility
async function validateAndGetApiKey(): Promise<string> {
    const apiKey = await getGoogleApiKey();
    if (!apiKey) {
        throw new APIError({
            message: 'No API key configured',
            statusCode: 401,
            retryable: false,
            userMessage: 'Please configure your Google AI API key in settings.',
            technicalDetails: 'No API key found in storage',
            errorCode: ErrorType.API_AUTH_FAILED,
        });
    }
    return apiKey;
}

const log = createLogger('ModelFactory', 'AI_CHAT');

/**
 * Result of model initialization
 */
export interface ModelInitResult {
    model: any;
    provider: AIProvider | 'local';
    modelName: string;
    providerInstance?: any; // Google or Vertex provider instance for accessing tools
    supermemoryEnabled?: boolean; // Whether Supermemory wrapper is active
}

/**
 * Initialize AI model based on mode and configuration
 * 
 * @param modelName - Model name to initialize (e.g., 'gemini-2.5-flash')
 * @param mode - AI mode ('local' or 'remote')
 * @returns Model initialization result with model instance, provider, and model name
 * @throws {APIError} If credentials are not configured or invalid
 */
export async function initializeModel(
    modelName: string,
    mode: AIMode
): Promise<ModelInitResult> {
    log.info('🏭 Initializing model:', { modelName, mode });

    if (mode === 'local') {
        return initializeLocalModel();
    }

    // Determine provider (Vertex if both configured)
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

    log.info('🚀 Using provider:', activeProvider, 'with model:', modelName);

    // Initialize base model
    let result: ModelInitResult;
    if (activeProvider === 'vertex') {
        result = await initializeVertexModel(modelName);
    } else {
        result = await initializeGoogleModel(modelName);
    }

    // Wrap with Supermemory if enabled (remote mode only)
    result = await wrapWithSupermemoryIfEnabled(result);

    return result;
}

/**
 * Wrap model with Supermemory middleware if enabled
 * Provides automatic user profile injection and personalization
 * 
 * @param result - Model initialization result to wrap
 * @returns Updated result with Supermemory wrapper if enabled
 */
async function wrapWithSupermemoryIfEnabled(result: ModelInitResult): Promise<ModelInitResult> {
    try {
        const smReady = await isSupermemoryReady();

        if (!smReady) {
            log.debug('🧠 Supermemory not ready, skipping wrapper');
            return { ...result, supermemoryEnabled: false };
        }

        const smApiKey = await getSupermemoryApiKey();
        const userId = await getSupermemoryUserId();

        if (!smApiKey || !userId) {
            log.warn('🧠 Supermemory ready but missing credentials');
            return { ...result, supermemoryEnabled: false };
        }

        // Wrap the model with Supermemory middleware
        // This automatically injects user profile context into every request
        const wrappedModel = withSupermemory(result.model, userId, {
            mode: 'full', // Use profile mode for automatic context injection
            verbose: false,  // Set to true for debugging
        });

        log.info('🧠 Supermemory wrapper applied:', {
            userId: userId.substring(0, 8) + '...',
            provider: result.provider,
            modelName: result.modelName,
        });

        return {
            ...result,
            model: wrappedModel,
            supermemoryEnabled: true,
        };
    } catch (error) {
        log.error('🧠 Failed to apply Supermemory wrapper:', error);
        // Return original model without wrapper on error
        return { ...result, supermemoryEnabled: false };
    }
}

/**
 * Initialize local Gemini Nano model
 * Note: Model download is handled separately in setupLocalMode
 * Note: Supermemory is NOT available in local mode
 * 
 * @returns Model initialization result for local model
 */
async function initializeLocalModel(): Promise<ModelInitResult> {
    log.info('🔧 Initializing local Gemini Nano model');

    const model = builtInAI();

    return {
        model,
        provider: 'local',
        modelName: 'gemini-nano',
        supermemoryEnabled: false, // Supermemory not available in local mode
    };
}

/**
 * Initialize Vertex AI model with service account credentials
 * 
 * @param modelName - Vertex model name (e.g., 'gemini-2.5-flash', 'gemini-2.5-pro')
 * @returns Model initialization result for Vertex AI
 * @throws {APIError} If credentials are not configured or invalid
 */
async function initializeVertexModel(modelName: string): Promise<ModelInitResult> {
    log.info('🔧 Initializing Vertex AI model:', modelName);

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

    // Create Vertex AI client
    try {
        const vertex = createVertex({
            project: credentials.projectId,
            location: credentials.location,
            googleAuthOptions: {
                credentials: {
                    client_email: credentials.clientEmail,
                    private_key: credentials.privateKey,
                }
            },
        });

        const model = vertex(modelName);

        log.info('✅ Vertex AI model initialized successfully:', {
            modelName,
            projectId: credentials.projectId,
            location: credentials.location,
        });

        return {
            model,
            provider: 'vertex',
            modelName,
            providerInstance: vertex, // Return provider instance for tool access
        };
    } catch (error) {
        log.error('❌ Failed to initialize Vertex AI model:', error);
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
 * Initialize Google Generative AI model with API key
 * 
 * @param modelName - Google AI model name (e.g., 'gemini-2.5-flash', 'gemini-2.5-pro')
 * @returns Model initialization result for Google Generative AI
 * @throws {APIError} If API key is not configured or invalid
 */
async function initializeGoogleModel(modelName: string): Promise<ModelInitResult> {
    log.info('🔧 Initializing Google Generative AI model:', modelName);

    // Validate and get API key (throws APIError if invalid)
    const apiKey = await validateAndGetApiKey();

    try {
        // Create Google Generative AI client with custom fetch
        const google = createGoogleGenerativeAI({
            apiKey,
            fetch: customFetch
        });
        const model = google(modelName);

        log.info('✅ Google Generative AI model initialized successfully:', modelName);

        return {
            model,
            provider: 'google',
            modelName,
            providerInstance: google, // Return provider instance for tool access
        };
    } catch (error) {
        log.error('❌ Failed to initialize Google Generative AI model:', error);
        throw new APIError({
            message: 'Failed to initialize Google Generative AI',
            statusCode: 500,
            retryable: false,
            userMessage: 'Could not initialize Google AI. Please verify your API key and try again.',
            technicalDetails: error instanceof Error ? error.message : String(error),
            errorCode: ErrorType.API_AUTH_FAILED,
        });
    }
}

/**
 * Get the currently active provider without initializing a model
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

/**
 * Check if a provider is configured and available
 * 
 * @param provider - Provider to check ('google' or 'vertex')
 * @returns true if provider is configured with valid credentials
 */
export async function isProviderAvailable(provider: AIProvider): Promise<boolean> {
    try {
        if (provider === 'google') {
            const apiKey = await getGoogleApiKey();
            return !!apiKey && apiKey.trim().length > 0;
        } else {
            const credentials = await getVertexCredentials();
            return !!credentials &&
                !!credentials.projectId &&
                !!credentials.clientEmail &&
                !!credentials.privateKey;
        }
    } catch (error) {
        log.error('Error checking provider availability:', error);
        return false;
    }
}

