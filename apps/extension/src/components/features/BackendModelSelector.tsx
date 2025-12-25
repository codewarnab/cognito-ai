
import { useSettingsStore } from '@/stores/settings/settingsStore';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface BackendModelSelectorProps {
    className?: string;
}

const formatProviderName = (name: string) => {
    const map: Record<string, string> = {
        openai: 'OpenAI',
        anthropic: 'Anthropic',
        google_gemini: 'Google Gemini',
        vertex: 'Vertex AI',
        xai: 'xAI (Grok)',
        deepseek: 'DeepSeek',
        groq: 'Groq',
        ollama: 'Ollama',
    };
    return map[name] || name.charAt(0).toUpperCase() + name.slice(1);
};

export function BackendModelSelector({ className }: BackendModelSelectorProps) {
    const useBackendMode = useSettingsStore((s) => s.useBackendMode);
    const backendModel = useSettingsStore((s) => s.backendModel);
    const setBackendModel = useSettingsStore((s) => s.setBackendModel);
    const providersConfig = useSettingsStore((s) => s.providersConfig);

    // Don't show if not in backend mode
    if (!useBackendMode) return null;

    const groupedModels = useMemo(() => {
        if (!providersConfig?.providers) return [];

        return providersConfig.providers
            .filter(p => p.enabled)
            .map(p => ({
                providerName: p.name,
                label: formatProviderName(p.name),
                models: (p.models || []).filter(m => m.enabled)
            }))
            .filter(group => group.models.length > 0);
    }, [providersConfig]);

    // Fallback if no providers configured
    if (groupedModels.length === 0) {
        return (
            <div className={cn('space-y-2', className)}>
                <label className="text-xs font-medium text-muted-foreground">
                    Backend Model
                </label>
                <div className="text-xs text-destructive">
                    No active providers found. Please configure providers in settings.
                </div>
            </div>
        );
    }

    return (
        <div className={cn('space-y-2', className)}>
            <label className="text-xs font-medium text-muted-foreground">
                Backend Model
            </label>
            <select
                value={backendModel}
                onChange={(e) => setBackendModel(e.target.value)}
                className="w-full px-2 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            >
                {groupedModels.map((group) => (
                    <optgroup key={group.providerName} label={group.label}>
                        {group.models.map((model) => (
                            <option key={`${group.providerName}:${model.id}`} value={`${group.providerName}:${model.id}`}>
                                {model.name}
                            </option>
                        ))}
                    </optgroup>
                ))}
            </select>
        </div>
    );
}

/**
 * Compact model selector for toolbar/dropdown use
 */
export function BackendModelSelectorCompact({ className }: BackendModelSelectorProps) {
    const useBackendMode = useSettingsStore((s) => s.useBackendMode);
    const backendModel = useSettingsStore((s) => s.backendModel);
    const setBackendModel = useSettingsStore((s) => s.setBackendModel);
    const providersConfig = useSettingsStore((s) => s.providersConfig);

    if (!useBackendMode) return null;

    const groupedModels = useMemo(() => {
        if (!providersConfig?.providers) return [];
        return providersConfig.providers
            .filter(p => p.enabled)
            .map(p => ({
                providerName: p.name,
                models: (p.models || []).filter(m => m.enabled)
            }))
            .filter(group => group.models.length > 0);
    }, [providersConfig]);

    return (
        <select
            value={backendModel}
            onChange={(e) => setBackendModel(e.target.value)}
            className={cn(
                'px-2 py-1 text-xs bg-transparent border-none focus:outline-none cursor-pointer max-w-[150px] truncate',
                className
            )}
            title="Select backend model"
        >
            {groupedModels.map((group) => (
                <optgroup key={group.providerName} label={formatProviderName(group.providerName)}>
                    {group.models.map((model) => (
                        <option key={`${group.providerName}:${model.id}`} value={`${group.providerName}:${model.id}`}>
                            {model.name}
                        </option>
                    ))}
                </optgroup>
            ))}
        </select>
    );
}

