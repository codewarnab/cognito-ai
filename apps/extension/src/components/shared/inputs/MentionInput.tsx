/**
 * Chat input component with tab mention support
 * Supports @TabName syntax for mentioning browser tabs
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TabMentionDropdown } from './TabMentionDropdown';
import {
    isMentionTrigger,
    formatTabMention,
    insertMentionAtCursor,
    getCursorPosition
} from '@/utils/chat';
import { detectSlashCommand, getSlashSearchQuery } from '@/utils/chat';
import { useCliModeStore, useToolsStore, type CliModeState } from '@/stores';

/**
 * Animated placeholder with letter-by-letter morphing effect.
 * Each letter animates in with rotateX, Y translation, and blur.
 */
const AnimatedPlaceholder = ({ text }: { text: string }) => {
    const letters = text.split('');

    return (
        <motion.span className="inline-flex flex-wrap overflow-hidden">
            {letters.map((letter, index) => (
                <motion.span
                    key={`${text}-${index}`}
                    initial={{
                        opacity: 0,
                        rotateX: '80deg',
                        y: 8,
                        filter: 'blur(3px)',
                    }}
                    exit={{
                        opacity: 0,
                        rotateX: '-80deg',
                        filter: 'blur(3px)',
                        y: -8,

                    }}
                    animate={{
                        opacity: 1,
                        rotateX: '0deg',
                        y: 0,
                        filter: 'blur(0px)',
                    }}
                    transition={{
                        delay: 0.015 * index,
                        type: 'spring',
                        damping: 16,
                        stiffness: 240,
                        mass: 1.2,
                    }}
                    style={{
                        willChange: 'transform',
                    }}
                    className="inline-block"
                >
                    {letter === ' ' ? '\u00A0' : letter}
                </motion.span>
            ))}
        </motion.span>
    );
};

const MIN_HEIGHT = 44;
const MAX_HEIGHT = 160;

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
    // Check if cli mode is active for placeholder
    const bridgeStatus = useCliModeStore((s: CliModeState) => s.bridgeStatus);
    const currentMode = useToolsStore((s) => s.currentMode);

    // Only show cli placeholder if bridge is connected AND we are actually in cli mode
    // The user can be connected to bridge but be in 'chat' or 'agent' mode
    const isCliMode = bridgeStatus === 'connected' && currentMode === 'cli';

    // Use cli mode specific placeholder when connected
    const actualPlaceholder = isCliMode
        ? "Describe your code changes..."
        : placeholder;

    const [showDropdown, setShowDropdown] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
    const [textareaHeight, setTextareaHeight] = useState(MIN_HEIGHT);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea based on content
    const adjustHeight = useCallback(() => {
        const textarea = inputRef.current;
        if (!textarea) return;

        // Reset height to min to get accurate scrollHeight
        textarea.style.height = `${MIN_HEIGHT}px`;

        // Calculate new height
        const scrollHeight = textarea.scrollHeight;
        const newHeight = Math.min(Math.max(scrollHeight, MIN_HEIGHT), MAX_HEIGHT);

        setTextareaHeight(newHeight);
        textarea.style.height = `${newHeight}px`;
    }, []);

    // Adjust height when value changes
    useEffect(() => {
        adjustHeight();
    }, [value, adjustHeight]);

    // Check for mention trigger on input change
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Don't handle Enter if any dropdown is showing
        if (e.key === 'Enter') {
            // Shift+Enter: allow new line (do nothing, let browser handle it)
            if (e.shiftKey) {
                return;
            }

            // Enter alone: send message if no dropdown is showing
            if (!showDropdown && !isSlashDropdownOpen) {
                e.preventDefault();
                onSend();
            }
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
        <div className="relative flex-1 w-full">
            {/* Animated placeholder overlay */}
            {!value && (
                <div className="absolute left-0 top-0 w-full h-full flex items-start pt-[2px] pointer-events-none overflow-hidden z-0">
                    <AnimatePresence mode="popLayout" initial={false}>
                        <motion.div
                            key={actualPlaceholder}
                            className="text-sm text-white/35 font-normal whitespace-normal"
                        >
                            <AnimatedPlaceholder text={actualPlaceholder} />
                        </motion.div>
                    </AnimatePresence>
                </div>
            )}

            {/* Textarea for multi-line support - mentions shown as plain text */}
            <textarea
                ref={inputRef}
                value={value}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                className="relative z-10 flex-1 bg-transparent border-none text-white outline-none resize-none text-sm font-normal leading-[1.4] tracking-[0.3px] w-full disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={disabled}
                autoFocus={autoFocus}
                rows={1}
                style={{
                    resize: 'none',
                    overflow: textareaHeight >= MAX_HEIGHT ? 'auto' : 'hidden',
                    height: `${textareaHeight}px`,
                    minHeight: `${MIN_HEIGHT}px`,
                    maxHeight: `${MAX_HEIGHT}px`,
                    // Sleek minimal scrollbar
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(255,255,255,0.15) transparent'
                }}
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
