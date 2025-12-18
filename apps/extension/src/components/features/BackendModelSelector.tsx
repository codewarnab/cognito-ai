/**
 * Backend Model Selector
 *
 * Allows users to select which model to use in backend mode.
 */

import { useSettingsStore } from '@/stores/settings/settingsStore';
import { BACKEND_MODEL_OPTIONS, type BackendModel } from '@/stores/settings/types';
import { cn } from '@/lib/utils';

interface BackendModelSelectorProps {
    className?: string;
}

export function BackendModelSelector({ className }: BackendModelSelectorProps) {
    const useBackendMode = useSettingsStore((s) => s.useBackendMode);
    const backendModel = useSettingsStore((s) => s.backendModel);
    const setBackendModel = useSettingsStore((s) => s.setBackendModel);

    // Don't show if not in backend mode
    if (!useBackendMode) return null;

    return (
        <div className={cn('space-y-2', className)}>
            <label className="text-xs font-medium text-muted-foreground">
                Backend Model
            </label>
            <select
                value={backendModel}
                onChange={(e) => setBackendModel(e.target.value as BackendModel)}
                className="w-full px-2 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            >
                {BACKEND_MODEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label} - {option.description}
                    </option>
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

    if (!useBackendMode) return null;

    const currentOption = BACKEND_MODEL_OPTIONS.find((o) => o.value === backendModel);

    return (
        <select
            value={backendModel}
            onChange={(e) => setBackendModel(e.target.value as BackendModel)}
            className={cn(
                'px-2 py-1 text-xs bg-transparent border-none focus:outline-none cursor-pointer',
                className
            )}
            title="Select backend model"
        >
            {BACKEND_MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}
