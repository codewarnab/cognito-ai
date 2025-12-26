'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { LogCategory, LoggerConfig } from '@cognito/shared';
import { LOGGER_CATEGORY_GROUPS, LOGGER_GROUP_LABELS, LOGGER_SUBCATEGORY_GROUPS, hasSubCategories } from '@cognito/shared';
import { cn } from '@/lib/utils';

interface CategoryGroupProps {
    groupName: keyof typeof LOGGER_CATEGORY_GROUPS;
    categories: readonly LogCategory[];
    config: LoggerConfig;
    onToggleCategory: (category: LogCategory, enabled: boolean) => void;
    isOverridden: boolean;
    searchQuery?: string;
}

/**
 * Sub-category item component with toggle switch
 */
function SubCategoryItem({
    subCategory,
    isEnabled,
    onToggle,
    isOverridden,
}: {
    subCategory: LogCategory;
    isEnabled: boolean;
    onToggle: (enabled: boolean) => void;
    isOverridden: boolean;
}) {
    // Extract the short name from full key (e.g., MCP_CLIENT_CONNECTION -> CONNECTION)
    const shortName = subCategory.split('_').slice(-1)[0];

    return (
        <div
            className={cn(
                "flex items-center justify-between py-2 px-3 pl-10 border-b border-[var(--border-color)]/50 last:border-b-0 transition-colors duration-200 hover:bg-[var(--glass-bg)] bg-[var(--bg-tertiary)]/30",
                isOverridden && "opacity-50"
            )}
        >
            <span className={cn(
                "text-[12px]",
                isOverridden ? "text-[var(--text-tertiary)]" : "text-[var(--text-secondary)]"
            )}>
                {shortName}
            </span>
            <Switch
                checked={isEnabled}
                onCheckedChange={onToggle}
                disabled={isOverridden}
                aria-label={`Toggle ${subCategory} sub-category logging`}
                className="scale-90"
            />
        </div>
    );
}

/**
 * Category item with optional sub-categories
 */
function CategoryItem({
    category,
    config,
    onToggleCategory,
    isOverridden,
}: {
    category: LogCategory;
    config: LoggerConfig;
    onToggleCategory: (category: LogCategory, enabled: boolean) => void;
    isOverridden: boolean;
}) {
    const [isSubExpanded, setIsSubExpanded] = useState(false);
    const hasSubs = hasSubCategories(category);
    const subCategories = hasSubs ? LOGGER_SUBCATEGORY_GROUPS[category] : [];

    // Count enabled sub-categories
    const enabledSubCount = useMemo(() => {
        if (!hasSubs) return 0;
        return subCategories.filter((subCat) => config[subCat as LogCategory]).length;
    }, [hasSubs, subCategories, config]);

    return (
        <div className="border-b border-[var(--border-color)] last:border-b-0">
            <div
                className={cn(
                    "flex items-center justify-between py-2.5 px-3 transition-colors duration-200 hover:bg-[var(--glass-bg)]",
                    isOverridden && "opacity-50"
                )}
            >
                <div className="flex items-center gap-2">
                    {hasSubs ? (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsSubExpanded(!isSubExpanded);
                            }}
                            className="p-0.5 bg-transparent border-none cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                            aria-label={isSubExpanded ? 'Collapse sub-categories' : 'Expand sub-categories'}
                        >
                            {isSubExpanded ? (
                                <ChevronDown size={14} />
                            ) : (
                                <ChevronRight size={14} />
                            )}
                        </button>
                    ) : (
                        <div className="w-[18px]" /> // Spacer for alignment
                    )}
                    <span className={cn(
                        "text-[13px]",
                        isOverridden ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"
                    )}>
                        {category}
                    </span>
                    {hasSubs && (
                        <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">
                            {enabledSubCount}/{subCategories.length}
                        </span>
                    )}
                </div>
                <Switch
                    checked={config[category]}
                    onCheckedChange={(enabled) => onToggleCategory(category, enabled)}
                    disabled={isOverridden}
                    aria-label={`Toggle ${category} logging`}
                />
            </div>
            {/* Sub-categories */}
            {hasSubs && isSubExpanded && (
                <div className="border-t border-[var(--border-color)]/50">
                    {subCategories.map((subCat) => (
                        <SubCategoryItem
                            key={subCat}
                            subCategory={subCat as LogCategory}
                            isEnabled={config[subCat as LogCategory] ?? config[category]}
                            onToggle={(enabled) => onToggleCategory(subCat as LogCategory, enabled)}
                            isOverridden={isOverridden}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Collapsible category group with bulk toggle controls.
 * Displays a group of log categories with individual toggles and "All On"/"All Off" buttons.
 * Auto-expands when search query matches any category in the group.
 * Categories with sub-categories show nested accordions.
 */
export function CategoryGroup({
    groupName,
    categories,
    config,
    onToggleCategory,
    isOverridden,
    searchQuery = '',
}: CategoryGroupProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Check if any category in this group matches the search query
    const hasMatchingCategory = useMemo(() => {
        if (!searchQuery.trim()) return false;
        const query = searchQuery.toLowerCase();
        return categories.some(cat => cat.toLowerCase().includes(query));
    }, [categories, searchQuery]);

    // Auto-expand when search matches a category in this group
    useEffect(() => {
        if (hasMatchingCategory) {
            setIsExpanded(true);
        }
    }, [hasMatchingCategory]);

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
                        <CategoryItem
                            key={category}
                            category={category}
                            config={config}
                            onToggleCategory={onToggleCategory}
                            isOverridden={isOverridden}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
