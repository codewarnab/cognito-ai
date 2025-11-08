import React, { useState, useEffect, useRef } from 'react';
import { PanelRightOpen, Plus, Wrench, MoreHorizontal } from 'lucide-react';
import { ProviderSetupDialog } from '../../../shared/dialogs';
import { getActiveProvider, hasAnyProviderConfigured } from '../../../../utils/providerCredentials';
import { getModelConfig } from '../../../../utils/modelSettings';
import type { AIProvider } from '../../../../utils/providerTypes';

interface ChatHeaderProps {
    onSettingsClick?: () => void;
    onThreadsClick?: () => void;
    onNewThreadClick?: () => void;
    onMemoryClick?: () => void;
    onRemindersClick?: () => void;
    onTroubleshootingClick?: () => void;
    onFeaturesClick?: () => void;
    onApiKeySaved?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
    onSettingsClick,
    onThreadsClick,
    onNewThreadClick,
    onMemoryClick,
    onRemindersClick,
    onTroubleshootingClick,
    onFeaturesClick,
    onApiKeySaved,
}) => {
    const [showHeaderMenu, setShowHeaderMenu] = useState(false);
    const [showProviderDialog, setShowProviderDialog] = useState(false);
    const [activeProvider, setActiveProvider] = useState<AIProvider | 'local' | 'none'>('none');
    const [currentMode, setCurrentMode] = useState<'local' | 'remote'>('local');
    const menuRef = useRef<HTMLDivElement>(null);

    // Load active provider and mode on mount and when API key is saved
    useEffect(() => {
        loadProviderInfo();
    }, [onApiKeySaved]);

    const loadProviderInfo = async () => {
        try {
            const config = await getModelConfig();
            setCurrentMode(config.mode);

            if (config.mode === 'local') {
                setActiveProvider('local');
            } else {
                const hasProvider = await hasAnyProviderConfigured();
                if (hasProvider) {
                    const provider = await getActiveProvider();
                    setActiveProvider(provider);
                } else {
                    setActiveProvider('none');
                }
            }
        } catch (error) {
            console.error('Failed to load provider info:', error);
            setActiveProvider('none');
        }
    };

    const getProviderLabel = () => {
        if (currentMode === 'local') return 'Local (Gemini Nano)';
        if (activeProvider === 'google') return 'Remote (Google AI)';
        if (activeProvider === 'vertex') return 'Remote (Vertex AI)';
        return 'No Provider';
    };

    const getProviderColor = () => {
        if (currentMode === 'local') return '#10b981'; // green
        if (activeProvider === 'google') return '#4a6fa5'; // blue
        if (activeProvider === 'vertex') return '#8b5cf6'; // purple
        return '#ef4444'; // red for no provider
    };

    // Handle clicks outside menu to close it
    useEffect(() => {
        if (!showHeaderMenu) return;

        const handleClickOutside = (event: MouseEvent) => {
            // Check if click is outside the menu wrapper
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowHeaderMenu(false);
            }
        };

        // Add listener on next tick to avoid immediate closure
        const timeoutId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showHeaderMenu]);

    return (
        <div className="copilot-header">
            <div className="copilot-header-content">
                {/* Sidebar toggle */}
                <div className="copilot-header-left">
                    {onThreadsClick && (
                        <button
                            className="copilot-header-button"
                            onClick={onThreadsClick}
                            title="Open chat history"
                            aria-label="Open chat history"
                        >
                            <PanelRightOpen size={18} />
                        </button>
                    )}

                    {/* Provider Indicator Badge */}
                    {activeProvider !== 'none' && (
                        <div
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                padding: '0.25rem 0.625rem',
                                borderRadius: '12px',
                                fontSize: '0.6875rem',
                                fontWeight: 500,
                                backgroundColor: `${getProviderColor()}15`,
                                color: getProviderColor(),
                                border: `1px solid ${getProviderColor()}30`,
                                marginLeft: '0.5rem',
                                cursor: 'help',
                            }}
                            title={`Current AI provider: ${getProviderLabel()}`}
                        >
                            <span
                                style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    backgroundColor: getProviderColor(),
                                }}
                            />
                            <span>{getProviderLabel()}</span>
                        </div>
                    )}
                </div>

                {/* Action Buttons: Plus, Tools, Kebab (right-aligned) */}
                <div className="copilot-header-actions">
                    {/* New Thread (Plus) */}
                    {onNewThreadClick && (
                        <button
                            className="copilot-header-button"
                            onClick={onNewThreadClick}
                            title="New Chat"
                            aria-label="Start new chat"
                        >
                            <Plus size={16} />
                        </button>
                    )}

                    {/* Tools / Settings (Wrench) */}
                    {onSettingsClick && (
                        <button
                            className="copilot-header-button"
                            onClick={onSettingsClick}
                            title="MCP Server Settings"
                            aria-label="Open MCP settings"
                        >
                            <Wrench size={16} />
                        </button>
                    )}

                    {/* Kebab Menu (Three dots) */}
                    <div className="copilot-header-menu-wrapper" ref={menuRef}>
                        <button
                            className="copilot-header-button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowHeaderMenu((v) => !v);
                            }}
                            title="More options"
                            aria-label="More options"
                        >
                            <MoreHorizontal size={18} />
                        </button>

                        {showHeaderMenu && (
                            <div className="copilot-header-menu">
                                <button
                                    className="copilot-header-menu-item"
                                    onClick={() => {
                                        setShowHeaderMenu(false);
                                        onMemoryClick?.();
                                    }}
                                >
                                    Memory Management
                                </button>
                                <button
                                    className="copilot-header-menu-item"
                                    onClick={() => {
                                        setShowHeaderMenu(false);
                                        onRemindersClick?.();
                                    }}
                                >
                                    Reminders
                                </button>
                                <button
                                    className="copilot-header-menu-item"
                                    onClick={() => {
                                        setShowHeaderMenu(false);
                                        onTroubleshootingClick?.();
                                    }}
                                >
                                    Troubleshooting
                                </button>
                                <button
                                    className="copilot-header-menu-item"
                                    onClick={() => {
                                        setShowHeaderMenu(false);
                                        onFeaturesClick?.();
                                    }}
                                >
                                    Features
                                </button>
                                <button
                                    className="copilot-header-menu-item"
                                    onClick={() => {
                                        setShowHeaderMenu(false);
                                        setShowProviderDialog(true);
                                    }}
                                >
                                    AI Provider Setup
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* AI Provider Setup Dialog */}
            <ProviderSetupDialog
                isOpen={showProviderDialog}
                onClose={() => setShowProviderDialog(false)}
                onConfigSaved={() => {
                    loadProviderInfo(); // Reload provider info when saved
                    onApiKeySaved?.();
                }}
            />
        </div>
    );
};
