import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from './ui/dialog';
import { createLogger } from '../logger';
import { getGeminiApiKey, setGeminiApiKey, removeGeminiApiKey } from '../utils/geminiApiKey';

const log = createLogger('GeminiApiKeyDialog');

interface GeminiApiKeyDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export const GeminiApiKeyDialog: React.FC<GeminiApiKeyDialogProps> = ({
    isOpen,
    onClose,
}) => {
    const [apiKey, setApiKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

    // Load existing API key when dialog opens
    useEffect(() => {
        if (isOpen) {
            loadApiKey();
            setNotification(null); // Clear notifications when dialog opens
        }
    }, [isOpen]);

    const loadApiKey = async () => {
        try {
            setIsLoading(true);
            const key = await getGeminiApiKey();
            if (key) {
                setApiKey(key);
                log.info('Loaded existing API key');
            }
        } catch (error) {
            log.error('Failed to load API key', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!apiKey.trim()) {
            setNotification({ type: 'error', message: 'Please enter an API key' });
            return;
        }

        try {
            setIsSaving(true);
            setNotification(null);
            await setGeminiApiKey(apiKey.trim());
            log.info('Gemini API key saved successfully');
            setNotification({ type: 'success', message: 'API key saved successfully!' });
            // Close dialog after a short delay to show success message
            setTimeout(() => {
                onClose();
            }, 1000);
        } catch (error) {
            log.error('Failed to save API key', error);
            setNotification({ type: 'error', message: 'Failed to save API key. Please try again.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemove = async () => {
        try {
            setIsSaving(true);
            setNotification(null);
            await removeGeminiApiKey();
            setApiKey('');
            log.info('Gemini API key removed');
            setNotification({ type: 'success', message: 'API key removed successfully' });
        } catch (error) {
            log.error('Failed to remove API key', error);
            setNotification({ type: 'error', message: 'Failed to remove API key. Please try again.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Gemini API Key Setup</DialogTitle>
                    <DialogDescription>
                        Enter your Google AI Studio API key to enable Gemini AI features.
                    </DialogDescription>
                </DialogHeader>

                {/* Notification */}
                {notification && (
                    <div
                        style={{
                            padding: '0.75rem',
                            borderRadius: '8px',
                            fontSize: '0.875rem',
                            border: '1px solid',
                            backgroundColor: notification.type === 'success'
                                ? 'rgba(76, 175, 80, 0.1)'
                                : notification.type === 'error'
                                    ? 'rgba(239, 68, 68, 0.1)'
                                    : 'rgba(74, 111, 165, 0.1)',
                            borderColor: notification.type === 'success'
                                ? 'rgba(76, 175, 80, 0.3)'
                                : notification.type === 'error'
                                    ? 'rgba(239, 68, 68, 0.3)'
                                    : 'rgba(74, 111, 165, 0.3)',
                            color: notification.type === 'success'
                                ? '#4caf50'
                                : notification.type === 'error'
                                    ? '#ef4444'
                                    : '#4a6fa5',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                        }}
                    >
                        <span style={{ fontSize: '1rem' }}>
                            {notification.type === 'success' ? '✓' : notification.type === 'error' ? '✕' : 'ℹ'}
                        </span>
                        <span>{notification.message}</span>
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* API Key Input */}
                    <div>
                        <label
                            htmlFor="api-key-input"
                            style={{
                                display: 'block',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                marginBottom: '0.5rem',
                                color: 'var(--text-secondary)',
                            }}
                        >
                            API Key
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                id="api-key-input"
                                type={showKey ? 'text' : 'password'}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Enter your Gemini API key"
                                disabled={isLoading || isSaving}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    paddingRight: '4rem',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    fontSize: '0.875rem',
                                    background: 'var(--bg-tertiary)',
                                    color: 'var(--text-primary)',
                                    transition: 'all 0.2s ease',
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = 'var(--border-color-focus)';
                                    e.target.style.background = 'var(--bg-quaternary)';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = 'var(--border-color)';
                                    e.target.style.background = 'var(--bg-tertiary)';
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                style={{
                                    position: 'absolute',
                                    right: '0.5rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    fontSize: '0.75rem',
                                    color: 'var(--text-tertiary)',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '4px',
                                    transition: 'all 0.2s ease',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.color = 'var(--text-primary)';
                                    e.currentTarget.style.background = 'var(--glass-bg-hover)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.color = 'var(--text-tertiary)';
                                    e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                {showKey ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </div>

                    {/* Help Text */}
                    <div
                        style={{
                            padding: '0.75rem',
                            backgroundColor: 'var(--bg-tertiary)',
                            borderRadius: '8px',
                            fontSize: '0.875rem',
                            border: '1px solid var(--border-color)',
                        }}
                    >
                        <p style={{ margin: 0, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                            Don't have an API key?
                        </p>
                        <a
                            href="https://aistudio.google.com/api-keys"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                color: '#1264FF',
                                textDecoration: 'underline',
                            }}
                        >
                            Get your API key from Google AI Studio →
                        </a>
                    </div>
                </div>

                <DialogFooter>
                    {apiKey && !notification && (
                        <button
                            onClick={handleRemove}
                            disabled={isSaving}
                            className="dialog-button dialog-button-secondary"
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '8px',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'transparent',
                                color: 'rgba(239, 68, 68, 0.8)',
                                cursor: 'pointer',
                                opacity: isSaving ? 0.5 : 1,
                                transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                                if (!isSaving) {
                                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                                    e.currentTarget.style.color = 'rgba(239, 68, 68, 1)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = 'rgba(239, 68, 68, 0.8)';
                            }}
                        >
                            Remove
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="dialog-button dialog-button-secondary"
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--glass-bg)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            opacity: isSaving ? 0.5 : 1,
                            transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                            if (!isSaving) {
                                e.currentTarget.style.backgroundColor = 'var(--glass-bg-hover)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--glass-bg)';
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!apiKey.trim() || isSaving}
                        className="dialog-button dialog-button-primary"
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            backgroundColor: '#4a6fa5',
                            color: 'white',
                            border: 'none',
                            cursor: apiKey.trim() && !isSaving ? 'pointer' : 'not-allowed',
                            opacity: !apiKey.trim() || isSaving ? 0.5 : 1,
                            transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                            if (apiKey.trim() && !isSaving) {
                                e.currentTarget.style.backgroundColor = '#5a7fb5';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#4a6fa5';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        {isSaving ? 'Saving...' : 'Save'}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
