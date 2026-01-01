import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import useMeasure from 'react-use-measure';
import { PanelRightOpen, Plus, Wrench, MoreHorizontal, Settings, Bell, Zap, HelpCircle, Sparkles, Terminal } from 'lucide-react';
import { StreamingWarningDialog } from '../../context/StreamingWarningDialog';
import { openWebappRoute } from '@/constants/webapp';

interface ChatHeaderProps {
    onSettingsClick?: () => void;
    onGeneralSettingsClick?: () => void;
    onThreadsClick?: () => void;
    onNewThreadClick?: (forceCreate?: boolean) => void;
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

// Menu item configuration
interface MenuItemConfig {
    id: string;
    label: string;
    icon: React.ElementType;
    action: 'settings' | 'reminders' | 'provider' | 'troubleshooting' | 'features' | 'logger';
    glow?: boolean;
}

// Smooth easing for animations
const easeOutQuint: [number, number, number, number] = [0.23, 1, 0.32, 1];


export const ChatHeader: React.FC<ChatHeaderProps> = ({
    onSettingsClick,
    onGeneralSettingsClick,
    onThreadsClick,
    onNewThreadClick,
    onTroubleshootingClick,
    onFeaturesClick,
    onProviderSetupClick,
    onLoggerPanelClick,
    isLoading,
    needsProviderSetup,
}) => {
    const [showHeaderMenu, setShowHeaderMenu] = useState(false);
    const [showStreamingWarning, setShowStreamingWarning] = useState(false);
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [contentRef, contentBounds] = useMeasure();

    // Menu items configuration
    const menuItems: MenuItemConfig[] = [
        { id: 'settings', label: 'Settings', icon: Settings, action: 'settings' },
        { id: 'reminders', label: 'Reminders', icon: Bell, action: 'reminders' },
        { id: 'provider', label: 'AI Provider Setup', icon: Zap, action: 'provider', glow: needsProviderSetup },
        { id: 'troubleshooting', label: 'Troubleshooting', icon: HelpCircle, action: 'troubleshooting' },
        { id: 'features', label: 'Features', icon: Sparkles, action: 'features' },
        { id: 'logger', label: 'Logger Panel', icon: Terminal, action: 'logger' },
    ];

    // Handle menu item click
    const handleMenuItemClick = (action: MenuItemConfig['action']) => {
        setShowHeaderMenu(false);
        switch (action) {
            case 'settings':
                onGeneralSettingsClick?.();
                break;
            case 'reminders':
                openWebappRoute('REMINDERS');
                break;
            case 'provider':
                onProviderSetupClick?.();
                break;
            case 'troubleshooting':
                onTroubleshootingClick?.();
                break;
            case 'features':
                onFeaturesClick?.();
                break;
            case 'logger':
                onLoggerPanelClick?.();
                break;
        }
    };

    // Handle clicks outside menu to close it
    useEffect(() => {
        if (!showHeaderMenu) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowHeaderMenu(false);
            }
        };

        const timeoutId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showHeaderMenu]);

    const openHeight = Math.max(40, Math.ceil(contentBounds.height));

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

                    {/* Animated Kebab Menu */}
                    <div className="relative h-8 w-8" ref={menuRef}>
                        <motion.div
                            layout
                            initial={false}
                            animate={{
                                width: showHeaderMenu ? 200 : 32,
                                height: showHeaderMenu ? openHeight : 32,
                                borderRadius: showHeaderMenu ? 12 : 8,
                            }}
                            transition={{
                                type: 'spring' as const,
                                damping: 30,
                                stiffness: 400,
                                mass: 0.8,
                            }}
                            className="absolute top-0 right-0 overflow-hidden cursor-pointer origin-top-right"
                            style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                boxShadow: showHeaderMenu ? '0 8px 32px rgba(0, 0, 0, 0.4)' : 'none',
                            }}
                            onClick={() => !showHeaderMenu && setShowHeaderMenu(true)}
                        >
                            {/* Collapsed state icon */}
                            <motion.div
                                initial={false}
                                animate={{
                                    opacity: showHeaderMenu ? 0 : 1,
                                    scale: showHeaderMenu ? 0.8 : 1,
                                }}
                                transition={{ duration: 0.15 }}
                                className="absolute inset-0 flex items-center justify-center"
                                style={{
                                    pointerEvents: showHeaderMenu ? 'none' : 'auto',
                                    willChange: 'transform',
                                }}
                            >
                                <MoreHorizontal size={18} className="text-white/70" />
                            </motion.div>

                            {/* Menu Content - visible when open */}
                            <div ref={contentRef}>
                                <motion.div
                                    layout
                                    initial={false}
                                    animate={{
                                        opacity: showHeaderMenu ? 1 : 0,
                                    }}
                                    transition={{
                                        duration: 0.2,
                                        delay: showHeaderMenu ? 0.08 : 0,
                                    }}
                                    className="p-2"
                                    style={{
                                        pointerEvents: showHeaderMenu ? 'auto' : 'none',
                                        willChange: 'transform',
                                    }}
                                >
                                    <ul className="flex flex-col gap-0.5 m-0 p-0 list-none">
                                        {menuItems.map((item, index) => {
                                            const Icon = item.icon;
                                            const isHovered = hoveredItem === item.id;
                                            const isGlowing = item.glow;

                                            return (
                                                <motion.li
                                                    key={item.id}
                                                    initial={{ opacity: 0, x: 10 }}
                                                    animate={{
                                                        opacity: showHeaderMenu ? 1 : 0,
                                                        x: showHeaderMenu ? 0 : 10,
                                                    }}
                                                    transition={{
                                                        delay: showHeaderMenu ? 0.06 + index * 0.03 : 0,
                                                        duration: 0.2,
                                                        ease: easeOutQuint,
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleMenuItemClick(item.action);
                                                    }}
                                                    onMouseEnter={() => setHoveredItem(item.id)}
                                                    onMouseLeave={() => setHoveredItem(null)}
                                                    className={`relative flex items-center gap-2.5 rounded-md text-[13px] cursor-pointer transition-colors duration-200 ease-out m-0 pl-2.5 py-2`}
                                                    style={{
                                                        color: isGlowing ? 'var(--blue-stride)' : isHovered ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                        textShadow: isGlowing ? '0 0 8px rgba(18, 100, 255, 0.4)' : 'none',
                                                    }}
                                                >
                                                    {/* Hover background indicator */}
                                                    {isHovered && (
                                                        <motion.div
                                                            layoutId="menuActiveIndicator"
                                                            className="absolute inset-0 rounded-md"
                                                            style={{ background: 'var(--glass-bg-hover)' }}
                                                            transition={{
                                                                type: 'spring',
                                                                damping: 30,
                                                                stiffness: 520,
                                                                mass: 0.8,
                                                            }}
                                                        />
                                                    )}
                                                    {/* Left bar indicator */}
                                                    {isHovered && (
                                                        <motion.div
                                                            layoutId="menuLeftBar"
                                                            className="absolute left-0 top-0 bottom-0 my-auto w-[2px] h-3.5 rounded-full"
                                                            style={{ background: 'var(--blue-stride)' }}
                                                            transition={{
                                                                type: 'spring',
                                                                damping: 30,
                                                                stiffness: 520,
                                                                mass: 0.8,
                                                            }}
                                                        />
                                                    )}
                                                    <Icon size={15} className="relative z-10 shrink-0 opacity-80" />
                                                    <span className="font-medium relative z-10">
                                                        {item.label}
                                                    </span>
                                                </motion.li>
                                            );
                                        })}
                                    </ul>
                                </motion.div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* Streaming Warning Dialog */}
            <StreamingWarningDialog
                isOpen={showStreamingWarning}
                onClose={() => setShowStreamingWarning(false)}
                onContinue={() => {
                    setShowStreamingWarning(false);
                    onNewThreadClick?.(true);
                }}
            />
        </div>
    );
};
