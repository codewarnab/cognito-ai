/**
 * Model List Panel Component
 * 
 * Right panel showing models for the selected provider
 */

import React from 'react';
import { Check, Terminal, ExternalLink } from 'lucide-react';
import type { EnabledModel } from '@/utils/ai/modelSelectorUtils';
import type { AIProviderType, ProviderGroup } from '../types';

// CLI installation info
const CLI_INSTALL_INFO: Record<string, { command: string; docsUrl: string }> = {
    'cli-gemini-cli': {
        command: 'npm install -g @anthropic-ai/claude-code',
        docsUrl: 'https://ai.google.dev/gemini-api/docs/cli',
    },
    'cli-claude-code': {
        command: 'npm install -g @anthropic-ai/claude-code',
        docsUrl: 'https://docs.anthropic.com/en/docs/claude-code',
    },
    'cli-codex-cli': {
        command: 'npm install -g @openai/codex',
        docsUrl: 'https://chatgpt.com/features/codex',
    },
};

interface ModelListPanelProps {
    providerGroup: ProviderGroup | null;
    selectedModelId: string;
    selectedProvider: AIProviderType;
    isLoading: boolean;
    focusedIndex: number;
    itemRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>;
    onModelSelect: (modelId: string, provider: AIProviderType) => void;
}

// Simple model row
const ModelRow: React.FC<{
    model: EnabledModel;
    isSelected: boolean;
    isLoading: boolean;
    isFocused: boolean;
    itemRef: (el: HTMLButtonElement | null) => void;
    onSelect: () => void;
}> = ({ model, isSelected, isLoading, isFocused, itemRef, onSelect }) => {
    return (
        <button
            ref={itemRef}
            type="button"
            onClick={onSelect}
            disabled={isLoading}
            className={`group flex items-center gap-2.5 px-3 py-2 text-left transition-colors mx-1 w-[calc(100%-8px)] rounded-lg ${isSelected ? 'bg-accent' : 'hover:bg-accent/50'
                } ${isFocused ? 'bg-accent/50' : ''}`}
        >
            <div className="flex-1 min-w-0">
                <span className={`text-[12px] block truncate ${isSelected ? 'text-foreground font-medium' : 'text-foreground/80'}`}>
                    {model.name}
                </span>
                <span className="text-[10px] text-muted-foreground block truncate">
                    {model.description}
                </span>
            </div>
            {isSelected && (
                <Check size={14} className="shrink-0 text-foreground/70" />
            )}
        </button>
    );
};

// Install overlay for unavailable CLI providers
const InstallOverlay: React.FC<{ providerId: AIProviderType; providerName: string }> = ({ providerId, providerName }) => {
    const installInfo = CLI_INSTALL_INFO[providerId];
    if (!installInfo) return null;

    return (
        <div className="absolute inset-0 backdrop-blur-sm bg-background/80 flex items-center justify-center p-4">
            <div className="text-center max-w-[200px]">
                <Terminal size={20} className="mx-auto mb-2 text-muted-foreground" />
                <p className="text-[11px] text-muted-foreground mb-2">
                    {providerName} not installed
                </p>
                <code className="block text-[9px] bg-secondary rounded px-2 py-1.5 text-muted-foreground font-mono mb-2 break-all">
                    {installInfo.command}
                </code>
                <a
                    href={installInfo.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-primary hover:text-primary/80"
                    onClick={(e) => e.stopPropagation()}
                >
                    Setup docs <ExternalLink size={10} />
                </a>
            </div>
        </div>
    );
};

export const ModelListPanel: React.FC<ModelListPanelProps> = ({
    providerGroup,
    selectedModelId,
    selectedProvider,
    isLoading,
    focusedIndex,
    itemRefs,
    onModelSelect,
}) => {
    if (!providerGroup) {
        return (
            <div className="flex-1 flex items-center justify-center p-4">
                <p className="text-[11px] text-white/40">Select a provider</p>
            </div>
        );
    }

    const models = providerGroup.models;
    const providerId = providerGroup.id;
    const isUnavailable = !providerGroup.isAvailable;

    return (
        <div className="flex-1 flex flex-col min-h-0 min-w-0 relative">
            {/* Provider header */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
                <providerGroup.icon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[11px] font-medium text-muted-foreground">
                    {providerGroup.name}
                </span>
                <span className="text-[10px] text-muted-foreground/60 ml-auto">
                    {models.length}
                </span>
            </div>

            {/* Model list */}
            <div className="flex-1 overflow-y-auto mcp-scrollable">
                {models.length === 0 ? (
                    <div className="p-4 text-center">
                        <p className="text-[11px] text-white/40">No models enabled</p>
                    </div>
                ) : (
                    models.map((model, index) => {
                        const isSelected = selectedModelId === model.id && selectedProvider === providerId;
                        const isFocused = focusedIndex === index;

                        return (
                            <ModelRow
                                key={model.id}
                                model={model}
                                isSelected={isSelected}
                                isLoading={isLoading || isUnavailable}
                                isFocused={isFocused}
                                itemRef={(el) => { itemRefs.current[index] = el; }}
                                onSelect={() => onModelSelect(model.id, providerId)}
                            />
                        );
                    })
                )}
            </div>

            {/* Install overlay for unavailable CLI providers */}
            {isUnavailable && (
                <InstallOverlay providerId={providerId} providerName={providerGroup.name} />
            )}
        </div>
    );
};

export default ModelListPanel;
