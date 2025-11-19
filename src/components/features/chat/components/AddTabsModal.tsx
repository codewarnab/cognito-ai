import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from '../../../shared/icons/XIcon';

interface Tab {
    id: string;
    title: string;
    url: string;
    favIconUrl?: string;
}

interface AddTabsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddTabs: (tabs: Tab[]) => void;
}

export const AddTabsModal: React.FC<AddTabsModalProps> = ({
    isOpen,
    onClose,
    onAddTabs,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [allTabs, setAllTabs] = useState<Tab[]>([]);
    const [selectedTabs, setSelectedTabs] = useState<Set<string>>(new Set());
    const modalRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Fetch all tabs when modal opens
    useEffect(() => {
        if (isOpen) {
            chrome.tabs.query({}, (tabs) => {
                const formattedTabs: Tab[] = tabs
                    .filter(tab => {
                        if (tab.id === undefined) return false;
                        const url = tab.url || '';
                        // Restrict chrome internal pages, extensions, file, blob, and data URLs
                        const restrictedProtocols = [
                            'chrome://',
                            'chrome-extension://',
                            'file://',
                            'blob:',
                            'data:',
                            'about:',
                            'edge://',
                            'brave://',
                        ];
                        return !restrictedProtocols.some(protocol => url.startsWith(protocol));
                    })
                    .map(tab => ({
                        id: tab.id!.toString(),
                        title: tab.title || 'Untitled',
                        url: tab.url || '',
                        favIconUrl: tab.favIconUrl,
                    }));
                setAllTabs(formattedTabs);
            });
            // Focus search input when modal opens
            setTimeout(() => searchInputRef.current?.focus(), 100);
        } else {
            // Reset state when modal closes
            setSearchQuery('');
            setSelectedTabs(new Set());
        }
    }, [isOpen]);

    // Handle click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    // Hide voice-mode-fab when modal is open
    useEffect(() => {
        const voiceFab = document.querySelector('.voice-mode-fab') as HTMLElement;
        if (voiceFab) {
            if (isOpen) {
                voiceFab.style.visibility = 'hidden';
            } else {
                voiceFab.style.visibility = '';
            }
        }
    }, [isOpen]);

    const filteredTabs = allTabs.filter(tab =>
        tab.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tab.url.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleTab = (tabId: string) => {
        const newSelected = new Set(selectedTabs);
        if (newSelected.has(tabId)) {
            newSelected.delete(tabId);
        } else {
            newSelected.add(tabId);
        }
        setSelectedTabs(newSelected);
    };

    const handleAddTabs = () => {
        const tabsToAdd = allTabs.filter(tab => selectedTabs.has(tab.id));
        onAddTabs(tabsToAdd);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000,
                    padding: '20px',
                }}
            >
                <motion.div
                    ref={modalRef}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    style={{
                        backgroundColor: 'var(--modal-bg, #1e293b)',
                        borderRadius: '12px',
                        width: '100%',
                        maxWidth: '480px',
                        maxHeight: '70vh',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
                        border: '1px solid var(--modal-border, #334155)',
                    }}
                >
                    {/* Header */}
                    <div style={{
                        padding: '16px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}>
                        <h2 style={{
                            margin: 0,
                            fontSize: '18px',
                            fontWeight: 600,
                            color: 'var(--text-primary, #e2e8f0)',
                        }}>
                            Add tabs
                        </h2>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '4px',
                                color: 'var(--text-secondary, #94a3b8)',
                                transition: 'background-color 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--hover-bg, #334155)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                        >
                            <XIcon size={18} />
                        </button>
                    </div>

                    {/* Search Input */}
                    <div style={{ padding: '0 20px 12px 20px' }}>
                        <div style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                        }}>
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 20 20"
                                fill="none"
                                style={{
                                    position: 'absolute',
                                    left: '12px',
                                    color: 'var(--text-secondary, #94a3b8)',
                                }}
                            >
                                <path
                                    d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zM19 19l-4.35-4.35"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search tabs"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px 10px 38px',
                                    backgroundColor: 'var(--input-bg, #0f172a)',
                                    border: '1px solid var(--input-border, #334155)',
                                    borderRadius: '8px',
                                    color: 'var(--text-primary, #e2e8f0)',
                                    fontSize: '13px',
                                    outline: 'none',
                                }}
                            />
                        </div>
                    </div>

                    {/* Tabs List */}
                    <div 
                        className="tabs-list-scrollable"
                        style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '0 20px',
                        }}
                    >
                        <style>{`
                            .tabs-list-scrollable::-webkit-scrollbar {
                                width: 8px;
                            }
                            .tabs-list-scrollable::-webkit-scrollbar-track {
                                background: transparent;
                            }
                            .tabs-list-scrollable::-webkit-scrollbar-thumb {
                                background: var(--scrollbar-thumb, #475569);
                                border-radius: 4px;
                            }
                            .tabs-list-scrollable::-webkit-scrollbar-thumb:hover {
                                background: var(--scrollbar-thumb-hover, #64748b);
                            }
                        `}</style>
                        {filteredTabs.length === 0 ? (
                            <div style={{
                                padding: '32px 16px',
                                textAlign: 'center',
                                color: 'var(--text-secondary, #94a3b8)',
                                fontSize: '13px',
                            }}>
                                No tabs found
                            </div>
                        ) : (
                            filteredTabs.map(tab => (
                                <div
                                    key={tab.id}
                                    onClick={() => toggleTab(tab.id)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '10px 12px',
                                        marginBottom: '2px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        backgroundColor: selectedTabs.has(tab.id)
                                            ? 'var(--selected-bg, #334155)'
                                            : 'transparent',
                                        transition: 'background-color 0.15s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!selectedTabs.has(tab.id)) {
                                            e.currentTarget.style.backgroundColor = 'var(--hover-bg, #1e293b)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!selectedTabs.has(tab.id)) {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                        }
                                    }}
                                >
                                    {/* Favicon */}
                                    {tab.favIconUrl ? (
                                        <img
                                            src={tab.favIconUrl}
                                            alt=""
                                            style={{
                                                width: '18px',
                                                height: '18px',
                                                borderRadius: '3px',
                                                flexShrink: 0,
                                            }}
                                        />
                                    ) : (
                                        <div style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '3px',
                                            backgroundColor: 'var(--icon-bg, #475569)',
                                            flexShrink: 0,
                                        }} />
                                    )}

                                    {/* Tab Info */}
                                    <div style={{
                                        flex: 1,
                                        minWidth: 0,
                                        overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            fontSize: '13px',
                                            fontWeight: 500,
                                            color: 'var(--text-primary, #e2e8f0)',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }}>
                                            {tab.title}
                                        </div>
                                        <div style={{
                                            fontSize: '11px',
                                            color: 'var(--text-secondary, #94a3b8)',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            marginTop: '1px',
                                        }}>
                                            {tab.url}
                                        </div>
                                    </div>

                                    {/* Plus Icon */}
                                    <div style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        border: selectedTabs.has(tab.id)
                                            ? '2px solid var(--primary-color, #3b82f6)'
                                            : '2px solid var(--border-color, #475569)',
                                        backgroundColor: selectedTabs.has(tab.id)
                                            ? 'var(--primary-color, #3b82f6)'
                                            : 'transparent',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        transition: 'all 0.15s ease',
                                    }}>
                                        {selectedTabs.has(tab.id) && (
                                            <svg
                                                width="12"
                                                height="12"
                                                viewBox="0 0 14 14"
                                                fill="none"
                                            >
                                                <path
                                                    d="M2 7l3.5 3.5L12 3"
                                                    stroke="white"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div style={{
                        padding: '12px 20px',
                        borderTop: '1px solid var(--modal-border, #334155)',
                    }}>
                        <button
                            type="button"
                            onClick={handleAddTabs}
                            disabled={selectedTabs.size === 0}
                            style={{
                                width: '100%',
                                padding: '10px',
                                backgroundColor: selectedTabs.size === 0
                                    ? 'var(--button-disabled-bg, #475569)'
                                    : 'var(--primary-color, #3b82f6)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: selectedTabs.size === 0 ? 'not-allowed' : 'pointer',
                                opacity: selectedTabs.size === 0 ? 0.5 : 1,
                                transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                                if (selectedTabs.size > 0) {
                                    e.currentTarget.style.backgroundColor = 'var(--primary-hover, #2563eb)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (selectedTabs.size > 0) {
                                    e.currentTarget.style.backgroundColor = 'var(--primary-color, #3b82f6)';
                                }
                            }}
                        >
                            Add tabs {selectedTabs.size > 0 && `(${selectedTabs.size})`}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};