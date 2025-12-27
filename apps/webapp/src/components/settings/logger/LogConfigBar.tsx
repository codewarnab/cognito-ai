'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { ChevronDown, AlertTriangle, Filter, Check, RotateCcw } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLoggerConfig } from '@/hooks/useLoggerConfig';
import type { LogCategory, LoggerPresetName } from '@cognito/shared';
import { LOGGER_PRESET_NAMES, LOGGER_CATEGORY_GROUPS, LOGGER_GROUP_LABELS } from '@cognito/shared';
import { cn } from '@/lib/utils';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

// Preset descriptions for tooltips
const PRESET_DESCRIPTIONS: Record<LoggerPresetName, string> = {
    DEVELOPMENT: 'Standard dev logging: AI, Tools, UI, Memory, Settings',
    DEBUG_MCP: 'Focus on MCP client, tools, and execution logs',
    DEBUG_VOICE: 'Voice recording, client, UI, and audio logs',
    DEBUG_TOOLS: 'Tools registry, execution, validation, and integration',
    DEBUG_SANDBOX: 'Background, tools, and browser automation logs',
    DEBUG_WORKFLOW: 'Workflow automation and browser action logs',
    PRODUCTION: 'Minimal logging: errors only',
    QUIET: 'Almost silent: only critical system logs',
    VERBOSE: 'Everything enabled for deep debugging',
};

/**
 * Compact Log Configuration Bar
 * 
 * Controls what the extension logs. Note: This affects what logs are SENT,
 * not what's displayed in the viewer (use D/I/W/E buttons for that).
 */
export function LogConfigBar() {
    const { config, isLoading, setCategory, setPreset, isPresetActive, reset } = useLoggerConfig();
    const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set());
    const [presetsOpen, setPresetsOpen] = useState(false);
    const [categoriesOpen, setCategoriesOpen] = useState(false);

    const activePreset = useMemo(() => {
        if (!config) return null;
        for (const preset of LOGGER_PRESET_NAMES) {
            if (isPresetActive(preset)) {
                return preset;
            }
        }
        return null;
    }, [config, isPresetActive]);

    const isShowAllActive = config?.SHOW_ALL ?? false;
    const isErrorsOnlyActive = config?.ERRORS_ONLY ?? false;

    const handleToggleCategory = useCallback(
        async (category: LogCategory, enabled: boolean) => {
            if (pendingUpdates.has(category)) return;

            setPendingUpdates((prev) => new Set(prev).add(category));
            try {
                await setCategory(category, enabled);
            } catch (error) {
                console.error('[LogConfigBar] Failed to toggle category', { category, enabled, error });
            } finally {
                setPendingUpdates((prev) => {
                    const next = new Set(prev);
                    next.delete(category);
                    return next;
                });
            }
        },
        [setCategory, pendingUpdates]
    );

    const handlePresetClick = useCallback(
        async (preset: LoggerPresetName) => {
            if (isPresetActive(preset)) return;
            try {
                await setPreset(preset);
            } catch (error) {
                console.error('[LogConfigBar] Failed to apply preset', { preset, error });
            }
        },
        [setPreset, isPresetActive]
    );

    const handleReset = useCallback(async () => {
        try {
            await reset();
        } catch (error) {
            console.error('[LogConfigBar] Failed to reset configuration', error);
        }
    }, [reset]);

    // Get categories with their enabled status
    const categoryGroups = useMemo(() => {
        if (!config) return [];
        return (Object.keys(LOGGER_CATEGORY_GROUPS) as Array<keyof typeof LOGGER_CATEGORY_GROUPS>)
            .filter(g => g !== 'Debug')
            .map(groupName => ({
                key: groupName,
                name: LOGGER_GROUP_LABELS[groupName],
                categories: LOGGER_CATEGORY_GROUPS[groupName].map(cat => ({
                    name: cat,
                    enabled: config[cat] ?? false
                }))
            }));
    }, [config]);

    // Count enabled categories
    const enabledCount = useMemo(() => {
        if (!config) return 0;
        return categoryGroups.reduce((count, group) =>
            count + group.categories.filter(c => c.enabled).length, 0
        );
    }, [config, categoryGroups]);

    const totalCount = useMemo(() =>
        categoryGroups.reduce((count, group) => count + group.categories.length, 0),
        [categoryGroups]
    );

    if (isLoading || !config) {
        return (
            <div className="flex items-center gap-2 p-2 mb-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg">
                <div className="animate-pulse h-6 w-24 bg-[var(--bg-tertiary)] rounded" />
                <div className="animate-pulse h-6 w-16 bg-[var(--bg-tertiary)] rounded" />
                <div className="animate-pulse h-6 w-16 bg-[var(--bg-tertiary)] rounded" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2 mb-3">
            {/* Compact Configuration Bar */}
            <div className="flex items-center gap-1.5 p-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg">

                {/* Preset Selector */}
                <Popover open={presetsOpen} onOpenChange={setPresetsOpen}>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--glass-bg-hover)]"
                        >
                            <span className="text-[var(--text-tertiary)]">Preset:</span>
                            <span className={activePreset ? "text-[var(--color-secondary)]" : "text-amber-400"}>
                                {activePreset ? activePreset.replace(/_/g, ' ') : 'CUSTOM'}
                            </span>
                            <ChevronDown size={12} className={cn("text-[var(--text-tertiary)] transition-transform", presetsOpen && "rotate-180")} />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent
                        align="start"
                        className="w-[320px] p-0 bg-[var(--bg-primary)] border-[var(--border-color)]"
                        sideOffset={4}
                    >
                        <div className="p-2 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                            <p className="text-[10px] uppercase font-semibold text-[var(--text-tertiary)]">
                                Logging Presets
                            </p>
                            <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                                Controls which log categories the extension sends
                            </p>
                        </div>
                        <div className="p-1 max-h-[280px] overflow-y-auto">
                            {LOGGER_PRESET_NAMES.map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => {
                                        handlePresetClick(preset);
                                        setPresetsOpen(false);
                                    }}
                                    className={cn(
                                        "w-full flex items-start gap-2 p-2 rounded-md text-left cursor-pointer transition-all",
                                        activePreset === preset
                                            ? "bg-[var(--color-secondary)]/10"
                                            : "hover:bg-[var(--bg-tertiary)]"
                                    )}
                                >
                                    <div className={cn(
                                        "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5",
                                        activePreset === preset
                                            ? "border-[var(--color-secondary)] bg-[var(--color-secondary)]"
                                            : "border-[var(--border-color)]"
                                    )}>
                                        {activePreset === preset && <Check size={10} className="text-white" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className={cn(
                                            "text-xs font-medium",
                                            activePreset === preset ? "text-[var(--color-secondary)]" : "text-[var(--text-primary)]"
                                        )}>
                                            {preset.replace(/_/g, ' ')}
                                        </div>
                                        <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5 line-clamp-2">
                                            {PRESET_DESCRIPTIONS[preset]}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>

                {/* Separator */}
                <div className="h-5 w-px bg-[var(--border-color)]" />

                {/* Quick Toggle Pills */}
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                onClick={() => handleToggleCategory('SHOW_ALL', !isShowAllActive)}
                                className={cn(
                                    "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold uppercase cursor-pointer transition-all border",
                                    isShowAllActive
                                        ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                                        : "bg-transparent border-transparent text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-secondary)]"
                                )}
                            >
                                {isShowAllActive && <Check size={10} />}
                                All
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                            <p>Log everything regardless of category settings</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                onClick={() => handleToggleCategory('ERRORS_ONLY', !isErrorsOnlyActive)}
                                className={cn(
                                    "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold uppercase cursor-pointer transition-all border",
                                    isErrorsOnlyActive
                                        ? "bg-red-500/20 border-red-500/40 text-red-400"
                                        : "bg-transparent border-transparent text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-secondary)]"
                                )}
                            >
                                {isErrorsOnlyActive && <Check size={10} />}
                                Errors
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                            <p>Only log error-level messages (hides debug/info/warn)</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                {/* Separator */}
                <div className="h-5 w-px bg-[var(--border-color)]" />

                {/* Categories Popover */}
                <Popover open={categoriesOpen} onOpenChange={setCategoriesOpen}>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            className={cn(
                                "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all border",
                                "bg-transparent border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                            )}
                        >
                            <Filter size={12} />
                            <span className="hidden sm:inline">Categories</span>
                            <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded-full",
                                isShowAllActive
                                    ? "bg-amber-500/20 text-amber-400"
                                    : enabledCount === totalCount
                                        ? "bg-green-500/20 text-green-400"
                                        : enabledCount === 0
                                            ? "bg-red-500/20 text-red-400"
                                            : "bg-blue-500/20 text-blue-400"
                            )}>
                                {isShowAllActive ? 'ALL' : `${enabledCount}/${totalCount}`}
                            </span>
                            <ChevronDown size={12} className={cn("text-[var(--text-tertiary)] transition-transform", categoriesOpen && "rotate-180")} />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent
                        align="start"
                        className="w-[300px] p-0 bg-[var(--bg-primary)] border-[var(--border-color)]"
                        sideOffset={4}
                    >
                        <div className="p-2 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] flex items-center justify-between">
                            <div>
                                <p className="text-[10px] uppercase font-semibold text-[var(--text-tertiary)]">
                                    Log Categories
                                </p>
                                <p className="text-[10px] text-[var(--text-tertiary)]">
                                    {enabledCount} of {totalCount} enabled
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleReset}
                                className="text-[10px] px-2 py-1 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                            >
                                Reset
                            </button>
                        </div>
                        <div className="max-h-[280px] overflow-y-auto p-1">
                            {categoryGroups.map((group, idx) => (
                                <div key={group.key} className={cn(idx > 0 && "mt-2 pt-2 border-t border-[var(--border-color)]")}>
                                    <p className="text-[10px] uppercase font-semibold text-[var(--text-tertiary)] px-2 py-1">
                                        {group.name}
                                    </p>
                                    <div className="grid grid-cols-2 gap-0.5">
                                        {group.categories.map(({ name, enabled }) => (
                                            <button
                                                key={name}
                                                type="button"
                                                onClick={() => handleToggleCategory(name as LogCategory, !enabled)}
                                                disabled={isShowAllActive || pendingUpdates.has(name)}
                                                className={cn(
                                                    "flex items-center gap-1.5 px-2 py-1 rounded text-[10px] text-left cursor-pointer transition-all",
                                                    enabled || isShowAllActive
                                                        ? "text-[var(--text-primary)]"
                                                        : "text-[var(--text-tertiary)]",
                                                    "hover:bg-[var(--bg-tertiary)]",
                                                    isShowAllActive && "opacity-50 cursor-not-allowed"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-3 h-3 rounded border flex items-center justify-center shrink-0",
                                                    enabled || isShowAllActive
                                                        ? "border-[var(--color-secondary)] bg-[var(--color-secondary)]"
                                                        : "border-[var(--border-color)]"
                                                )}>
                                                    {(enabled || isShowAllActive) && <Check size={8} className="text-white" />}
                                                </div>
                                                <span className="truncate">{name.replace(/_/g, ' ')}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Reset Button */}
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium cursor-pointer transition-all text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-secondary)]"
                                onClick={handleReset}
                            >
                                <RotateCcw size={10} />
                                <span className="hidden sm:inline">Reset</span>
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                            <p>Reset to default (DEVELOPMENT) preset</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            {/* Warning Alert + Note */}
            <AnimatePresence>
                {(isShowAllActive || isErrorsOnlyActive) && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className={cn(
                            "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px]",
                            isShowAllActive
                                ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                                : "bg-red-500/10 border border-red-500/20 text-red-400"
                        )}
                    >
                        <AlertTriangle size={12} className="shrink-0" />
                        <span>
                            {isShowAllActive
                                ? "Logging all categories. New logs will include everything."
                                : "Only logging errors. New logs will only include error-level messages."
                            }
                        </span>
                        <span className="text-[var(--text-tertiary)] ml-auto text-[10px]">
                            Clear logs to see effect
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
