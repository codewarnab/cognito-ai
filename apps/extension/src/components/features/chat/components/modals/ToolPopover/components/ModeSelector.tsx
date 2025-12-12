import React from 'react';
import { MessageSquare, Bot } from 'lucide-react';
import type { ToolMode } from '../types';

interface ModeSelectorProps {
    displayMode: ToolMode;
    hasUserModified: boolean;
    onModeChange: (mode: ToolMode) => void;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
    displayMode,
    hasUserModified,
    onModeChange,
}) => {
    const getButtonStyle = (isActive: boolean): React.CSSProperties => ({
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
        padding: '3px 8px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.15s',
        border: isActive ? '1px solid var(--color-primary, #3b82f6)' : '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
        background: isActive
            ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.08))'
            : 'var(--bg-tertiary, #1a2637)',
        color: isActive ? 'var(--color-primary, #3b82f6)' : 'var(--text-secondary, #9ca3af)',
    });

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 8px',
            borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
        }}>
            <button
                type="button"
                style={getButtonStyle(displayMode === 'chat')}
                onClick={() => onModeChange('chat')}
            >
                <MessageSquare size={12} />
                <span>Chat</span>
            </button>
            <button
                type="button"
                style={getButtonStyle(displayMode === 'agent')}
                onClick={() => onModeChange('agent')}
            >
                <Bot size={12} />
                <span>Agent</span>
            </button>
            {hasUserModified && (
                <div style={{
                    marginLeft: 'auto',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '9px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: 'var(--color-warning, #f59e0b)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                }}>
                    Custom
                </div>
            )}
        </div>
    );
};
