import React, { useEffect, useState } from 'react';
import { MessageSquare, Trash2, ChevronDown } from 'lucide-react';
import { createLogger } from '~logger';
import { getTTSProvider, setTTSProvider, getSuggestionsEnabled, setSuggestionsEnabled } from '~utils/settingsStorage';
import type { TTSProvider } from '../../../../types/settings';
import { clearChatHistory, getDBStats } from '../../../../db';
import { Toggle } from '../../../shared/inputs/Toggle';

const log = createLogger('TTSAndDataSettings');

const TTS_OPTIONS: { value: TTSProvider; label: string; description: string }[] = [
    { value: 'gemini', label: 'Gemini TTS', description: 'High-quality AI-powered text-to-speech' },
    { value: 'web-native', label: 'Web Native TTS', description: 'Browser built-in text-to-speech' },
];

export const TTSAndDataSettings: React.FC = () => {
    const [ttsProvider, setTTSProviderState] = useState<TTSProvider>('gemini');
    const [suggestionsEnabled, setSuggestionsEnabledState] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [storageSize, setStorageSize] = useState<string>('');
    const [hasChats, setHasChats] = useState(false);

    const updateChatStats = async () => {
        try {
            const stats = await getDBStats();
            setHasChats(stats.chatMessageCount > 0 || stats.threadCount > 0);
        } catch (err) {
            log.error('Failed to get chat stats', err);
        }
    };

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const provider = await getTTSProvider();
                setTTSProviderState(provider);
                const enabled = await getSuggestionsEnabled();
                setSuggestionsEnabledState(enabled);
            } catch (err) {
                log.error('Failed to load settings', err);
            }
        };
        loadSettings();
        updateChatStats();
    }, []);

    useEffect(() => {
        const calculateStorageSize = async () => {
            try {
                // Estimate storage size based on IndexedDB
                if ('storage' in navigator && 'estimate' in navigator.storage) {
                    const estimate = await navigator.storage.estimate();
                    const usage = estimate.usage || 0;
                    setStorageSize(formatBytes(usage));
                }
            } catch (err) {
                log.error('Failed to calculate storage size', err);
            }
        };
        calculateStorageSize();
        updateChatStats();
    }, [isDeleting]);

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const handleTTSProviderChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value as TTSProvider;
        setTTSProviderState(value);
        try {
            await setTTSProvider(value);
            log.info('TTS provider updated', { provider: value });
        } catch (err) {
            log.error('Failed to save TTS provider', err);
        }
    };

    const handleSuggestionsToggle = async (enabled: boolean) => {
        setSuggestionsEnabledState(enabled);
        try {
            await setSuggestionsEnabled(enabled);
            log.info('Suggestions setting updated', { enabled });
        } catch (err) {
            log.error('Failed to save suggestions setting', err);
        }
    };

    const handleDeleteAllChats = async () => {
        if (!showDeleteConfirm) {
            setShowDeleteConfirm(true);
            return;
        }

        setIsDeleting(true);
        try {
            await clearChatHistory();
            log.info('All chats deleted successfully');
            setShowDeleteConfirm(false);
            setHasChats(false);
            // Show success feedback
            setTimeout(() => {
                setIsDeleting(false);
            }, 500);
        } catch (err) {
            log.error('Failed to delete chats', err);
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleCancelDelete = () => {
        setShowDeleteConfirm(false);
    };

    return (
        <div className="settings-section">
            <div className="settings-section-header">
                <h2 className="settings-section-title">
                    <MessageSquare size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
                    TTS & Data , Suggestions
                </h2>
            </div>
            <div className="settings-card">
                {/* Suggestions Toggle */}
                <div className="settings-item">
                    <div className="settings-item-content">
                        <div className="settings-item-title">Show Suggested Actions</div>
                        <div className="settings-item-description">
                            Display AI-generated action suggestions when starting a new chat
                        </div>
                    </div>
                    <Toggle
                        checked={suggestionsEnabled}
                        onChange={handleSuggestionsToggle}
                    />
                </div>

                {/* TTS Provider Selection */}
                <div className="settings-item tts-settings-item">
                    <div className="settings-item-content">
                        <div className="settings-item-title">Text-to-Speech Provider</div>
                        <div className="settings-item-description">
                            {TTS_OPTIONS.find(opt => opt.value === ttsProvider)?.description}
                        </div>
                    </div>
                    <div className="tts-select-wrapper">
                        <select
                            className="settings-select tts-select"
                            value={ttsProvider}
                            onChange={handleTTSProviderChange}
                        >
                            {TTS_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="tts-select-arrow" />
                    </div>
                </div>

                {/* Delete All Chats */}
                <div className="settings-item delete-chats-item">
                    <div className="settings-item-content">
                        <div className="settings-item-title">Delete All Chats</div>
                        <div className="settings-item-description">
                            Permanently remove all chat history and conversations
                            {storageSize && ` (${storageSize})`}
                        </div>
                    </div>
                    {showDeleteConfirm ? (
                        <div className="delete-chats-actions">
                            <button
                                className="settings-button"
                                onClick={handleCancelDelete}
                                disabled={isDeleting}
                            >
                                Cancel
                            </button>
                            <button
                                className="settings-button danger"
                                onClick={handleDeleteAllChats}
                                disabled={isDeleting}
                            >
                                <Trash2 size={14} style={{ marginRight: 4 }} />
                                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                            </button>
                        </div>
                    ) : (
                        <button
                            className="settings-button danger delete-all-btn"
                            onClick={handleDeleteAllChats}
                            disabled={!hasChats}
                        >
                            <Trash2 size={14} style={{ marginRight: 4 }} />
                            Delete All
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
