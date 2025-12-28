/**
 * Stores Handler
 *
 * Handles dev tools store inspection:
 * - GET_STORES_STATE: Get current state of Zustand stores
 */

import { createLogger } from '~logger';
import type { ExternalMessage, ExternalResponse } from '@cognito/shared';
import { successResponse, errorResponse } from '../utils';

const log = createLogger('ExternalMessaging:Stores', 'BACKGROUND');

/**
 * Message types handled by this handler
 */
export const STORES_MESSAGE_TYPES = ['GET_STORES_STATE'] as const;

/**
 * Handle stores-related messages
 */
export async function handleStoresMessage(
    message: ExternalMessage,
    _sender: chrome.runtime.MessageSender
): Promise<ExternalResponse | null> {
    switch (message.type) {
        case 'GET_STORES_STATE':
            return handleGetStoresState(message.payload as { stores?: string[] });

        default:
            return null;
    }
}

/**
 * Handle GET_STORES_STATE message
 */
async function handleGetStoresState(
    payload: { stores?: string[] } | undefined
): Promise<ExternalResponse> {
    try {
        // Import stores dynamically to avoid circular dependencies
        const {
            useSettingsStore,
            useUINavigationStore,
            useModelStore,
            useChatStore,
            useAttachmentsStore,
            useToolsStore,
            useVoiceModeStore,
            useMcpStore,
        } = await import('@/stores');

        // Map of store names to store instances
        const storeMap: Record<string, { getState: () => unknown }> = {
            settings: useSettingsStore,
            uiNavigation: useUINavigationStore,
            model: useModelStore,
            chat: useChatStore,
            attachments: useAttachmentsStore,
            tools: useToolsStore,
            voiceMode: useVoiceModeStore,
            mcp: useMcpStore,
        };

        const requestedStores = payload?.stores || Object.keys(storeMap);
        const storesState: Record<string, unknown> = {};

        for (const storeName of requestedStores) {
            const store = storeMap[storeName];
            if (store) {
                try {
                    const state = store.getState();
                    // Filter out functions to make it serializable
                    const serializableState: Record<string, unknown> = {};
                    for (const [key, value] of Object.entries(
                        state as Record<string, unknown>
                    )) {
                        if (typeof value !== 'function') {
                            serializableState[key] = value;
                        }
                    }
                    storesState[storeName] = serializableState;
                } catch (e) {
                    storesState[storeName] = {
                        error: `Failed to get state: ${e}`,
                    };
                }
            }
        }

        log.info('Returning stores state for dev tools', {
            stores: Object.keys(storesState),
        });
        return successResponse(storesState);
    } catch (error) {
        log.error('Failed to get stores state', error);
        return errorResponse('Failed to get stores state');
    }
}
