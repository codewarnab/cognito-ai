/**
 * History RAG Chat Interface
 * Chat-based interface powered by Chrome AI (Gemini Nano) with RAG
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useSettings } from './useSettings';
import { useHistoryRAG } from './useHistoryRAG';
import type { Toast } from './types';
import {
    HeaderBar,
    ToastContainer,
    Banner,
    HistoryMessageList,
    SettingsDrawer,
    ProcessingStatusDropdown,
} from './components';
import './history.css';

export default function HistoryPage() {
    // State
    const [inputValue, setInputValue] = useState('');
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
    const [indexStats, setIndexStats] = useState<{ docCount: number; approxBytes: number } | null>(null);
    const [queueStats, setQueueStats] = useState<{
        pending: number;
        failed: number;
        total: number;
        oldestPending?: { url: string; title?: string; age: number };
    } | null>(null);
    const [processingStatus, setProcessingStatus] = useState<{
        isProcessing: boolean;
        currentBatch: Array<{ url: string; title?: string }>;
        processingCount: number;
        processingDuration: number;
    } | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

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

    // RAG hook
    const {
        messages,
        isLoading,
        error: ragError,
        sendMessage,
        clearMessages,
        modelReady: ragModelReady
    } = useHistoryRAG({
        topK: 10
    });

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

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

                // Clear chat messages for privacy
                clearMessages();
            } catch (err) {
                addToast('Failed to delete data', 'error');
            }
        },
        [addToast, closeToast, clearMessages]
    );

    // Handler: Clear index
    const handleClearIndex = useCallback(async () => {
        try {
            await clearIndex();
            addToast('Index cleared successfully', 'success');
            clearMessages();
        } catch (err) {
            addToast('Failed to clear index', 'error');
        }
    }, [clearIndex, addToast, clearMessages]);

    // Handler: Submit message
    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading || !ragModelReady) return;

        const query = inputValue.trim();
        setInputValue('');
        
        try {
            await sendMessage(query);
        } catch (err) {
            console.error('[HistoryPage] Error sending message:', err);
        }
    }, [inputValue, isLoading, ragModelReady, sendMessage]);

    // Handler: Copy message
    const handleCopy = useCallback(async (content: string) => {
        try {
            await navigator.clipboard.writeText(content);
            addToast('Copied to clipboard', 'success', 2000);
        } catch (err) {
            addToast('Failed to copy', 'error', 2000);
        }
    }, [addToast]);

    // Show errors via toast
    useEffect(() => {
        if (ragError) {
            addToast(ragError, 'error');
        }
    }, [ragError, addToast]);

    useEffect(() => {
        if (settingsError) {
            addToast(settingsError, 'error');
        }
    }, [settingsError, addToast]);

    // Fetch index stats on mount and periodically
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await chrome.runtime.sendMessage({ type: 'GetIndexStats' });
                if (response && response.stats) {
                    setIndexStats(response.stats);
                }
            } catch (err) {
                console.error('Failed to fetch index stats:', err);
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 10000); // Update every 10 seconds

        return () => clearInterval(interval);
    }, []);

    // Fetch queue stats and processing status periodically
    useEffect(() => {
        const fetchQueueAndProcessing = async () => {
            try {
                // Fetch queue stats
                const queueResponse = await chrome.runtime.sendMessage({ type: 'GetQueueStats' });
                if (queueResponse && queueResponse.stats) {
                    setQueueStats(queueResponse.stats);
                }

                // Fetch processing status
                const processingResponse = await chrome.runtime.sendMessage({ type: 'GetProcessingStatus' });
                if (processingResponse && processingResponse.status) {
                    setProcessingStatus(processingResponse.status);
                }
            } catch (err) {
                console.error('Failed to fetch queue/processing stats:', err);
            }
        };

        fetchQueueAndProcessing();
        const interval = setInterval(fetchQueueAndProcessing, 2000); // Update every 2 seconds for more real-time feel

        return () => clearInterval(interval);
    }, []);

    // Render
    return (
        <div className="history-page history-chat-container">
            {/* Header with title and settings icon */}
            <div className="history-chat-header">
                <h1 className="history-header-title">💬 Chat with History</h1>
                <button
                    type="button"
                    className="history-settings-button"
                    onClick={() => setShowSettingsDrawer(true)}
                    aria-label="Open settings"
                    title="Settings"
                >
                    ⚙️
                </button>
            </div>

            {/* Banners */}
            {paused && (
                <Banner
                    type="warning"
                    message="History collection is paused. You can still chat about existing data."
                    action={{
                        label: 'Resume',
                        onClick: () => handlePauseToggle(false),
                    }}
                />
            )}

            {!ragModelReady && !modelReady && (
                <Banner
                    type="info"
                    message="Setting up the AI model. This may take a few moments..."
                />
            )}

            {modelReady && indexStats && indexStats.docCount === 0 && (
                <Banner
                    type="info"
                    message="Your search index is empty. Browse some websites to start building your history!"
                />
            )}

            {/* Processing Status Dropdown */}
            {modelReady && (
                <ProcessingStatusDropdown
                    queueStats={queueStats}
                    processingStatus={processingStatus}
                    indexStats={indexStats}
                />
            )}

            {/* Chat Messages */}
            <div className="history-chat-messages">
                <HistoryMessageList
                    messages={messages}
                    isLoading={isLoading}
                    onCopy={handleCopy}
                />
                <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="history-chat-input-form">
                <div className="history-chat-input-container">
                    <textarea
                        className="history-chat-input"
                        placeholder="Ask me anything about your browsing history..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e);
                            }
                        }}
                        rows={2}
                        disabled={!ragModelReady || isLoading}
                    />
                    <button
                        type="submit"
                        className="history-chat-send-button"
                        disabled={!inputValue.trim() || !ragModelReady || isLoading}
                        aria-label="Send message"
                    >
                        {isLoading ? '⏳' : '📤'}
                    </button>
                </div>
            </form>

            {/* Settings Drawer */}
            <SettingsDrawer
                open={showSettingsDrawer}
                onClose={() => setShowSettingsDrawer(false)}
                paused={paused}
                domainAllowlist={domainAllowlist || []}
                domainDenylist={domainDenylist || []}
                onPauseToggle={handlePauseToggle}
                onAllowlistUpdate={handleAllowlistUpdate}
                onDenylistUpdate={handleDenylistUpdate}
                onDeleteAllData={handleDeleteAllData}
                disabled={settingsLoading || isLoading}
            />

            {/* Toast notifications */}
            <ToastContainer toasts={toasts} onClose={closeToast} />
        </div>
    );
}
