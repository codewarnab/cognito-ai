import React, { useState, useEffect, useRef } from 'react';
import { PanelRightOpen, Plus, Wrench, MoreHorizontal } from 'lucide-react';
import { ClockIcon } from '@assets/icons/chat/clock';
import { StreamingWarningDialog } from '../../context/StreamingWarningDialog';

interface ChatHeaderProps {
    onSettingsClick?: () => void;
    onGeneralSettingsClick?: () => void;
    onThreadsClick?: () => void;
    onNewThreadClick?: () => void;
    onRemindersClick?: () => void;
    onTroubleshootingClick?: () => void;
    onFeaturesClick?: () => void;
    onProviderSetupClick?: () => void;
    onLoggerPanelClick?: () => void;
    isLoading?: boolean;
    needsProviderSetup?: boolean;
}

// Header button styles
const headerButtonClasses = `
    p-1.5 bg-transparent border-none cursor-pointer
    text-white/70 transition-all duration-200 ease-out
    flex items-center justify-center
    min-w-8 h-8 rounded-md
    hover:bg-white/10 hover:text-white/90 hover:-translate-y-px
    focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500/50 focus-visible:outline-offset-2
`;

// MenuItem component with hover state handling
const MenuItem: React.FC<{
    onClick: () => void;
    children: React.ReactNode;
    glow?: boolean;
}> = ({ onClick, children, glow }) => {
    const [isHovered, setIsHovered] = useState(false);

    const baseStyle: React.CSSProperties = {
        width: '100%',
        textAlign: 'left',
        padding: '8px 12px',
        background: isHovered ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
        border: 'none',
        color: glow ? 'rgba(147, 197, 253, 1)' : 'rgba(255, 255, 255, 0.9)',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        textShadow: glow ? '0 0 8px rgba(147, 197, 253, 0.6)' : 'none',
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        // Use setTimeout to ensure the menu closes first and the state update happens on next tick
        setTimeout(() => {
            onClick();
        }, 0);
    };

    return (
        <button
            style={baseStyle}
            onClick={handleClick}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {children}
        </button>
    );
};


export const ChatHeader: React.FC<ChatHeaderProps> = ({
    onSettingsClick,
    onGeneralSettingsClick,
    onThreadsClick,
    onNewThreadClick,
    onRemindersClick,
    onTroubleshootingClick,
    onFeaturesClick,
    onProviderSetupClick,
    onLoggerPanelClick,
    isLoading,
    needsProviderSetup,
}) => {
    const [showHeaderMenu, setShowHeaderMenu] = useState(false);
    const [showStreamingWarning, setShowStreamingWarning] = useState(false);
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
        <div className="absolute top-0 left-0 right-0 z-50 pt-2 px-3 bg-[#0a0e1a]/80 backdrop-blur-md shrink-0 min-h-[32px]">
            <div className="flex items-center justify-between gap-2 w-full">
                {/* Sidebar toggle */}
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    {onThreadsClick && (
                        <button
                            className={headerButtonClasses}
                            onClick={onThreadsClick}
                            title="Open chat history"
                            aria-label="Open chat history"
                        >
                            <PanelRightOpen size={18} />
                        </button>
                    )}
                </div>

                {/* Action Buttons: Plus, Tools, Kebab (right-aligned) */}
                <div className="flex items-center gap-1 shrink-0 ml-auto">
                    {/* New Thread (Plus) */}
                    {onNewThreadClick && (
                        <button
                            className={headerButtonClasses}
                            onClick={() => {
                                // Show warning if message is being streamed
                                if (isLoading) {
                                    setShowStreamingWarning(true);
                                    return;
                                }
                                onNewThreadClick();
                            }}
                            title="New Chat (Ctrl+N)"
                            aria-label="Start new chat"
                        >
                            <Plus size={16} />
                        </button>
                    )}


                    {/* Tools / Settings (Wrench) */}
                    {onSettingsClick && (
                        <button
                        className={headerButtonClasses}
                        onClick={onSettingsClick}
                        title="MCP Server Settings"
                        aria-label="Open MCP settings"
                        >
                            <Wrench size={16} />
                        </button>
                    )}
                    {/* Reminders (Clock) */}
                    {onRemindersClick && (
                        <button
                            className={headerButtonClasses}
                            onClick={onRemindersClick}
                            title="Reminders"
                            aria-label="Open reminders"
                        >
                            <ClockIcon size={16} />
                        </button>
                    )}

                    {/* Kebab Menu (Three dots) */}
                    <div className="relative ml-auto" ref={menuRef}>
                        <button
                            className={headerButtonClasses}
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
                            <div
                                className="absolute top-9 right-2 min-w-[200px] rounded-[10px] p-[6px] z-2000"
                                style={{
                                    background: 'rgba(13, 13, 13, 0.98)',
                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
                                }}
                            >
                                <MenuItem
                                    onClick={() => {
                                        setShowHeaderMenu(false);
                                        onGeneralSettingsClick?.();
                                    }}
                                >
                                    Settings
                                </MenuItem>
                                <MenuItem
                                    onClick={() => {
                                        setShowHeaderMenu(false);
                                        onTroubleshootingClick?.();
                                    }}
                                >
                                    Troubleshooting
                                </MenuItem>
                                <MenuItem
                                    onClick={() => {
                                        setShowHeaderMenu(false);
                                        onFeaturesClick?.();
                                    }}
                                >
                                    Features
                                </MenuItem>
                                {process.env.NODE_ENV === 'development' && (
                                    <MenuItem
                                        onClick={() => {
                                            setShowHeaderMenu(false);
                                            onLoggerPanelClick?.();
                                        }}
                                    >
                                        Logger Panel
                                    </MenuItem>
                                )}
                                <MenuItem
                                    onClick={() => {
                                        setShowHeaderMenu(false);
                                        onProviderSetupClick?.();
                                    }}
                                    glow={needsProviderSetup}
                                >
                                    AI Provider Setup
                                </MenuItem>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Streaming Warning Dialog */}
            <StreamingWarningDialog
                isOpen={showStreamingWarning}
                onClose={() => setShowStreamingWarning(false)}
                onContinue={() => {
                    setShowStreamingWarning(false);
                    onNewThreadClick?.();
                }}
            />
        </div>
    );
};
