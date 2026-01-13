import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Bot, Sparkles, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { ToolMode } from '../types';

interface ModeSelectorProps {
    currentMode: ToolMode;
    justModified: boolean;
    isModeModified: boolean;
    onModeChange: (mode: ToolMode) => void;
    onResetToDefault: () => void;
}

interface ModeInfo {
    mode: ToolMode;
    icon: React.ReactNode;
    label: string;
    description: string;
    isAdaptive?: boolean;
}

const MODES: ModeInfo[] = [
    {
        mode: 'chat',
        icon: <MessageSquare size={10} />,
        label: 'Chat',
        description: 'Basic assistant for reading pages and screenshots.',
    },
    {
        mode: 'agent',
        icon: <Bot size={10} />,
        label: 'Agent',
        description: 'Full browser automation with clicking, typing, and navigation.',
    },
    {
        mode: 'adaptive',
        icon: <Sparkles size={10} />,
        label: 'Adaptive',
        description: 'Discovers tools on-demand for efficient context usage.',
        isAdaptive: true,
    },
];

export const ModeSelector: React.FC<ModeSelectorProps> = ({
    currentMode,
    justModified,
    isModeModified,
    onModeChange,
    onResetToDefault,
}) => {
    const [hoveredMode, setHoveredMode] = useState<ToolMode | null>(null);
    const [visibleTooltip, setVisibleTooltip] = useState<ToolMode | null>(null);
    const [showResetTooltip, setShowResetTooltip] = useState(false);
    const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const resetHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Handle delayed tooltip visibility
    useEffect(() => {
        if (hoveredMode) {
            hoverTimerRef.current = setTimeout(() => {
                setVisibleTooltip(hoveredMode);
            }, 400);
        } else {
            if (hoverTimerRef.current) {
                clearTimeout(hoverTimerRef.current);
            }
            setVisibleTooltip(null);
        }

        return () => {
            if (hoverTimerRef.current) {
                clearTimeout(hoverTimerRef.current);
            }
        };
    }, [hoveredMode]);

    // Handle delayed reset tooltip visibility
    useEffect(() => {
        return () => {
            if (resetHoverTimerRef.current) {
                clearTimeout(resetHoverTimerRef.current);
            }
        };
    }, []);

    const handleResetMouseEnter = () => {
        resetHoverTimerRef.current = setTimeout(() => {
            setShowResetTooltip(true);
        }, 400);
    };

    const handleResetMouseLeave = () => {
        if (resetHoverTimerRef.current) {
            clearTimeout(resetHoverTimerRef.current);
        }
        setShowResetTooltip(false);
    };

    const getButtonStyle = (isActive: boolean, isAdaptive?: boolean): React.CSSProperties => {
        const primaryColor = isAdaptive ? 'var(--color-success, #10b981)' : 'var(--color-primary, #3b82f6)';
        const primaryRgb = isAdaptive ? '16, 185, 129' : '59, 130, 246';

        return {
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s',
            border: isActive ? `1px solid ${primaryColor}` : '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            background: isActive
                ? `linear-gradient(135deg, rgba(${primaryRgb}, 0.15), rgba(${primaryRgb}, 0.08))`
                : 'var(--bg-tertiary, #1a2637)',
            color: isActive ? primaryColor : 'var(--text-secondary, #9ca3af)',
        };
    };

    const hoveredModeInfo = MODES.find(m => m.mode === visibleTooltip);

    return (
        <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 8px',
            borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
        }}>
            {MODES.map((modeInfo) => (
                <button
                    key={modeInfo.mode}
                    type="button"
                    style={getButtonStyle(currentMode === modeInfo.mode, modeInfo.isAdaptive)}
                    onClick={() => onModeChange(modeInfo.mode)}
                    onMouseEnter={() => setHoveredMode(modeInfo.mode)}
                    onMouseLeave={() => setHoveredMode(null)}
                >
                    {modeInfo.icon}
                    <span>{modeInfo.label}</span>
                </button>
            ))}

            {/* Reset Button */}
            {isModeModified && currentMode !== 'adaptive' && (
                <button
                    type="button"
                    onClick={onResetToDefault}
                    onMouseEnter={handleResetMouseEnter}
                    onMouseLeave={handleResetMouseLeave}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px',
                        marginLeft: 'auto',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        background: 'transparent',
                        border: '1px solid transparent',
                        color: 'var(--text-tertiary, #6b7280)',
                        transition: 'all 0.15s',
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.color = 'var(--text-primary, #fff)';
                        e.currentTarget.style.background = 'var(--bg-input, rgba(255,255,255,0.05))';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.color = 'var(--text-tertiary, #6b7280)';
                        e.currentTarget.style.background = 'transparent';
                    }}
                >
                    <RotateCcw size={12} />
                </button>
            )}

            {/* Mode Tooltip */}
            <AnimatePresence>
                {visibleTooltip && hoveredModeInfo && !showResetTooltip && (
                    <motion.div
                        initial={{ opacity: 0, y: 2 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 2 }}
                        transition={{ duration: 0.12 }}
                        style={{
                            position: 'absolute',
                            bottom: 'calc(100% + 6px)',
                            left: '8px',
                            width: '160px',
                            padding: '6px 8px',
                            backgroundColor: 'var(--bg-tertiary, #1a2637)',
                            border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                            borderRadius: '6px',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                            zIndex: 150,
                            fontSize: '9px',
                            lineHeight: 1.4,
                        }}
                    >
                        <div style={{
                            fontWeight: 600,
                            color: hoveredModeInfo.isAdaptive ? 'var(--color-success, #10b981)' : 'var(--color-primary, #3b82f6)',
                            marginBottom: '3px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                        }}>
                            {hoveredModeInfo.icon}
                            {hoveredModeInfo.label}
                        </div>
                        <p style={{ margin: 0, color: 'var(--text-secondary, #9ca3af)' }}>
                            {hoveredModeInfo.description}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Reset Tooltip */}
            <AnimatePresence>
                {showResetTooltip && (
                    <motion.div
                        initial={{ opacity: 0, y: 2 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 2 }}
                        transition={{ duration: 0.12 }}
                        style={{
                            position: 'absolute',
                            bottom: 'calc(100% + 6px)',
                            right: '8px',
                            padding: '4px 8px',
                            backgroundColor: 'var(--bg-tertiary, #1a2637)',
                            border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                            borderRadius: '6px',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                            zIndex: 150,
                            fontSize: '9px',
                            whiteSpace: 'nowrap',
                            color: 'var(--text-primary, #fff)',
                        }}
                    >
                        Reset to default
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Subtle fade-out Modified indicator - Only show if NO reset button (so no jumping) */}
            <AnimatePresence>
                {justModified && !isModeModified && (
                    <motion.div
                        initial={{ opacity: 1 }}
                        animate={{ opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.2, delay: 0.3 }}
                        style={{
                            marginLeft: 'auto',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '8px',
                            fontWeight: 500,
                            textTransform: 'uppercase',
                            letterSpacing: '0.3px',
                            background: 'rgba(59, 130, 246, 0.1)',
                            color: 'var(--color-primary, #3b82f6)',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                        }}
                    >
                        Saved
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

