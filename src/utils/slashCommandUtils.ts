/**
 * Utilities for parsing and handling slash commands
 */

/**
 * Detect if user typed a slash command
 */
export function detectSlashCommand(
    text: string,
    cursorPosition: number
): boolean {
    // Check if the text starts with '/' and cursor is in the command area
    if (text.length === 0) return false;

    // Find the position of '/' at the start of text or after whitespace
    const beforeCursor = text.substring(0, cursorPosition);
    const afterLastSpace = beforeCursor.split(/\s/).pop() || '';

    return afterLastSpace.startsWith('/');
}

/**
 * Extract the search query after '/' for filtering workflows
 */
export function getSlashSearchQuery(text: string, cursorPosition: number): string {
    const beforeCursor = text.substring(0, cursorPosition);
    const afterLastSpace = beforeCursor.split(/\s/).pop() || '';

    if (afterLastSpace.startsWith('/')) {
        return afterLastSpace.substring(1); // Remove the '/'
    }

    return '';
}

/**
 * Parse workflow command from text like "/research about React hooks"
 * Returns workflow ID and user query
 */
export function parseWorkflowCommand(text: string): {
    workflowId: string;
    query: string;
} | null {
    // Match pattern: /workflowId query text
    const match = text.match(/^\/(\w+)\s+(.+)$/);
    if (!match) {
        // Check if it's just /workflowId without query
        const simpleMatch = text.match(/^\/(\w+)$/);
        if (simpleMatch && simpleMatch[1]) {
            return {
                workflowId: simpleMatch[1],
                query: '',
            };
        }
        return null;
    }

    if (!match[1] || !match[2]) {
        return null;
    }

    return {
        workflowId: match[1] || '', // e.g., 'research'
        query: (match[2] || '').trim(), // e.g., 'about React hooks'
    };
}

/**
 * Remove slash prefix from text
 */
export function removeSlashPrefix(text: string, workflowId: string): string {
    const prefix = `/${workflowId}`;
    if (text.startsWith(prefix)) {
        return text.substring(prefix.length).trim();
    }
    return text;
}

/**
 * Check if text is a slash command (starts with /)
 */
export function isSlashCommand(text: string): boolean {
    return text.trim().startsWith('/');
}

/**
 * Replace the slash command part with workflow selection
 */
export function replaceSlashCommand(
    text: string,
    cursorPosition: number,
    _workflowId: string
): { newText: string; newCursorPosition: number } {
    const beforeCursor = text.substring(0, cursorPosition);
    const afterCursor = text.substring(cursorPosition);

    // Find the slash command to replace
    const parts = beforeCursor.split(/\s/);
    const lastPart = parts[parts.length - 1];

    if (lastPart && lastPart.startsWith('/')) {
        // Remove the slash command from before cursor
        const beforeCommand = parts.slice(0, -1).join(' ');
        const newBefore = beforeCommand ? beforeCommand + ' ' : '';
        const newText = newBefore + afterCursor;

        return {
            newText,
            newCursorPosition: newBefore.length,
        };
    }

    return {
        newText: text,
        newCursorPosition: cursorPosition,
    };
}
