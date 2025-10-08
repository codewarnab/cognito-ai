/**
 * History Search Page
 * On-device semantic search for browsing history
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useSettings } from './useSettings';
import { useHistorySearch } from './useHistorySearch';
import { useKeyboardNav } from './useKeyboardNav';
import { useVirtualWindow } from './useVirtualWindow';
import type { DateRange, Toast, HistoryResultGroup } from './types';
import {
    HeaderBar,
    SearchInput,
    FiltersBar,
    PrivacyControls,
    ResultsSummary,
    ResultGroup,
    EmptyState,
    ToastContainer,
    Banner,
    LoadingSkeleton,
} from './components';
import './history.css';

export default function HistoryPage() {
    // State
    const [query, setQuery] = useState('');
    const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
    const [domains, setDomains] = useState<string[]>([]);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [groupsWithExpansion, setGroupsWithExpansion] = useState<HistoryResultGroup[]>([]);

    // Settings hook
    const {
        modelReady,
        paused,
        domainAllowlist,
        domainDenylist,
        loading: settingsLoading,
        error: settingsError,
        setPaused,
        updateFilters,
        clearIndex
    } = useSettings();

    // Search hook
    const { groups, total, isSearching, error: searchError, refresh } = useHistorySearch({
        query,
        dateRange,
        domains,
        limit: 200,
    });

    // Sync groups with expansion state
    useEffect(() => {
        setGroupsWithExpansion(
            groups.map((group, index) => ({
                ...group,
                isExpanded: groupsWithExpansion[index]?.isExpanded || false,
            }))
        );
    }, [groups]);

    // Toast management
    const addToast = useCallback((message: string, type: Toast['type'] = 'info', duration = 5000) => {
        const id = `toast-${Date.now()}-${Math.random()}`;
        const newToast: Toast = { id, message, type, duration };
        setToasts((prev) => [...prev, newToast]);

        if (duration > 0) {
            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
            }, duration);
        }
    }, []);

    const closeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    // Handler: Toggle pause
    const handlePauseToggle = useCallback(
        async (newPaused: boolean) => {
            try {
                await setPaused(newPaused);
                addToast(newPaused ? 'Collection paused' : 'Collection resumed', 'success');
            } catch (err) {
                addToast('Failed to update pause state', 'error');
            }
        },
        [setPaused, addToast]
    );

    // Handler: Update allowlist
    const handleAllowlistUpdate = useCallback(
        async (allowlist: string[]) => {
            try {
                await updateFilters(allowlist, domainDenylist);
                addToast('Allowlist updated', 'success');
            } catch (err) {
                addToast('Failed to update allowlist', 'error');
            }
        },
        [updateFilters, domainDenylist, addToast]
    );

    // Handler: Update denylist
    const handleDenylistUpdate = useCallback(
        async (denylist: string[]) => {
            try {
                await updateFilters(domainAllowlist, denylist);
                addToast('Denylist updated', 'success');
            } catch (err) {
                addToast('Failed to update denylist', 'error');
            }
        },
        [updateFilters, domainAllowlist, addToast]
    );

    // Handler: Delete all data
    const handleDeleteAllData = useCallback(
        async (alsoRemoveModel: boolean) => {
            try {
                // Send wipe request with 10 second delay
                await chrome.runtime.sendMessage({
                    type: 'privacy:wipe',
                    alsoRemoveModel,
                    delayMs: 10000
                });

                // Show undo toast
                const toastId = `undo-${Date.now()}`;
                const undoToast: Toast = {
                    id: toastId,
                    message: 'Deleting all data in 10 seconds...',
                    type: 'warning',
                    duration: 10000,
                    action: {
                        label: 'Undo',
                        onClick: async () => {
                            await chrome.runtime.sendMessage({ type: 'privacy:wipe:cancel' });
                            addToast('Data deletion cancelled', 'success');
                            closeToast(toastId);
                        }
                    }
                };
                setToasts((prev) => [...prev, undoToast]);

                // Hide results immediately for privacy
                setQuery('');
                setDomains([]);
                setDateRange({ start: null, end: null });
            } catch (err) {
                addToast('Failed to delete data', 'error');
            }
        },
        [addToast, closeToast]
    );

    // Handler: Clear index
    const handleClearIndex = useCallback(async () => {
        try {
            await clearIndex();
            addToast('Index cleared successfully', 'success');
            setQuery('');
            setDomains([]);
            setDateRange({ start: null, end: null });
        } catch (err) {
            addToast('Failed to clear index', 'error');
        }
    }, [clearIndex, addToast]);

    // Handler: Open item
    const handleOpenItem = useCallback((url: string, newTab = true, background = false) => {
        if (newTab) {
            chrome.tabs.create({ url, active: !background });
        } else {
            chrome.tabs.update({ url });
        }
    }, []);

    // Handler: Open group
    const handleOpenGroup = useCallback(
        (groupIndex: number) => {
            const group = groupsWithExpansion[groupIndex];
            if (!group) return;

            group.items.forEach((item, index) => {
                chrome.tabs.create({ url: item.url, active: index === 0 });
            });

            addToast(`Opened ${group.items.length} tabs from ${group.domain}`, 'info');
        },
        [groupsWithExpansion, addToast]
    );

    // Handler: Toggle expand group
    const handleToggleExpand = useCallback((groupIndex: number) => {
        setGroupsWithExpansion((prev) =>
            prev.map((group, index) =>
                index === groupIndex ? { ...group, isExpanded: !group.isExpanded } : group
            )
        );
    }, []);

    // Handler: Clear filters
    const handleClearFilters = useCallback(() => {
        setDomains([]);
        setDateRange({ start: null, end: null });
    }, []);

    // Keyboard navigation
    const {
        focusedGroupIndex,
        focusedItemIndex,
        setFocusedGroupIndex,
        setFocusedItemIndex,
        resetFocus,
        handleKeyDown,
    } = useKeyboardNav({
        groups: groupsWithExpansion,
        onOpenItem: handleOpenItem,
        onOpenGroup: handleOpenGroup,
        onToggleExpand: handleToggleExpand,
        enabled: !isSearching && groupsWithExpansion.length > 0,
    });

    // Virtualization (optional, for very large result sets)
    const containerHeight = 600; // Adjust based on viewport
    const { virtualItems, totalHeight, scrollToIndex, measurementRef } = useVirtualWindow({
        groups: groupsWithExpansion,
        containerHeight,
        itemHeight: 120,
        overscan: 3,
    });

    // Determine empty state type
    const emptyStateType = useMemo(() => {
        if (!modelReady) return 'model-not-ready';
        if (paused) return 'paused';
        if (!query.trim()) return 'no-query';
        if (query.trim() && !isSearching && groupsWithExpansion.length === 0) return 'no-results';
        return null;
    }, [modelReady, paused, query, isSearching, groupsWithExpansion.length]);

    // Show errors via toast
    useEffect(() => {
        if (searchError) {
            addToast(searchError, 'error');
        }
    }, [searchError, addToast]);

    useEffect(() => {
        if (settingsError) {
            addToast(settingsError, 'error');
        }
    }, [settingsError, addToast]);

    // Focus first result after search completes
    useEffect(() => {
        if (!isSearching && groupsWithExpansion.length > 0 && focusedGroupIndex === -1) {
            setFocusedGroupIndex(0);
            setFocusedItemIndex(0);
        }
    }, [isSearching, groupsWithExpansion.length, focusedGroupIndex, setFocusedGroupIndex, setFocusedItemIndex]);

    // Render
    return (
        <div className="history-page" onKeyDown={handleKeyDown}>
            {/* Header */}
            <HeaderBar title="🔍 History Search">
                <SearchInput
                    value={query}
                    onChange={setQuery}
                    placeholder="Search your browsing history..."
                    disabled={!modelReady || settingsLoading}
                />

                <FiltersBar
                    dateRange={dateRange}
                    domains={domains}
                    onDateChange={setDateRange}
                    onDomainsChange={setDomains}
                    disabled={!modelReady || settingsLoading}
                />

                <PrivacyControls
                    paused={paused}
                    domainAllowlist={domainAllowlist || []}
                    domainDenylist={domainDenylist || []}
                    onPauseToggle={handlePauseToggle}
                    onAllowlistUpdate={handleAllowlistUpdate}
                    onDenylistUpdate={handleDenylistUpdate}
                    onDeleteAllData={handleDeleteAllData}
                    disabled={settingsLoading || isSearching}
                />
            </HeaderBar>

            {/* Paused banner */}
            {paused && (
                <Banner
                    type="warning"
                    message="History collection is paused. You can still search existing data."
                    action={{
                        label: 'Resume',
                        onClick: () => handlePauseToggle(false),
                    }}
                />
            )}

            {/* Model not ready banner */}
            {!modelReady && (
                <Banner
                    type="info"
                    message="Setting up the AI model for search. This may take a few moments..."
                />
            )}

            {/* Main content */}
            <main role="main">
                {emptyStateType ? (
                    <EmptyState type={emptyStateType} onResume={paused ? () => handlePauseToggle(false) : undefined} />
                ) : (
                    <>
                        {/* Results summary */}
                        {query.trim() && !isSearching && groupsWithExpansion.length > 0 && (
                            <ResultsSummary
                                total={total}
                                groupCount={groupsWithExpansion.length}
                                activeFilters={{ dateRange, domains }}
                                onClearFilters={handleClearFilters}
                            />
                        )}

                        {/* Loading state */}
                        {isSearching && <LoadingSkeleton count={5} />}

                        {/* Results list */}
                        {!isSearching && groupsWithExpansion.length > 0 && (
                            <div
                                ref={measurementRef}
                                className="history-results-container"
                                role="list"
                                aria-label="Search results"
                                aria-live="polite"
                                style={{ maxHeight: `${containerHeight}px`, overflowY: 'auto' }}
                            >
                                <div className="history-results-list" style={{ height: `${totalHeight}px`, position: 'relative' }}>
                                    {virtualItems.map((virtualItem) => (
                                        <div
                                            key={virtualItem.index}
                                            style={{
                                                position: 'absolute',
                                                top: `${virtualItem.offsetTop}px`,
                                                left: 0,
                                                right: 0,
                                            }}
                                        >
                                            <ResultGroup
                                                group={virtualItem.group}
                                                groupIndex={virtualItem.index}
                                                focusedItemIndex={
                                                    focusedGroupIndex === virtualItem.index ? focusedItemIndex : -1
                                                }
                                                onToggleExpand={() => handleToggleExpand(virtualItem.index)}
                                                onOpenGroup={() => handleOpenGroup(virtualItem.index)}
                                                onItemClick={handleOpenItem}
                                                onItemFocus={(itemIndex) => {
                                                    setFocusedGroupIndex(virtualItem.index);
                                                    setFocusedItemIndex(itemIndex);
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* Toast notifications */}
            <ToastContainer toasts={toasts} onClose={closeToast} />
        </div>
    );
}
