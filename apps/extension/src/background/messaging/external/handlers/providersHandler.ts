/**
 * Providers Handler
 *
 * Handles provider configuration-related external messages:
 * - GET_PROVIDER_CONFIG: Legacy - get provider config
 * - SET_PROVIDER_CONFIG: Legacy - set provider config (deprecated)
 * - CLEAR_PROVIDER_CONFIG: Legacy - clear provider config (deprecated)
 * - GET_PROVIDERS_CONFIG: Get all providers configuration
 * - SET_PROVIDERS_CONFIG: Set providers configuration
 * - TEST_PROVIDER_CONNECTION: Test a provider's API connection
 */

import { createLogger } from '~logger';
import type {
    ExternalMessage,
    ExternalResponse,
    GetProviderConfigResponse,
    GetProvidersConfigResponse,
    SetProvidersConfigPayload,
    TestProviderConnectionPayload,
} from '@cognito/shared';
import {
    getProvidersConfig,
    setProvidersConfig,
    testProviderConnection,
} from '@/services/providerService';
import { hasGoogleApiKey, hasVertexCredentials } from '@/utils/credentials';
import { getModelConfig } from '@/utils/ai/modelSettings';
import { successResponse, errorResponse } from '../utils';

const log = createLogger('ExternalMessaging:Providers', 'BACKGROUND');

/**
 * Message types handled by this handler
 */
export const PROVIDER_MESSAGE_TYPES = [
    'GET_PROVIDER_CONFIG',
    'SET_PROVIDER_CONFIG',
    'CLEAR_PROVIDER_CONFIG',
    'GET_PROVIDERS_CONFIG',
    'SET_PROVIDERS_CONFIG',
    'TEST_PROVIDER_CONNECTION',
] as const;

/**
 * Handle provider-related messages
 */
export async function handleProviderMessage(
    message: ExternalMessage,
    _sender: chrome.runtime.MessageSender
): Promise<ExternalResponse | null> {
    switch (message.type) {
        case 'GET_PROVIDER_CONFIG':
            return handleGetProviderConfig();

        case 'SET_PROVIDER_CONFIG':
            return handleSetProviderConfigLegacy();

        case 'CLEAR_PROVIDER_CONFIG':
            return handleClearProviderConfigLegacy();

        case 'GET_PROVIDERS_CONFIG':
            return handleGetProvidersConfig();

        case 'SET_PROVIDERS_CONFIG':
            return handleSetProvidersConfig(
                message.payload as SetProvidersConfigPayload
            );

        case 'TEST_PROVIDER_CONNECTION':
            return handleTestProviderConnection(
                message.payload as TestProviderConnectionPayload
            );

        default:
            return null;
    }
}

/**
 * Handle GET_PROVIDER_CONFIG message (legacy)
 */
async function handleGetProviderConfig(): Promise<ExternalResponse> {
    try {
        const hasGoogle = await hasGoogleApiKey();
        const hasVertex = await hasVertexCredentials();

        const response: GetProviderConfigResponse = {
            config: null, // Legacy config no longer used
            hasGoogle,
            hasVertex,
        };

        return successResponse(response);
    } catch (error) {
        log.error('Failed to get provider config', error);
        return errorResponse(
            error instanceof Error
                ? error.message
                : 'Failed to get provider config'
        );
    }
}

/**
 * Handle SET_PROVIDER_CONFIG message (deprecated)
 */
function handleSetProviderConfigLegacy(): ExternalResponse {
    log.warn(
        'SET_PROVIDER_CONFIG is deprecated. Use SET_PROVIDERS_CONFIG instead.'
    );
    return errorResponse(
        'This endpoint is deprecated. Use SET_PROVIDERS_CONFIG.'
    );
}

/**
 * Handle CLEAR_PROVIDER_CONFIG message (deprecated)
 */
function handleClearProviderConfigLegacy(): ExternalResponse {
    log.warn(
        'CLEAR_PROVIDER_CONFIG is deprecated. Use SET_PROVIDERS_CONFIG instead.'
    );
    return errorResponse(
        'This endpoint is deprecated. Use SET_PROVIDERS_CONFIG.'
    );
}

/**
 * Handle GET_PROVIDERS_CONFIG message
 */
async function handleGetProvidersConfig(): Promise<ExternalResponse> {
    try {
        const config = await getProvidersConfig();
        // Get currently selected model using utility to handle defaults
        const ai_model_config = await getModelConfig();

        // Default provider to google_gemini if not set or if google (matching ModelSelectorPopover logic)
        let selectedProvider = ai_model_config.remoteProvider;
        if (!selectedProvider || selectedProvider === 'google') {
            selectedProvider = 'google_gemini'; // Webapp uses google_gemini
        }

        const response: GetProvidersConfigResponse = {
            config: config || { providers: [], custom_providers: [] },
            selectedModel: ai_model_config.remoteModel,
            selectedProvider: selectedProvider,
        };
        return successResponse(response);
    } catch (error) {
        log.error('Failed to get providers config', error);
        return errorResponse('Failed to get providers config');
    }
}

/**
 * Handle SET_PROVIDERS_CONFIG message
 */
async function handleSetProvidersConfig(
    payload: SetProvidersConfigPayload | undefined
): Promise<ExternalResponse> {
    try {
        if (!payload) {
            return errorResponse('Missing payload');
        }

        await setProvidersConfig(payload);
        return successResponse();
    } catch (error) {
        log.error('Failed to set providers config', error);
        return errorResponse('Failed to set providers config');
    }
}

/**
 * Handle TEST_PROVIDER_CONNECTION message
 */
async function handleTestProviderConnection(
    payload: TestProviderConnectionPayload | undefined
): Promise<ExternalResponse> {
    try {
        if (!payload || !payload.provider) {
            return errorResponse('Missing payload or provider');
        }

        const result = await testProviderConnection(payload);

        if (result.success) {
            return successResponse();
        } else {
            return errorResponse(result.error || 'Connection test failed');
        }
    } catch (error) {
        log.error('Failed to test provider connection', error);
        return errorResponse('Failed to test provider connection');
    }
}
