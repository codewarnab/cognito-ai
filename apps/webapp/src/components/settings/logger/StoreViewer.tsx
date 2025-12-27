'use client';

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
    Database,
    RefreshCw,
    ChevronRight,
    ChevronDown,
    Copy,
    Check,
    AlertCircle,
    Search,
    CopyPlus,
} from 'lucide-react';

// Use environment variable for extension ID
const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID;

// List of stores to fetch
const STORE_NAMES = [
    'settings',
    'uiNavigation',
    'model',
    'chat',
    'attachments',
    'tools',
    'voiceMode',
    'mcp',
    'approval',
] as const;

type StoreName = typeof STORE_NAMES[number];

interface StoreData {
    [key: string]: unknown;
}

interface StoresState {
    [storeName: string]: StoreData;
}

export function StoreViewer() {
    const [storesState, setStoresState] = useState<StoresState | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set());
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchStores = useCallback(async () => {
        if (!EXTENSION_ID) {
            setError('NEXT_PUBLIC_EXTENSION_ID not configured');
            return;
        }

        if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
            setError('Chrome runtime API not available');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            chrome.runtime.sendMessage(
                EXTENSION_ID,
                { type: 'GET_STORES_STATE', payload: { stores: STORE_NAMES } },
                (response) => {
                    const lastError = chrome.runtime.lastError;
                    if (lastError) {
                        setError(lastError.message || 'Failed to fetch stores');
                        setLoading(false);
                        return;
                    }

                    if (response?.success) {
                        setStoresState(response.data);
                    } else {
                        setError(response?.error || 'Failed to fetch stores');
                    }
                    setLoading(false);
                }
            );
        } catch (e) {
            setError(String(e));
            setLoading(false);
        }
    }, []);

    const toggleStore = (storeName: string) => {
        setExpandedStores((prev) => {
            const next = new Set(prev);
            if (next.has(storeName)) {
                next.delete(storeName);
            } else {
                next.add(storeName);
            }
            return next;
        });
    };

    const copyToClipboard = async (key: string, data: unknown) => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(null), 2000);
        } catch {
            // Silently fail
        }
    };

    const copyAllStores = async () => {
        if (!storesState) return;
        await copyToClipboard('all', storesState);
    };

    // Filter stores based on search query
    const filteredStores = storesState
        ? Object.entries(storesState).filter(([name, data]) => {
            if (!searchQuery) return true;
            const query = searchQuery.toLowerCase();
            // Search in store name
            if (name.toLowerCase().includes(query)) return true;
            // Search in stringified data
            return JSON.stringify(data).toLowerCase().includes(query);
        })
        : [];

    return (
        <div className="flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl border border-[var(--border-color)] overflow-hidden shadow-sm h-[600px]">
            {/* Header */}
            <div className="flex items-center p-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] gap-3 shrink-0">
                <div className="flex items-center gap-2">
                    <Database size={16} className="text-[var(--text-secondary)]" />
                    <span className="text-sm font-medium text-[var(--text-secondary)]">
                        Zustand Stores
                    </span>
                </div>

                <div className="flex-1" />

                {storesState && (
                    <div className="flex items-center bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg px-2 py-1.5">
                        <Search size={14} className="text-[var(--text-tertiary)] mr-2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search stores..."
                            className="bg-transparent border-none outline-none text-xs w-32 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                        />
                    </div>
                )}

                {storesState && (
                    <button
                        onClick={copyAllStores}
                        className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-md transition-colors cursor-pointer"
                        title="Copy all stores"
                    >
                        {copiedKey === 'all' ? (
                            <Check size={16} className="text-green-500" />
                        ) : (
                            <CopyPlus size={16} />
                        )}
                    </button>
                )}

                <button
                    onClick={fetchStores}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                    <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
                    {loading ? 'Fetching...' : storesState ? 'Refresh' : 'Fetch Stores'}
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {error && (
                    <div className="flex items-center gap-2 p-4 text-red-400 bg-red-500/10 border-b border-red-500/20">
                        <AlertCircle size={16} />
                        <span className="text-sm">{error}</span>
                    </div>
                )}

                {!storesState && !loading && !error && (
                    <div className="flex flex-col items-center justify-center h-full text-[var(--text-tertiary)] gap-3">
                        <Database size={48} className="opacity-20" />
                        <p className="text-sm">Click &quot;Fetch Stores&quot; to inspect Zustand store states</p>
                    </div>
                )}

                {storesState && filteredStores.length === 0 && (
                    <div className="flex items-center justify-center h-full text-[var(--text-tertiary)]">
                        <p className="text-xs">No stores match your search</p>
                    </div>
                )}

                {storesState && filteredStores.length > 0 && (
                    <div className="divide-y divide-[var(--border-color)]">
                        {filteredStores.map(([storeName, storeData]) => (
                            <div key={storeName}>
                                {/* Store Header */}
                                <div
                                    onClick={() => toggleStore(storeName)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => e.key === 'Enter' && toggleStore(storeName)}
                                    className="w-full flex items-center gap-2 p-3 hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer text-left"
                                >
                                    {expandedStores.has(storeName) ? (
                                        <ChevronDown size={16} className="text-[var(--text-tertiary)]" />
                                    ) : (
                                        <ChevronRight size={16} className="text-[var(--text-tertiary)]" />
                                    )}
                                    <span className="text-sm font-medium text-[var(--text-primary)]">
                                        {storeName}Store
                                    </span>
                                    <span className="text-xs text-[var(--text-tertiary)] ml-2">
                                        {Object.keys(storeData as object).length} keys
                                    </span>
                                    <div className="flex-1" />
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            copyToClipboard(storeName, storeData);
                                        }}
                                        className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded transition-colors cursor-pointer"
                                        title={`Copy ${storeName}Store`}
                                    >
                                        {copiedKey === storeName ? (
                                            <Check size={14} className="text-green-500" />
                                        ) : (
                                            <Copy size={14} />
                                        )}
                                    </button>
                                </div>

                                {/* Store Content */}
                                {expandedStores.has(storeName) && (
                                    <div className="bg-[var(--bg-tertiary)] border-t border-[var(--border-color)]">
                                        <div className="p-3 overflow-x-auto">
                                            <pre className="text-xs font-mono text-[var(--text-secondary)] whitespace-pre-wrap break-all">
                                                {JSON.stringify(storeData, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
