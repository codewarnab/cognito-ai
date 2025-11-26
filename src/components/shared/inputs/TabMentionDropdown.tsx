/**
 * Dropdown component for selecting tabs to mention
 * Displays available tabs with favicon, title, and URL
 */

import React, { useEffect, useState } from 'react';
import { getAllTabs } from '@/utils/tabs';
import { extractMentions } from '@/utils/chat';

interface TabMentionDropdownProps {
    searchQuery: string;
    onSelectTab: (tab: chrome.tabs.Tab) => void;
    onClose: () => void;
    position?: { top: number; left: number };
    currentInput?: string;
}

export function TabMentionDropdown({
    searchQuery,
    onSelectTab,
    onClose,
    position,
    currentInput = ''
}: TabMentionDropdownProps) {
    const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const listRef = React.useRef<HTMLDivElement>(null);
    const selectedItemRef = React.useRef<HTMLButtonElement>(null);

    // Load tabs on mount
    useEffect(() => {
        let mounted = true;

        const loadTabs = async () => {
            try {
                setLoading(true);
                const allTabs = await getAllTabs();
                if (mounted) {
                    setTabs(allTabs);
                }
            } catch (error) {
                console.error('Failed to load tabs:', error);
                // Optionally set error state here if needed
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        loadTabs();

        return () => {
            mounted = false;
        };
    }, []);

    // Extract already mentioned tab IDs from current input
    const alreadyMentionedTabIds = React.useMemo(() => {
        const { tabMentions } = extractMentions(currentInput);
        return new Set(tabMentions.map(m => m.id));
    }, [currentInput]);

    // Filter tabs based on search query and exclude Chrome internal pages
    const filteredTabs = tabs.filter(tab => {
        const url = tab.url || '';

        // Exclude Chrome internal pages
        if (url.startsWith('chrome://') ||
            url.startsWith('chrome-extension://') ||
            url.startsWith('edge://') ||
            url.startsWith('about:')) {
            return false;
        }

        const query = searchQuery.toLowerCase();
        const title = (tab.title || '').toLowerCase();
        const urlLower = url.toLowerCase();
        return title.includes(query) || urlLower.includes(query);
    });

    // Reset selected index when filtered results change
    useEffect(() => {
        setSelectedIndex(0);
    }, [searchQuery]);

    // Auto-scroll selected item into view
    useEffect(() => {
        if (selectedItemRef.current && listRef.current) {
            const item = selectedItemRef.current;
            const list = listRef.current;
            const itemTop = item.offsetTop;
            const itemBottom = itemTop + item.offsetHeight;
            const listScrollTop = list.scrollTop;
            const listHeight = list.clientHeight;

            if (itemBottom > listScrollTop + listHeight) {
                // Scroll down to show item
                list.scrollTop = itemBottom - listHeight;
            } else if (itemTop < listScrollTop) {
                // Scroll up to show item
                list.scrollTop = itemTop;
            }
        }
    }, [selectedIndex]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex(prev => {
                        let next = prev + 1;
                        // Skip disabled tabs
                        while (next < filteredTabs.length &&
                            filteredTabs[next] &&
                            filteredTabs[next]!.id &&
                            alreadyMentionedTabIds.has(String(filteredTabs[next]!.id))) {
                            next++;
                        }
                        return next < filteredTabs.length ? next : prev;
                    });
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex(prev => {
                        let next = prev - 1;
                        // Skip disabled tabs
                        while (next >= 0 &&
                            filteredTabs[next] &&
                            filteredTabs[next]!.id &&
                            alreadyMentionedTabIds.has(String(filteredTabs[next]!.id))) {
                            next--;
                        }
                        return next >= 0 ? next : 0;
                    });
                    break;
                case 'Enter':
                    e.preventDefault();
                    const selectedTab = filteredTabs[selectedIndex];
                    const isDisabled = selectedTab?.id && alreadyMentionedTabIds.has(String(selectedTab.id));
                    if (selectedTab && !isDisabled) {
                        onSelectTab(selectedTab);
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    onClose();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredTabs, selectedIndex, onSelectTab, onClose, alreadyMentionedTabIds]);

    if (loading) {
        return (
            <div className="tab-mention-dropdown" style={position}>
                <div className="tab-mention-loading">Loading...</div>
            </div>
        );
    }

    if (filteredTabs.length === 0) {
        return (
            <div className="tab-mention-dropdown" style={position}>
                <div className="tab-mention-empty">
                    {searchQuery ? `No tabs matching "${searchQuery}"` : 'No tabs found'}
                </div>
            </div>
        );
    }

    return (
        <div className="tab-mention-dropdown" style={position}>
            <div className="tab-mention-list" ref={listRef}>
                {filteredTabs.map((tab, index) => {
                    const isAlreadyMentioned = tab.id && alreadyMentionedTabIds.has(String(tab.id));
                    return (
                        <button
                            key={tab.id}
                            ref={index === selectedIndex ? selectedItemRef : null}
                            className={`tab-mention-item ${index === selectedIndex ? 'selected' : ''} ${isAlreadyMentioned ? 'disabled' : ''}`}
                            onClick={() => !isAlreadyMentioned && onSelectTab(tab)}
                            onMouseEnter={() => !isAlreadyMentioned && setSelectedIndex(index)}
                            disabled={!!isAlreadyMentioned}
                            title={isAlreadyMentioned ? 'Already mentioned' : ''}
                        >
                            <div className="tab-mention-favicon">
                                {isPdfUrl(tab.url || '') ? (
                                    <span>📕</span>
                                ) : tab.favIconUrl ? (
                                    <img src={tab.favIconUrl} alt="" width="14" height="14" />
                                ) : (
                                    <span>🌐</span>
                                )}
                            </div>
                            <div className="tab-mention-info">
                                <div className="tab-mention-title">
                                    {tab.title || 'Untitled'}
                                    {isAlreadyMentioned && <span className="already-mentioned-badge"> ✓ Already mentioned</span>}
                                </div>
                                <div className="tab-mention-url">
                                    {formatUrl(tab.url || '')}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// Helper to check if URL is a PDF
function isPdfUrl(url: string): boolean {
    return url.toLowerCase().endsWith('.pdf');
}

// Helper to format URL nicely
function formatUrl(url: string): string {
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace('www.', '');
        const path = urlObj.pathname.length > 1 ? urlObj.pathname.substring(0, 30) : '';
        return domain + (path.length > 25 ? path.substring(0, 25) + '...' : path);
    } catch {
        return url.substring(0, 40);
    }
}

