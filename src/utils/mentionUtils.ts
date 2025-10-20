/**
 * Utilities for parsing and handling tab/tool mentions in user messages
 * Format: @[DisplayName](tabId) for tabs, #[DisplayName](toolName) for tools
 */

export interface TabMention {
    display: string;
    id: string;
    faviconUrl?: string;
}

export interface ToolMention {
    display: string;
    id: string;
}

export interface MentionParseResult {
    tabMentions: TabMention[];
    toolMentions: ToolMention[];
}

/**
 * Extract tab and tool mentions from text
 * @param text - The text to parse for mentions
 * @returns Object containing arrays of tab and tool mentions
 */
export function extractMentions(text: string): MentionParseResult {
    // Updated regex to capture display text and optional favicon URL
    const tabMentionRegex = /@\[([^|\]]+)(?:\|([^\]]*))?\]\((\d+)\)/g;
    const toolMentionRegex = /#\[([^\]]+)\]\(([^\)]+)\)/g;

    const tabMentions: TabMention[] = [];
    const toolMentions: ToolMention[] = [];

    let match;

    // Extract tab mentions with optional favicon
    while ((match = tabMentionRegex.exec(text)) !== null) {
        tabMentions.push({
            display: match[1],
            faviconUrl: match[2] || undefined,
            id: match[3]
        });
    }

    // Extract tool mentions
    while ((match = toolMentionRegex.exec(text)) !== null) {
        toolMentions.push({
            display: match[1],
            id: match[2]
        });
    }

    return { tabMentions, toolMentions };
}

/**
 * Get current cursor position in a textarea or input element
 */
export function getCursorPosition(element: HTMLInputElement | HTMLTextAreaElement): number {
    return element.selectionStart || 0;
}

/**
 * Insert mention text at cursor position
 */
export function insertMentionAtCursor(
    currentText: string,
    cursorPosition: number,
    mentionText: string,
    triggerChar: '@' | '#'
): { newText: string; newCursorPosition: number } {
    // Find the start of the mention (where @ or # was typed)
    let mentionStart = cursorPosition - 1;
    while (mentionStart > 0 && currentText[mentionStart] !== triggerChar) {
        mentionStart--;
    }

    // If we found the trigger character
    if (currentText[mentionStart] === triggerChar) {
        const before = currentText.substring(0, mentionStart);
        const after = currentText.substring(cursorPosition);
        const newText = before + mentionText + ' ' + after;
        const newCursorPosition = mentionStart + mentionText.length + 1;

        return { newText, newCursorPosition };
    }

    // Fallback: just append
    return {
        newText: currentText + mentionText + ' ',
        newCursorPosition: currentText.length + mentionText.length + 1
    };
}

/**
 * Check if cursor is currently in a mention trigger state
 */
export function isMentionTrigger(
    text: string,
    cursorPosition: number,
    triggerChar: '@' | '#'
): { isTrigger: boolean; searchQuery: string } {
    if (cursorPosition === 0) {
        return { isTrigger: false, searchQuery: '' };
    }

    // Look backward from cursor to find trigger
    let pos = cursorPosition - 1;
    let query = '';

    while (pos >= 0) {
        const char = text[pos];

        if (char === triggerChar) {
            // Found trigger, check if it's at start or preceded by whitespace
            const prevChar = pos > 0 ? text[pos - 1] : ' ';
            if (prevChar === ' ' || prevChar === '\n' || pos === 0) {
                return { isTrigger: true, searchQuery: query };
            }
            return { isTrigger: false, searchQuery: '' };
        }

        // If we hit whitespace before finding trigger, it's not a mention
        if (char === ' ' || char === '\n') {
            return { isTrigger: false, searchQuery: '' };
        }

        query = char + query;
        pos--;
    }

    return { isTrigger: false, searchQuery: '' };
}

/**
 * Truncate text for display in mentions
 * Takes first word or truncates to max length
 */
export function truncateMentionText(text: string, maxLength: number = 20): string {
    // Clean the text
    const cleaned = text.trim();

    // If text is short enough, return as-is
    if (cleaned.length <= maxLength) {
        return cleaned;
    }

    // Try to get first meaningful word (skip common prefixes)
    const words = cleaned.split(/[\s\-–—|•]/);
    const firstWord = words[0];

    // If first word is reasonable length, use it
    if (firstWord && firstWord.length >= 3 && firstWord.length <= maxLength) {
        return firstWord;
    }

    // Otherwise truncate with ellipsis
    return cleaned.substring(0, maxLength) + '...';
}

/**
 * Format a tab as a mention string with favicon URL
 * Format: @[DisplayText|FaviconURL](tabId)
 */
export function formatTabMention(title: string, tabId: number, faviconUrl?: string): string {
    const displayText = truncateMentionText(title);
    const favicon = faviconUrl || '';
    return `@[${displayText}|${favicon}](${tabId})`;
}

/**
 * Format a tool as a mention string
 */
export function formatToolMention(display: string, toolId: string): string {
    return `#[${display}](${toolId})`;
}
