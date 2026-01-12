/**
 * Constants for Model Selector Popover
 */

import { Gemini } from '@assets/brands/integrations/Gemini';
import { ClaudeAI } from '@assets/brands/integrations/ClaudeAI';
import { Grok } from '@assets/brands/integrations/Grok';
import { OpenAI } from '@assets/brands/integrations/OpenAI';
import { VertexAI } from '@assets/brands/integrations/VertexAI';
import type { ProviderInfo, AIProviderType } from './types';

/**
 * Provider display info with mapping to config names
 */
export const PROVIDERS: ProviderInfo[] = [
    {
        id: 'google',
        configName: 'google_gemini',
        name: 'Google Gemini',
        icon: Gemini,
        color: '#4285F4',
    },
    {
        id: 'vertex',
        configName: 'vertex',
        name: 'Vertex AI',
        icon: VertexAI,
        color: '#FBBC04',
    },
    {
        id: 'anthropic',
        configName: 'anthropic',
        name: 'Anthropic Claude',
        icon: ClaudeAI,
        color: '#D97757',
    },
    {
        id: 'xai',
        configName: 'xai',
        name: 'xAI Grok',
        icon: Grok,
        color: '#FFFFFF',
    },
    {
        id: 'openai',
        configName: 'openai',
        name: 'OpenAI',
        icon: OpenAI,
        color: '#10A37F',
    },
];

/**
 * Map config provider names to popover provider IDs
 */
export const CONFIG_TO_POPOVER: Record<string, AIProviderType> = {
    google_gemini: 'google',
    vertex: 'vertex',
    anthropic: 'anthropic',
    xai: 'xai',
    openai: 'openai',
};
