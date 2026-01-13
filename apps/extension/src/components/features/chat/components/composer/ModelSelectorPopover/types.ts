/**
 * Types and interfaces for Model Selector Popover
 */

import type { EnabledModel } from '@/utils/ai/modelSelectorUtils';

/** Supported AI providers for display */
export type AIProviderType =
    // Cloud providers
    | 'google'
    | 'vertex'
    | 'anthropic'
    | 'xai'
    | 'openai'
    // CLI bridge providers
    | 'cli-gemini-cli'
    | 'cli-claude-code'
    | 'cli-codex-cli';

export interface ProviderInfo {
    id: AIProviderType;
    configName: string; // Name in providersConfig (e.g., 'google_gemini')
    name: string;
    icon: React.FC<React.SVGProps<SVGSVGElement>>;
    color: string;
}

export interface ProviderGroup extends ProviderInfo {
    models: EnabledModel[];
    isAvailable: boolean; // For CLI providers: whether the agent is installed/available
}

export interface ModelSelectorPopoverProps {
    className?: string;
    isOpen?: boolean;
    onOpenChange?: (isOpen: boolean) => void;
}

export interface VisibleItem {
    type: 'provider' | 'model';
    id: string;
    providerId: string;
    data: ProviderInfo | EnabledModel;
}
