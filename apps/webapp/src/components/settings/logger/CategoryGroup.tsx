'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { LogCategory, LoggerConfig } from '@cognito/shared';
import { LOGGER_CATEGORY_GROUPS, LOGGER_GROUP_LABELS } from '@cognito/shared';
import { cn } from '@/lib/utils';

interface CategoryGroupProps {
    groupName: keyof typeof LOGGER_CATEGORY_GROUPS;
    categories: readonly LogCategory[];
    config: LoggerConfig;
    onToggleCategory: (category: LogCategory, enabled: boolean) => void;
    isOverridden: boolean;
}

/**
 * Collapsible category group with bulk toggle controls.
 * Displays a group of log categories with individual toggles and "All On"/"All Off" buttons.
 */
export function CategoryGroup({
    groupName,
    categories,
    config,
    onToggleCategory,
    isOverridden,
}: CategoryGroupProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const enabledCount = useMemo(() => {
        return categories.filter((cat) => config[cat]).length;
    }, [categories, config]);

    const handleEnableAll = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            categories.forEach((cat) => {
                if (!config[cat]) {
                    onToggleCategory(cat, true);
                }
            });
        },
        [categories, config, onToggleCategory]
    );

    const handleDisableAll = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            categories.forEach((cat) => {
                if (config[cat]) {
                    onToggleCategory(cat, false);
                }
            });
        },
        [categories, config, onToggleCategory]
    );

    return (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl overflow-hidden">
            <button
                type="button"
                className="flex items-center justify-between p-3 w-full cursor-pointer bg-transparent border-none text-[var(--text-primary)] transition-colors duration-200 hover:bg-[var(--glass-bg)]"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
            >
                <div className="flex items-center gap-2">
                    <ChevronDown
                        size={16}
                        className={cn(
                            "text-[var(--text-secondary)] transition-transform duration-200",
                            isExpanded && "rotate-180"
                        )}
                    />
                    <span className="text-sm font-medium">
                        {LOGGER_GROUP_LABELS[groupName]}
                        <span className="text-xs text-[var(--text-tertiary)] ml-1">
                            ({enabledCount}/{categories.length})
                        </span>
                    </span>
                </div>
                <div className="flex gap-1">
                    <button
                        type="button"
                        className="py-1 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-secondary)] text-[11px] cursor-pointer transition-all duration-200 hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handleEnableAll}
                        disabled={isOverridden || enabledCount === categories.length}
                        aria-label={`Enable all ${LOGGER_GROUP_LABELS[groupName]} categories`}
                    >
                        All On
                    </button>
                    <button
                        type="button"
                        className="py-1 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-secondary)] text-[11px] cursor-pointer transition-all duration-200 hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handleDisableAll}
                        disabled={isOverridden || enabledCount === 0}
                        aria-label={`Disable all ${LOGGER_GROUP_LABELS[groupName]} categories`}
                    >
                        All Off
                    </button>
                </div>
            </button>
            {isExpanded && (
                <div className="border-t border-[var(--border-color)]">
                    {categories.map((category) => (
                        <div
                            key={category}
                            className={cn(
                                "flex items-center justify-between py-2.5 px-3 border-b border-[var(--border-color)] last:border-b-0 transition-colors duration-200 hover:bg-[var(--glass-bg)]",
                                isOverridden && "opacity-50"
                            )}
                        >
                            <span className={cn(
                                "text-[13px]",
                                isOverridden ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"
                            )}>
                                {category}
                            </span>
                            <Switch
                                checked={config[category]}
                                onCheckedChange={(enabled) => onToggleCategory(category, enabled)}
                                disabled={isOverridden}
                                aria-label={`Toggle ${category} logging`}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
