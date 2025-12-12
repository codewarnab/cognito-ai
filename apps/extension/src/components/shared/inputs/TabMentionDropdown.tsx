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
            <div className="fixed bg-white border border-[#e0e0e0] rounded-md shadow-lg max-w-[320px] w-[320px] max-h-[240px] overflow-hidden z-[10000] -mt-2.5 origin-bottom-left -translate-y-full dark:bg-[#1e1e1e] dark:border-[#3c3c3c] dark:shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-150" style={position}>
                <div className="p-3 text-center text-[#7f8c8d] text-xs dark:text-[#888]">Loading...</div>
            </div>
        );
    }

    if (filteredTabs.length === 0) {
        return (
            <div className="fixed bg-white border border-[#e0e0e0] rounded-md shadow-lg max-w-[320px] w-[320px] max-h-[240px] overflow-hidden z-[10000] -mt-2.5 origin-bottom-left -translate-y-full dark:bg-[#1e1e1e] dark:border-[#3c3c3c] dark:shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-150" style={position}>
                <div className="p-3 text-center text-[#7f8c8d] text-xs dark:text-[#888]">
                    {searchQuery ? `No tabs matching "${searchQuery}"` : 'No tabs found'}
                </div>
            </div>
        );
    }

    return (
        <div className="fixed bg-white border border-[#e0e0e0] rounded-md shadow-lg max-w-[320px] w-[320px] max-h-[240px] overflow-hidden z-[10000] -mt-2.5 origin-bottom-left -translate-y-full dark:bg-[#1e1e1e] dark:border-[#3c3c3c] dark:shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-150" style={position}>
            <div className="max-h-[240px] overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#d0d0d0] [&::-webkit-scrollbar-thumb]:rounded-sm hover:[&::-webkit-scrollbar-thumb]:bg-[#b0b0b0] dark:[&::-webkit-scrollbar-thumb]:bg-[#3c3c3c] dark:hover:[&::-webkit-scrollbar-thumb]:bg-[#4c4c4c]" ref={listRef}>
                {filteredTabs.map((tab, index) => {
                    const isAlreadyMentioned = tab.id && alreadyMentionedTabIds.has(String(tab.id));
                    const isSelected = index === selectedIndex;

                    return (
                        <button
                            key={tab.id}
                            ref={index === selectedIndex ? selectedItemRef : null}
                            className={`flex items-center gap-2 px-2.5 py-1.5 border-none bg-white w-full text-left cursor-pointer transition-colors duration-100 border-b border-[#f5f5f5] last:border-b-0 hover:bg-[#f8f9fa] dark:bg-[#1e1e1e] dark:border-[#2a2a2a] dark:hover:bg-[#2a2a2a] ${isSelected ? '!bg-[#e3f2fd] dark:!bg-[#1a3a52]' : ''} ${isAlreadyMentioned ? 'opacity-50 cursor-not-allowed !bg-[#fafafa] dark:!bg-[#252525]' : ''}`}
                            onClick={() => !isAlreadyMentioned && onSelectTab(tab)}
                            onMouseEnter={() => !isAlreadyMentioned && setSelectedIndex(index)}
                            disabled={!!isAlreadyMentioned}
                            title={isAlreadyMentioned ? 'Already mentioned' : ''}
                        >
                            <div className="shrink-0 w-3.5 h-3.5 flex items-center justify-center text-xs">
                                {isPdfUrl(tab.url || '') ? (
                                    <span>📕</span>
                                ) : tab.favIconUrl ? (
                                    <img src={tab.favIconUrl} alt="" className="w-3.5 h-3.5 object-contain rounded-[2px]" />
                                ) : (
                                    <span>🌐</span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                                <div className="text-xs font-medium text-[#2c3e50] whitespace-nowrap overflow-hidden text-ellipsis leading-tight dark:text-[#e0e0e0]">
                                    {tab.title || 'Untitled'}
                                    {isAlreadyMentioned && <span className="text-[10px] font-normal text-[#4caf50] ml-1 dark:text-[#81c784]"> ✓ Already mentioned</span>}
                                </div>
                                <div className="text-[10px] text-[#7f8c8d] whitespace-nowrap overflow-hidden text-ellipsis mt-px leading-tight dark:text-[#888]">
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

