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
import { detectSlashCommand, getSlashSearchQuery } from '../utils/slashCommandUtils';

interface MentionInputProps {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    disabled?: boolean;
    placeholder?: string;
    autoFocus?: boolean;
    onSlashCommand?: (isSlash: boolean, searchQuery: string) => void; // Callback for slash command detection
    isSlashDropdownOpen?: boolean; // Whether slash command dropdown is showing
}

export function MentionInput({
    value,
    onChange,
    onSend,
    disabled = false,
    placeholder = "Ask me anything... (type @ to mention tabs)",
    autoFocus = false,
    onSlashCommand,
    isSlashDropdownOpen = false
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

        // Check for slash command first
        const isSlash = detectSlashCommand(newValue, cursorPos);
        if (isSlash) {
            const slashQuery = getSlashSearchQuery(newValue, cursorPos);
            // Notify parent about slash command
            if (onSlashCommand) {
                onSlashCommand(true, slashQuery);
            }
            setShowDropdown(false); // Hide tab mention dropdown
            return;
        } else if (onSlashCommand) {
            // Not a slash command, clear slash dropdown
            onSlashCommand(false, '');
        }

        // Check for @ mention trigger
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
        // Don't handle Enter if any dropdown is showing
        if (e.key === 'Enter' && !showDropdown && !isSlashDropdownOpen) {
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
            {/* Simple input field without overlay - mentions shown as plain text */}
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="copilot-input mention-input"
                disabled={disabled}
                autoFocus={autoFocus}
            />

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
