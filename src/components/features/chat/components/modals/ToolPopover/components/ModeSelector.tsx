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
}) => (
    <div className="tools-mode-selector">
        <button
            type="button"
            className={`tools-mode-btn ${displayMode === 'chat' ? 'active' : ''}`}
            onClick={() => onModeChange('chat')}
        >
            <MessageSquare size={12} />
            <span>Chat</span>
        </button>
        <button
            type="button"
            className={`tools-mode-btn ${displayMode === 'agent' ? 'active' : ''}`}
            onClick={() => onModeChange('agent')}
        >
            <Bot size={12} />
            <span>Agent</span>
        </button>
        {hasUserModified && (
            <div className="tools-mode-custom-badge">
                Custom
            </div>
        )}
    </div>
);
