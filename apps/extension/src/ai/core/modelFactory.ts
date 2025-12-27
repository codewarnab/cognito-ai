/**
 * Model Factory
 * Centralized model initialization logic for all AI providers
 * Supports local (Gemini Nano), Google Generative AI, Vertex AI, and OpenAI
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createVertex } from '@ai-sdk/google-vertex';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createXai } from '@ai-sdk/xai';
import { withSupermemory } from '@supermemory/tools/ai-sdk';
import { builtInAI } from '@built-in-ai/core';
import { createLogger } from '~logger';
import { APIError, ErrorType } from '../../errors/errorTypes';
import { getActiveProvider, getVertexCredentials, getGoogleApiKey, getOpenAIApiKey, getAnthropicApiKey, getXaiApiKey } from '@/utils/credentials';
import { cognitoProviders } from '@cognito/shared';
import {
    isSupermemoryReady,
    getSupermemoryApiKey,
    getSupermemoryUserId
} from '@/utils/supermemory';
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

const log = createLogger('ModelFactory', 'AI_CHAT_SETUP');

/**
 * Wraps a model with Supermemory if configured and enabled
 * 
 * @param model - The AI model to potentially wrap
 * @returns The wrapped model if Supermemory is ready, otherwise the original model
 */
async function wrapModelWithSupermemory(model: any): Promise<any> {
    try {
        const ready = await isSupermemoryReady();
        if (!ready) {
            log.debug('Supermemory not ready, using model without memory');
            return model;
        }

        const [apiKey, userId] = await Promise.all([
            getSupermemoryApiKey(),
            getSupermemoryUserId()
        ]);

        if (!apiKey) {
            log.debug('Supermemory API key not available, using model without memory');
            return model;
        }

        log.info('🧠 Wrapping model with Supermemory', { userId });
        // @ts-ignore - apiKey is valid in recent versions but types might be stale
        return withSupermemory(model, userId, {
            apiKey,
            addMemory: 'always'
        });
    } catch (error) {
        log.warn('Failed to wrap model with Supermemory, using model without memory', {
            error: error instanceof Error ? error.message : String(error)
        });
        return model;
    }
}

/**
 * Result of model initialization
 */
export interface ModelInitResult {
    model: any;
    provider: AIProvider | 'local';
    modelName: string;
    providerInstance?: any; // Google or Vertex provider instance for accessing tools
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

    // Determine provider from model name
    let provider: AIProvider;

    // Use shared registry to find provider for model
    const foundProvider = cognitoProviders.find(p =>
        p.models?.some(m => m.id === modelName)
    );

    if (foundProvider) {
        if (foundProvider.name === 'google_gemini') {
            // Check if Vertex is configured and preferred for Gemini models
            const hasVertex = await getVertexCredentials();
            const hasGoogle = await getGoogleApiKey();

            if (hasVertex && hasGoogle) {
                log.info('ℹ️  Both Google AI and Vertex AI are configured. Using Vertex AI for Gemini model.');
                provider = 'vertex';
            } else if (hasVertex) {
                provider = 'vertex';
            } else {
                provider = 'google';
            }
        } else {
            provider = foundProvider.name as AIProvider;
        }
    } else {
        // Fallback to heuristic checks if not found in registry (e.g. legacy or new models)
        if (modelName.startsWith('gemini')) {
            const hasVertex = await getVertexCredentials();
            if (hasVertex) {
                provider = 'vertex';
            } else {
                provider = 'google';
            }
        } else if (modelName.includes('claude')) {
            provider = 'anthropic';
        } else if (modelName.includes('grok')) {
            provider = 'xai';
        } else if (modelName.startsWith('gpt')) {
            provider = 'openai';
        } else {
            // Fallback to active provider as last resort
            try {
                provider = await getActiveProvider();
                log.info('⚠️ Model provider ambiguous, falling back to active provider:', provider);
            } catch (error) {
                throw new APIError({
                    message: `Could not determine provider for model: ${modelName}`,
                    statusCode: 400,
                    retryable: false,
                    userMessage: `Could not determine which provider to use for model "${modelName}".`,
                    technicalDetails: 'Model name does not match any known provider patterns',
                    errorCode: ErrorType.API_GENERIC_ERROR,
                });
            }
        }
    }

    log.info('🚀 Using provider:', provider, 'with model:', modelName);

    // Initialize base model based on provider
    switch (provider) {
        case 'vertex':
            return await initializeVertexModel(modelName);
        case 'google':
            return await initializeGoogleModel(modelName);
        case 'openai':
            return await initializeOpenAIModel(modelName);
        case 'anthropic':
            return await initializeAnthropicModel(modelName);
        case 'xai':
            return await initializeXaiModel(modelName);
        default:
            throw new APIError({
                message: `Unsupported provider: ${provider}`,
                statusCode: 400,
                retryable: false,
                userMessage: `Provider "${provider}" is not yet supported.`,
                technicalDetails: 'Provider not implemented in modelFactory',
                errorCode: ErrorType.API_GENERIC_ERROR,
            });
    }
}

/**
 * Initialize local Gemini Nano model
 * Note: Model download is handled separately in setupLocalMode
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

        const model = await wrapModelWithSupermemory(vertex(modelName));

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
        const model = await wrapModelWithSupermemory(google(modelName));

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
 * Initialize OpenAI model with API key
 * 
 * @param modelName - OpenAI model name (e.g., 'gpt-5', 'gpt-5-mini', 'gpt-4.1')
 * @returns Model initialization result for OpenAI
 * @throws {APIError} If API key is not configured or invalid
 */
async function initializeOpenAIModel(modelName: string): Promise<ModelInitResult> {
    log.info('🔧 Initializing OpenAI model:', modelName);

    // Get OpenAI API key
    const apiKey = await getOpenAIApiKey();
    if (!apiKey) {
        const error = new APIError({
            message: 'OpenAI API key not configured',
            statusCode: 401,
            retryable: false,
            userMessage: 'Please configure your OpenAI API key in settings.',
            technicalDetails: 'No OpenAI API key found in storage',
            errorCode: ErrorType.API_AUTH_FAILED,
        });
        log.error('❌ OpenAI API key missing:', error);
        throw error;
    }

    try {
        // Create OpenAI client
        const openai = createOpenAI({
            apiKey,
        });
        const model = await wrapModelWithSupermemory(openai(modelName));

        log.info('✅ OpenAI model initialized successfully:', modelName);

        return {
            model,
            provider: 'openai',
            modelName,
            providerInstance: openai, // Return provider instance for tool access
        };
    } catch (error) {
        log.error('❌ Failed to initialize OpenAI model:', error);
        throw new APIError({
            message: 'Failed to initialize OpenAI',
            statusCode: 500,
            retryable: false,
            userMessage: 'Could not initialize OpenAI. Please verify your API key and try again.',
            technicalDetails: error instanceof Error ? error.message : String(error),
            errorCode: ErrorType.API_AUTH_FAILED,
        });
    }
}

/**
 * Initialize Anthropic model with API key
 * 
 * Features:
 * - Prompt caching for cost efficiency (cache_control with ephemeral type)
 * - Full streaming and tool calling support
 * - Supermemory integration
 * 
 * @param modelName - Anthropic model name (e.g., 'claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4-5')
 * @returns Model initialization result for Anthropic
 * @throws {APIError} If API key is not configured or invalid
 * 
 * @see https://platform.claude.com/docs/en/build-with-claude/prompt-caching
 */
async function initializeAnthropicModel(modelName: string): Promise<ModelInitResult> {
    log.info('🔧 Initializing Anthropic model:', modelName);

    // Get Anthropic API key
    const apiKey = await getAnthropicApiKey();
    if (!apiKey) {
        const error = new APIError({
            message: 'Anthropic API key not configured',
            statusCode: 401,
            retryable: false,
            userMessage: 'Please configure your Anthropic API key in settings.',
            technicalDetails: 'No Anthropic API key found in storage',
            errorCode: ErrorType.API_AUTH_FAILED,
        });
        log.error('❌ Anthropic API key missing:', error);
        throw error;
    }

    try {
        // Create Anthropic client with prompt caching enabled
        // The AI SDK Anthropic provider automatically handles:
        // - Prompt caching via cacheControl: 'ephemeral' on messages
        // - The anthropic-beta header for extended caching
        const anthropic = createAnthropic({
            apiKey,
        });

        // Create model with prompt caching enabled for cost efficiency
        // Prompt caching reduces costs by caching large system prompts and context
        const model = await wrapModelWithSupermemory(
            anthropic(modelName)
        );

        log.info('✅ Anthropic model initialized successfully:', {
            modelName,
            cacheControlEnabled: true,
        });

        return {
            model,
            provider: 'anthropic',
            modelName,
            providerInstance: anthropic, // Return provider instance for tool access (e.g., web search)
        };
    } catch (error) {
        log.error('❌ Failed to initialize Anthropic model:', error);
        throw new APIError({
            message: 'Failed to initialize Anthropic',
            statusCode: 500,
            retryable: false,
            userMessage: 'Could not initialize Anthropic. Please verify your API key and try again.',
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
        } else if (provider === 'vertex') {
            const credentials = await getVertexCredentials();
            return !!credentials &&
                !!credentials.projectId &&
                !!credentials.clientEmail &&
                !!credentials.privateKey;
        } else if (provider === 'openai') {
            const apiKey = await getOpenAIApiKey();
            return !!apiKey && apiKey.trim().length > 0;
        } else if (provider === 'anthropic') {
            const apiKey = await getAnthropicApiKey();
            return !!apiKey && apiKey.trim().length > 0;
        } else if (provider === 'xai') {
            const apiKey = await getXaiApiKey();
            return !!apiKey && apiKey.trim().length > 0;
        }
        return false;
    } catch (error) {
        log.error('Error checking provider availability:', error);
        return false;
    }
}

/**
 * Initialize xAI model with API key
 * 
 * @param modelName - xAI model name (e.g., 'grok-2-1212', 'grok-2-vision-1212')
 * @returns Model initialization result for xAI
 * @throws {APIError} If API key is not configured or invalid
 */
async function initializeXaiModel(modelName: string): Promise<ModelInitResult> {
    log.info('🔧 Initializing xAI model:', modelName);

    // Get xAI API key
    const apiKey = await getXaiApiKey();
    if (!apiKey) {
        const error = new APIError({
            message: 'xAI API key not configured',
            statusCode: 401,
            retryable: false,
            userMessage: 'Please configure your xAI API key in settings.',
            technicalDetails: 'No xAI API key found in storage',
            errorCode: ErrorType.API_AUTH_FAILED,
        });
        log.error('❌ xAI API key missing:', error);
        throw error;
    }

    try {
        // Create xAI client
        const xai = createXai({
            apiKey,
        });

        const model = await wrapModelWithSupermemory(xai(modelName));

        log.info('✅ xAI model initialized successfully:', modelName);

        return {
            model,
            provider: 'xai',
            modelName,
            providerInstance: xai, // Return provider instance for tool access
        };
    } catch (error) {
        log.error('❌ Failed to initialize xAI model:', error);
        throw new APIError({
            message: 'Failed to initialize xAI',
            statusCode: 500,
            retryable: false,
            userMessage: 'Could not initialize xAI. Please verify your API key and try again.',
            technicalDetails: error instanceof Error ? error.message : String(error),
            errorCode: ErrorType.API_AUTH_FAILED,
        });
    }
}

