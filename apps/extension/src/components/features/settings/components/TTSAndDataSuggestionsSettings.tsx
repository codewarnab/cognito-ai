import React, { useEffect, useState } from 'react';
import { MessageSquare, Trash2 } from 'lucide-react';
import { createLogger } from '~logger';
import { getTTSProvider, setTTSProvider, getSuggestionsEnabled, setSuggestionsEnabled } from '@/utils/settings';
import type { TTSProvider } from '../../../../types/settings';
import { clearChatHistory, getDBStats } from '../../../../db';
import { Toggle } from '../../../shared/inputs/Toggle';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/primitives';

const log = createLogger('TTSAndDataSettings', 'UI_SETTINGS');

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

    const handleTTSProviderChange = async (value: TTSProvider) => {
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
        <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center mb-1">
                <h2 className="text-[15px] font-semibold text-[var(--text-primary)] m-0 uppercase tracking-wide">
                    <MessageSquare size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
                    TTS & Data , Suggestions
                </h2>
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl overflow-visible">
                {/* Suggestions Toggle */}
                <div className="flex items-center justify-between p-3 border-b border-[var(--border-color)] transition-colors hover:bg-white/5 last:border-b-0">
                    <div className="flex-1 mr-4">
                        <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Show Suggested Actions</div>
                        <div className="text-xs text-[var(--text-secondary)]">
                            Display AI-generated action suggestions when starting a new chat
                        </div>
                    </div>
                    <Toggle
                        checked={suggestionsEnabled}
                        onChange={handleSuggestionsToggle}
                    />
                </div>

                {/* TTS Provider Selection */}
                <div className="flex flex-col items-start gap-3 p-3 border-b border-[var(--border-color)] transition-colors hover:bg-white/5 last:border-b-0">
                    <div className="w-full mr-0 mb-1">
                        <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Text-to-Speech Provider</div>
                        <div className="text-xs text-[var(--text-secondary)]">
                            {TTS_OPTIONS.find(opt => opt.value === ttsProvider)?.description}
                        </div>
                    </div>
                    <div className="w-full">
                        <Select
                            value={ttsProvider}
                            onValueChange={handleTTSProviderChange}
                        >
                            <SelectTrigger className="w-full bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-primary)]">
                                <SelectValue placeholder="Select TTS provider" />
                            </SelectTrigger>
                            <SelectContent className="bg-[var(--bg-tertiary)] border-[var(--border-color)]">
                                {TTS_OPTIONS.map(opt => (
                                    <SelectItem
                                        key={opt.value}
                                        value={opt.value}
                                        className="text-[var(--text-primary)] focus:bg-white/10 focus:text-[var(--text-primary)]"
                                    >
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Delete All Chats */}
                <div className="flex flex-col items-start gap-3 p-3 border-b border-[var(--border-color)] transition-colors hover:bg-white/5 last:border-b-0">
                    <div className="w-full mr-0">
                        <div className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Delete All Chats</div>
                        <div className="text-xs text-[var(--text-secondary)]">
                            Permanently remove all chat history and conversations
                            {storageSize && ` (${storageSize})`}
                        </div>
                    </div>
                    {showDeleteConfirm ? (
                        <div className="flex gap-2 items-center w-full">
                            <button
                                className="flex-1 flex items-center justify-center whitespace-nowrap px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] text-[13px] font-medium cursor-pointer transition-all hover:bg-white/10 hover:border-white/20"
                                onClick={handleCancelDelete}
                                disabled={isDeleting}
                            >
                                Cancel
                            </button>
                            <button
                                className="flex-1 flex items-center justify-center whitespace-nowrap px-3 py-1.5 bg-[var(--bg-tertiary)] border border-red-500/30 rounded-lg text-red-500 text-[13px] font-medium cursor-pointer transition-all hover:bg-red-500/10"
                                onClick={handleDeleteAllChats}
                                disabled={isDeleting}
                            >
                                <Trash2 size={14} style={{ marginRight: 4 }} />
                                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                            </button>
                        </div>
                    ) : (
                        <button
                            className="w-full justify-center px-3 py-1.5 bg-[var(--bg-tertiary)] border border-red-500/30 rounded-lg text-red-500 text-[13px] font-medium cursor-pointer transition-all hover:bg-red-500/10 flex items-center"
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
