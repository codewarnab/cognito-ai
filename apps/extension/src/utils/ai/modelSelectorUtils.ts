/**
 * Model Selector Utilities
 * Helpers for syncing ModelSelectorPopover with webapp provider config
 */

import type { AIProviderConfig, Model as SharedModel } from '@cognito/shared';
import { getProvidersConfig } from '@/services/providerService';

/**
 * Enabled model with provider context
 */
export interface EnabledModel {
    id: string;
    name: string;
    description: string;
    providerId: string;
    providerDisplayName: string;
}

/**
 * Map ModelSelectorPopover provider IDs to webapp config provider names
 */
export type PopoverProviderType = 'google' | 'vertex' | 'anthropic' | 'xai' | 'openai';

const POPOVER_TO_CONFIG_MAP: Record<PopoverProviderType, string> = {
    google: 'google_gemini',
    vertex: 'vertex',
    anthropic: 'anthropic',
    xai: 'xai',
    openai: 'openai',
};

const CONFIG_TO_POPOVER_MAP: Record<string, PopoverProviderType> = {
    google_gemini: 'google',
    vertex: 'vertex',
    anthropic: 'anthropic',
    xai: 'xai',
    openai: 'openai',
};

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
    google_gemini: 'Google Gemini',
    vertex: 'Vertex AI',
    anthropic: 'Anthropic Claude',
    xai: 'xAI Grok',
    openai: 'OpenAI',
};

/**
 * Convert popover provider ID to config provider name
 */
export function mapPopoverToConfig(popoverId: PopoverProviderType): string {
    return POPOVER_TO_CONFIG_MAP[popoverId] || popoverId;
}

/**
 * Convert config provider name to popover provider ID
 */
export function mapConfigToPopover(configName: string): PopoverProviderType | null {
    return CONFIG_TO_POPOVER_MAP[configName] || null;
}

/**
 * Get display name for a config provider
 */
export function getProviderDisplayName(configName: string): string {
    return PROVIDER_DISPLAY_NAMES[configName] || configName;
}

/**
 * Extract enabled models from providers config
 * Returns a flat list of all enabled models with their provider info
 */
export function getEnabledModelsFromConfig(config: AIProviderConfig): EnabledModel[] {
    if (!config?.providers) return [];

    return config.providers
        .filter(p => p.enabled)
        .flatMap(provider => {
            const models = provider.models || [];
            return models
                .filter((m: SharedModel) => m.enabled)
                .map((m: SharedModel) => ({
                    id: m.id,
                    name: m.name,
                    description: m.desc || '',
                    providerId: provider.name,
                    providerDisplayName: getProviderDisplayName(provider.name),
                }));
        });
}

/**
 * Fetch enabled models from IndexedDB storage
 * @param forceRefresh If true, clears cache before fetching to ensure fresh data
 */
export async function fetchEnabledModels(forceRefresh = false): Promise<EnabledModel[]> {
    if (forceRefresh) {
        // Clear cache for providersConfig to ensure fresh data
        const { clearSettingsCache } = await import('@/db/settings');
        clearSettingsCache(['providersConfig']);
    }
    const config = await getProvidersConfig();
    if (!config) return [];
    return getEnabledModelsFromConfig(config);
}

/**
 * Check if a specific model+provider combination is enabled
 */
export function isModelEnabled(
    enabledModels: EnabledModel[],
    modelId: string,
    popoverProviderId: PopoverProviderType
): boolean {
    const configProviderId = mapPopoverToConfig(popoverProviderId);
    return enabledModels.some(
        m => m.id === modelId && m.providerId === configProviderId
    );
}

/**
 * Get enabled providers (providers with at least one enabled model)
 */
export function getEnabledProviderIds(enabledModels: EnabledModel[]): Set<string> {
    return new Set(enabledModels.map(m => m.providerId));
}
