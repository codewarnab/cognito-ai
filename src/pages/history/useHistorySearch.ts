/**
 * useHistorySearch Hook
 * Manages search state and Port connection for streaming results
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { SearchFilters, HistoryResultGroup, SearchPortMessage } from './types';

interface UseHistorySearchOptions {
    query: string;
    dateRange: { start: number | null; end: number | null };
    domains: string[];
    limit?: number;
    offset?: number;
}

interface UseHistorySearchReturn {
    groups: HistoryResultGroup[];
    total: number;
    isSearching: boolean;
    error: string | null;
    refresh: () => void;
}

const DEBOUNCE_DELAY = 280;
const SEARCH_TIMEOUT = 10000; // 10 seconds

export function useHistorySearch(options: UseHistorySearchOptions): UseHistorySearchReturn {
    const { query, dateRange, domains, limit = 200, offset = 0 } = options;

    const [groups, setGroups] = useState<HistoryResultGroup[]>([]);
    const [total, setTotal] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const portRef = useRef<chrome.runtime.Port | null>(null);
    const debounceTimerRef = useRef<number | null>(null);
    const searchTimeoutRef = useRef<number | null>(null);
    const mountedRef = useRef(true);

    // Create stable filters object
    const filters = useMemo<SearchFilters>(
        () => ({
            query: query.trim(),
            dateRange,
            domains,
            limit,
            offset,
        }),
        [query, dateRange, domains, limit, offset]
    );

    // Initialize Port connection
    useEffect(() => {
        const port = chrome.runtime.connect({ name: 'history-search' });
        portRef.current = port;

        port.onMessage.addListener((msg: SearchPortMessage) => {
            if (!mountedRef.current) return;

            switch (msg.type) {
                case 'SEARCH_RESULT':
                    setGroups(prev => {
                        // If final is true, replace; otherwise append
                        if (msg.final) {
                            return msg.chunk;
                        }
                        return [...prev, ...msg.chunk];
                    });
                    setTotal(msg.total);
                    if (msg.final) {
                        setIsSearching(false);
                        clearTimeout(searchTimeoutRef.current!);
                    }
                    break;

                case 'SEARCH_DONE':
                    setIsSearching(false);
                    clearTimeout(searchTimeoutRef.current!);
                    break;

                case 'SEARCH_ERROR':
                    setError(msg.message);
                    setIsSearching(false);
                    clearTimeout(searchTimeoutRef.current!);
                    break;
            }
        });

        port.onDisconnect.addListener(() => {
            if (!mountedRef.current) return;
            const err = chrome.runtime.lastError;
            if (err) {
                setError(err.message || 'Search connection disconnected');
                setIsSearching(false);
            }
        });

        return () => {
            port.disconnect();
            portRef.current = null;
        };
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            mountedRef.current = false;
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    // Perform search with debouncing
    const performSearch = useCallback((searchFilters: SearchFilters) => {
        if (!portRef.current) {
            setError('Search connection not available');
            return;
        }

        // Reset state
        setGroups([]);
        setTotal(0);
        setError(null);
        setIsSearching(true);

        // Clear previous timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        // Set new timeout
        searchTimeoutRef.current = window.setTimeout(() => {
            setError('Search timed out. Please try again.');
            setIsSearching(false);
        }, SEARCH_TIMEOUT);

        // Send search request
        const message: SearchPortMessage = {
            type: 'SEARCH',
            payload: searchFilters,
        };
        portRef.current.postMessage(message);
    }, []);

    // Debounced search effect
    useEffect(() => {
        // Clear previous debounce timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // If query is empty, clear results immediately
        if (!filters.query) {
            setGroups([]);
            setTotal(0);
            setIsSearching(false);
            setError(null);
            return;
        }

        // Debounce search
        debounceTimerRef.current = window.setTimeout(() => {
            performSearch(filters);
        }, DEBOUNCE_DELAY);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [filters, performSearch]);

    const refresh = useCallback(() => {
        if (filters.query) {
            performSearch(filters);
        }
    }, [filters, performSearch]);

    return {
        groups,
        total,
        isSearching,
        error,
        refresh,
    };
}
