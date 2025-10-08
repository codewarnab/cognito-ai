/**
 * useKeyboardNav Hook
 * Manages roving tabindex and keyboard navigation for results
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import type { HistoryResultGroup } from './types';

interface UseKeyboardNavOptions {
    groups: HistoryResultGroup[];
    onOpenItem: (url: string, newTab?: boolean, background?: boolean) => void;
    onOpenGroup: (groupIndex: number) => void;
    onToggleExpand: (groupIndex: number) => void;
    enabled?: boolean;
}

interface UseKeyboardNavReturn {
    focusedGroupIndex: number;
    focusedItemIndex: number;
    setFocusedGroupIndex: (index: number) => void;
    setFocusedItemIndex: (index: number) => void;
    resetFocus: () => void;
    handleKeyDown: (e: React.KeyboardEvent) => void;
}

export function useKeyboardNav(options: UseKeyboardNavOptions): UseKeyboardNavReturn {
    const { groups, onOpenItem, onOpenGroup, onToggleExpand, enabled = true } = options;

    const [focusedGroupIndex, setFocusedGroupIndex] = useState(-1);
    const [focusedItemIndex, setFocusedItemIndex] = useState(-1);

    const groupsRef = useRef(groups);
    groupsRef.current = groups;

    const resetFocus = useCallback(() => {
        setFocusedGroupIndex(-1);
        setFocusedItemIndex(-1);
    }, []);

    // Reset focus when groups change significantly
    useEffect(() => {
        if (groups.length === 0) {
            resetFocus();
        } else if (focusedGroupIndex >= groups.length) {
            setFocusedGroupIndex(groups.length - 1);
            setFocusedItemIndex(0);
        }
    }, [groups.length, focusedGroupIndex, resetFocus]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (!enabled || groups.length === 0) return;

            const currentGroups = groupsRef.current;

            switch (e.key) {
                case 'ArrowDown': {
                    e.preventDefault();
                    if (focusedGroupIndex === -1) {
                        // Start from first group, first item
                        setFocusedGroupIndex(0);
                        setFocusedItemIndex(0);
                    } else {
                        const currentGroup = currentGroups[focusedGroupIndex];
                        const maxItemIndex = (currentGroup?.isExpanded
                            ? currentGroup.items.length
                            : Math.min(3, currentGroup.items.length)) - 1;

                        if (focusedItemIndex < maxItemIndex) {
                            // Move down within group
                            setFocusedItemIndex(focusedItemIndex + 1);
                        } else if (focusedGroupIndex < currentGroups.length - 1) {
                            // Move to next group
                            setFocusedGroupIndex(focusedGroupIndex + 1);
                            setFocusedItemIndex(0);
                        }
                    }
                    break;
                }

                case 'ArrowUp': {
                    e.preventDefault();
                    if (focusedGroupIndex === -1) {
                        // Start from last group, last item
                        const lastGroupIndex = currentGroups.length - 1;
                        const lastGroup = currentGroups[lastGroupIndex];
                        const lastItemIndex = (lastGroup?.isExpanded
                            ? lastGroup.items.length
                            : Math.min(3, lastGroup.items.length)) - 1;
                        setFocusedGroupIndex(lastGroupIndex);
                        setFocusedItemIndex(lastItemIndex);
                    } else if (focusedItemIndex > 0) {
                        // Move up within group
                        setFocusedItemIndex(focusedItemIndex - 1);
                    } else if (focusedGroupIndex > 0) {
                        // Move to previous group's last item
                        const prevGroupIndex = focusedGroupIndex - 1;
                        const prevGroup = currentGroups[prevGroupIndex];
                        const lastItemIndex = (prevGroup?.isExpanded
                            ? prevGroup.items.length
                            : Math.min(3, prevGroup.items.length)) - 1;
                        setFocusedGroupIndex(prevGroupIndex);
                        setFocusedItemIndex(lastItemIndex);
                    }
                    break;
                }

                case 'ArrowRight': {
                    e.preventDefault();
                    if (focusedGroupIndex >= 0 && focusedItemIndex === -1) {
                        // Expand group
                        const group = currentGroups[focusedGroupIndex];
                        if (!group.isExpanded && group.totalItems > 3) {
                            onToggleExpand(focusedGroupIndex);
                        }
                    }
                    break;
                }

                case 'ArrowLeft': {
                    e.preventDefault();
                    if (focusedGroupIndex >= 0 && focusedItemIndex === -1) {
                        // Collapse group
                        const group = currentGroups[focusedGroupIndex];
                        if (group.isExpanded) {
                            onToggleExpand(focusedGroupIndex);
                        }
                    }
                    break;
                }

                case 'Home': {
                    e.preventDefault();
                    if (currentGroups.length > 0) {
                        setFocusedGroupIndex(0);
                        setFocusedItemIndex(0);
                    }
                    break;
                }

                case 'End': {
                    e.preventDefault();
                    if (currentGroups.length > 0) {
                        const lastGroupIndex = currentGroups.length - 1;
                        const lastGroup = currentGroups[lastGroupIndex];
                        const lastItemIndex = (lastGroup?.isExpanded
                            ? lastGroup.items.length
                            : Math.min(3, lastGroup.items.length)) - 1;
                        setFocusedGroupIndex(lastGroupIndex);
                        setFocusedItemIndex(lastItemIndex);
                    }
                    break;
                }

                case 'Enter': {
                    e.preventDefault();
                    if (focusedGroupIndex >= 0) {
                        const group = currentGroups[focusedGroupIndex];
                        if (focusedItemIndex >= 0 && focusedItemIndex < group.items.length) {
                            // Open specific item
                            const item = group.items[focusedItemIndex];
                            const newTab = !e.shiftKey; // Open in new tab by default, current tab with Shift
                            const background = e.ctrlKey || e.metaKey; // Background with Ctrl/Cmd
                            onOpenItem(item.url, newTab, background);
                        } else {
                            // Open entire group (Shift+Enter on group header)
                            if (e.shiftKey) {
                                onOpenGroup(focusedGroupIndex);
                            }
                        }
                    }
                    break;
                }

                case 'Escape': {
                    e.preventDefault();
                    resetFocus();
                    break;
                }

                default:
                    break;
            }
        },
        [
            enabled,
            groups,
            focusedGroupIndex,
            focusedItemIndex,
            onOpenItem,
            onOpenGroup,
            onToggleExpand,
            resetFocus,
        ]
    );

    return {
        focusedGroupIndex,
        focusedItemIndex,
        setFocusedGroupIndex,
        setFocusedItemIndex,
        resetFocus,
        handleKeyDown,
    };
}
