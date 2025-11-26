/**
 * Minimal Tool Settings Toggle
 * Compact inline toggle for enabling/disabling Gemini tools (URL Context, Google Search)
 * Used in Writer Overlay and Rewriter Tooltip
 */
import React, { useState, useCallback } from 'react';

interface ToolsToggleProps {
    enableUrlContext: boolean;
    enableGoogleSearch: boolean;
    onUrlContextChange: (enabled: boolean) => void;
    onGoogleSearchChange: (enabled: boolean) => void;
    disabled?: boolean;
}

// Compact icons
const GlobeIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
);

const SearchIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
    </svg>
);

const ChevronDownIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const SettingsIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
);

export function ToolsToggle({
    enableUrlContext,
    enableGoogleSearch,
    onUrlContextChange,
    onGoogleSearchChange,
    disabled = false,
}: ToolsToggleProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const toggleExpanded = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsExpanded((prev) => !prev);
    }, []);

    const handleUrlContextToggle = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) {
            onUrlContextChange(!enableUrlContext);
        }
    }, [disabled, enableUrlContext, onUrlContextChange]);

    const handleGoogleSearchToggle = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) {
            onGoogleSearchChange(!enableGoogleSearch);
        }
    }, [disabled, enableGoogleSearch, onGoogleSearchChange]);

    const activeToolsCount = (enableUrlContext ? 1 : 0) + (enableGoogleSearch ? 1 : 0);

    return (
        <div className="tools-toggle-container">
            {/* Collapsed: Show compact trigger button */}
            <button
                type="button"
                className={`tools-toggle-trigger ${isExpanded ? 'tools-toggle-trigger--expanded' : ''} ${activeToolsCount > 0 ? 'tools-toggle-trigger--active' : ''}`}
                onClick={toggleExpanded}
                disabled={disabled}
                title="AI Tools"
            >
                <SettingsIcon />
                <span className="tools-toggle-label">Tools</span>
                {activeToolsCount > 0 && (
                    <span className="tools-toggle-badge">{activeToolsCount}</span>
                )}
                <span className={`tools-toggle-chevron ${isExpanded ? 'tools-toggle-chevron--rotated' : ''}`}>
                    <ChevronDownIcon />
                </span>
            </button>

            {/* Expanded: Show tool toggles */}
            {isExpanded && (
                <div className="tools-toggle-panel">
                    <button
                        type="button"
                        className={`tools-toggle-item ${enableUrlContext ? 'tools-toggle-item--active' : ''}`}
                        onClick={handleUrlContextToggle}
                        disabled={disabled}
                        title="Enable URL Context - Analyze web content"
                    >
                        <span className="tools-toggle-item-icon"><GlobeIcon /></span>
                        <span className="tools-toggle-item-label">URL Context</span>
                        <span className={`tools-toggle-item-switch ${enableUrlContext ? 'tools-toggle-item-switch--on' : ''}`}>
                            <span className="tools-toggle-item-switch-thumb" />
                        </span>
                    </button>
                    <button
                        type="button"
                        className={`tools-toggle-item ${enableGoogleSearch ? 'tools-toggle-item--active' : ''}`}
                        onClick={handleGoogleSearchToggle}
                        disabled={disabled}
                        title="Enable Google Search - Real-time information"
                    >
                        <span className="tools-toggle-item-icon"><SearchIcon /></span>
                        <span className="tools-toggle-item-label">Google Search</span>
                        <span className={`tools-toggle-item-switch ${enableGoogleSearch ? 'tools-toggle-item-switch--on' : ''}`}>
                            <span className="tools-toggle-item-switch-thumb" />
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
}
