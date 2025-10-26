import React, { useState, useEffect } from 'react';
import { PanelRightOpen, Plus, Wrench, MoreHorizontal } from 'lucide-react';
import { GeminiApiKeyDialog } from '../GeminiApiKeyDialog';

interface ChatHeaderProps {
    onSettingsClick?: () => void;
    onThreadsClick?: () => void;
    onNewThreadClick?: () => void;
    onMemoryClick?: () => void;
    onRemindersClick?: () => void;
    onApiKeySaved?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
    onSettingsClick,
    onThreadsClick,
    onNewThreadClick,
    onMemoryClick,
    onRemindersClick,
    onApiKeySaved,
}) => {
    const [showHeaderMenu, setShowHeaderMenu] = useState(false);
    const [showGeminiDialog, setShowGeminiDialog] = useState(false);

    useEffect(() => {
        const handleClickOutside = () => setShowHeaderMenu(false);
        if (showHeaderMenu) {
            window.addEventListener('click', handleClickOutside, { once: true });
        }
        return () => window.removeEventListener('click', handleClickOutside);
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
                    <div className="copilot-header-menu-wrapper">
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
                            <div className="copilot-header-menu" onClick={(e) => e.stopPropagation()}>
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
                                        setShowGeminiDialog(true);
                                    }}
                                >
                                    Gemini API Key Setup
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Gemini API Key Dialog */}
            <GeminiApiKeyDialog
                isOpen={showGeminiDialog}
                onClose={() => setShowGeminiDialog(false)}
                onApiKeySaved={onApiKeySaved}
            />
        </div>
    );
};
