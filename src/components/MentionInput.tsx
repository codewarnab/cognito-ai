/**
 * Chat input component with tab mention support
 * Supports @TabName syntax for mentioning browser tabs
 */

import React, { useState, useRef, useEffect } from 'react';
import { TabMentionDropdown } from './TabMentionDropdown';
import {
    isMentionTrigger,
    formatTabMention,
    insertMentionAtCursor,
    getCursorPosition
} from '../utils/mentionUtils';

interface MentionInputProps {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    disabled?: boolean;
    placeholder?: string;
}

export function MentionInput({
    value,
    onChange,
    onSend,
    disabled = false,
    placeholder = "Ask me anything... (type @ to mention tabs)"
}: MentionInputProps) {
    const [showDropdown, setShowDropdown] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
    const inputRef = useRef<HTMLInputElement>(null);

    // Check for mention trigger on input change
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        onChange(newValue);

        const cursorPos = getCursorPosition(e.target);
        const trigger = isMentionTrigger(newValue, cursorPos, '@');

        if (trigger.isTrigger) {
            setSearchQuery(trigger.searchQuery);
            setShowDropdown(true);
            updateDropdownPosition();
        } else {
            setShowDropdown(false);
        }
    };

    // Update dropdown position based on input position
    const updateDropdownPosition = () => {
        if (inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect();
            // Position dropdown right above the input (with small gap)
            setDropdownPosition({
                top: rect.top - 10, // Small gap above input, will grow upward
                left: rect.left
            });
        }
    };

    // Handle tab selection from dropdown
    const handleSelectTab = (tab: chrome.tabs.Tab) => {
        if (!inputRef.current || !tab.id) return;

        const cursorPos = getCursorPosition(inputRef.current);
        const mentionText = formatTabMention(
            tab.title || 'Untitled',
            tab.id,
            tab.favIconUrl
        );
        const { newText, newCursorPosition } = insertMentionAtCursor(
            value,
            cursorPos,
            mentionText,
            '@'
        );

        onChange(newText);
        setShowDropdown(false);

        // Restore focus and cursor position
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                inputRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
            }
        }, 0);
    };

    // Handle keyboard events
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !showDropdown) {
            e.preventDefault();
            onSend();
        }
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (showDropdown && inputRef.current && !inputRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showDropdown]);

    return (
        <div className="mention-input-wrapper">
            <div className="mention-input-container">
                {/* Highlighted overlay showing mentions */}
                <div
                    className="mention-input-overlay"
                    aria-hidden="true"
                >
                    {renderInputWithHighlights(value)}
                </div>

                {/* Actual input field */}
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="copilot-input mention-input"
                    disabled={disabled}
                />
            </div>

            {showDropdown && (
                <TabMentionDropdown
                    searchQuery={searchQuery}
                    onSelectTab={handleSelectTab}
                    onClose={() => setShowDropdown(false)}
                    position={dropdownPosition}
                    currentInput={value}
                />
            )}
        </div>
    );
}

/**
 * Render input text with highlighted mentions
 */
function renderInputWithHighlights(text: string): React.ReactNode {
    const tabMentionRegex = /@\[([^|\]]+)(?:\|([^\]]*))?\]\((\d+)\)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;

    let match;
    while ((match = tabMentionRegex.exec(text)) !== null) {
        // Add text before mention
        if (match.index > lastIndex) {
            parts.push(
                <span key={`text-${key++}`}>
                    {text.substring(lastIndex, match.index)}
                </span>
            );
        }

        // Add highlighted mention with favicon
        const displayText = match[1];
        const faviconUrl = match[2];

        parts.push(
            <span key={`mention-${key++}`} className="mention-input-highlight">
                {faviconUrl && (
                    <img
                        src={faviconUrl}
                        alt=""
                        className="mention-input-favicon"
                        onError={(e) => e.currentTarget.style.display = 'none'}
                    />
                )}
                {!faviconUrl && <span className="mention-input-icon">🌐</span>}
                @{displayText}
            </span>
        );

        lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        parts.push(
            <span key={`text-${key++}`}>
                {text.substring(lastIndex)}
            </span>
        );
    }

    return parts.length > 0 ? parts : text;
}
