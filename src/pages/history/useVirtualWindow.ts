/**
 * useVirtualWindow Hook
 * Manages manual virtualization for large result lists
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { HistoryResultGroup } from './types';

interface UseVirtualWindowOptions {
    groups: HistoryResultGroup[];
    containerHeight: number;
    itemHeight: number; // Average height per group
    overscan?: number; // Number of items to render outside viewport
}

interface VirtualItem {
    index: number;
    group: HistoryResultGroup;
    offsetTop: number;
}

interface UseVirtualWindowReturn {
    virtualItems: VirtualItem[];
    totalHeight: number;
    scrollToIndex: (index: number) => void;
    measurementRef: React.RefObject<HTMLDivElement>;
}

const DEFAULT_ITEM_HEIGHT = 120;
const DEFAULT_OVERSCAN = 3;

export function useVirtualWindow(options: UseVirtualWindowOptions): UseVirtualWindowReturn {
    const {
        groups,
        containerHeight,
        itemHeight = DEFAULT_ITEM_HEIGHT,
        overscan = DEFAULT_OVERSCAN,
    } = options;

    const [scrollTop, setScrollTop] = useState(0);
    const measurementRef = useRef<HTMLDivElement>(null);

    // Calculate total height
    const totalHeight = useMemo(() => {
        return groups.length * itemHeight;
    }, [groups.length, itemHeight]);

    // Calculate visible range
    const { startIndex, endIndex } = useMemo(() => {
        const visibleStart = Math.floor(scrollTop / itemHeight);
        const visibleEnd = Math.ceil((scrollTop + containerHeight) / itemHeight);

        return {
            startIndex: Math.max(0, visibleStart - overscan),
            endIndex: Math.min(groups.length - 1, visibleEnd + overscan),
        };
    }, [scrollTop, containerHeight, itemHeight, overscan, groups.length]);

    // Generate virtual items
    const virtualItems = useMemo<VirtualItem[]>(() => {
        const items: VirtualItem[] = [];
        for (let i = startIndex; i <= endIndex; i++) {
            if (i < groups.length) {
                items.push({
                    index: i,
                    group: groups[i],
                    offsetTop: i * itemHeight,
                });
            }
        }
        return items;
    }, [startIndex, endIndex, groups, itemHeight]);

    // Handle scroll events
    const handleScroll = useCallback((e: Event) => {
        const target = e.target as HTMLElement;
        setScrollTop(target.scrollTop);
    }, []);

    // Attach scroll listener
    useEffect(() => {
        const container = measurementRef.current;
        if (!container) return;

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            container.removeEventListener('scroll', handleScroll);
        };
    }, [handleScroll]);

    // Scroll to specific index
    const scrollToIndex = useCallback(
        (index: number) => {
            const container = measurementRef.current;
            if (!container) return;

            const offsetTop = index * itemHeight;
            container.scrollTo({
                top: offsetTop,
                behavior: 'smooth',
            });
        },
        [itemHeight]
    );

    return {
        virtualItems,
        totalHeight,
        scrollToIndex,
        measurementRef,
    };
}
