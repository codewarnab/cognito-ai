import React, { useState, useEffect, useRef } from 'react';
import { PanelRightOpen, Plus, Wrench, MoreHorizontal } from 'lucide-react';
import { GeminiApiKeyDialog } from '../GeminiApiKeyDialog';

interface ChatHeaderProps {
    onSettingsClick?: () => void;
    onThreadsClick?: () => void;
    onNewThreadClick?: () => void;
    onMemoryClick?: () => void;
    onRemindersClick?: () => void;
    onTroubleshootingClick?: () => void;
    onApiKeySaved?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
    onSettingsClick,
    onThreadsClick,
    onNewThreadClick,
    onMemoryClick,
    onRemindersClick,
    onTroubleshootingClick,
    onApiKeySaved,
}) => {
    const [showHeaderMenu, setShowHeaderMenu] = useState(false);
    const [showGeminiDialog, setShowGeminiDialog] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

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
