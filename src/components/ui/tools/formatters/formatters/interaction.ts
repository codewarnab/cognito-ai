/**
 * Interaction tool formatters
 */

import type { ActionFormatter } from '../types';
import { truncateText } from '../helpers';

export const clickElementFormatter: ActionFormatter = ({ state, input, output }) => {
    const clicked = output?.clicked;
    const text = clicked?.text || clicked?.innerText;
    const selector = input?.selector;

    if (state === 'loading') {
        return {
            action: 'Clicking element',
            description: selector ? truncateText(selector, 40) : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'Clicked',
            description: text ? truncateText(text, 40) : selector ? truncateText(selector, 40) : undefined
        };
    }
    return { action: 'Click failed' };
};

export const focusElementFormatter: ActionFormatter = ({ state, input }) => {
    const selector = input?.selector;

    if (state === 'loading') {
        return {
            action: 'Focusing element',
            description: selector ? truncateText(selector, 40) : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'Element focused',
            description: selector ? truncateText(selector, 40) : undefined
        };
    }
    return {
        action: 'Focus failed',
        description: selector ? truncateText(selector, 40) : undefined
    };
};

export const clickByTextFormatter: ActionFormatter = ({ state, input, output }) => {
    const searchText = input?.text;
    const clicked = output?.clicked;
    const matchInfo = output?.totalMatches > 1 ? ` (match ${output.clickedIndex} of ${output.totalMatches})` : '';

    if (state === 'loading') {
        return {
            action: 'Searching & clicking',
            description: searchText ? `"${truncateText(searchText, 40)}"` : undefined
        };
    }
    if (state === 'success') {
        const clickedText = clicked?.text || searchText;
        return {
            action: 'Element clicked',
            description: clickedText ? `"${truncateText(clickedText, 30)}"${matchInfo}` : matchInfo
        };
    }
    return {
        action: 'Click failed',
        description: searchText ? `"${truncateText(searchText, 40)}"` : undefined
    };
};

export const typeInFieldFormatter: ActionFormatter = ({ state, input, output }) => {
    const target = input?.target;
    const text = input?.text || '';
    const length = text.length;
    const preview = truncateText(text, 20);

    if (state === 'loading') {
        return {
            action: 'Typing',
            description: target ? `"${preview}" • ${target}` : `"${preview}"`
        };
    }
    if (state === 'success') {
        const message = output?.message;
        const typed = output?.typed || length;
        const pressedEnter = input?.pressEnter || message?.includes('Enter');

        return {
            action: 'Text Typed',
            description: target
                ? `${typed} chars${pressedEnter ? ' + Enter' : ''} • ${target}`
                : `${typed} chars${pressedEnter ? ' + Enter' : ''}`
        };
    }
    return {
        action: 'Typing failed',
        description: target ? truncateText(target, 40) : undefined
    };
};

export const pressKeyFormatter: ActionFormatter = ({ state, input }) => {
    const key = input?.key;

    if (state === 'loading') {
        return {
            action: 'Pressing key',
            description: key
        };
    }
    if (state === 'success') {
        return {
            action: 'Pressed key',
            description: key
        };
    }
    return { action: 'Key press failed' };
};

export const globalTypeTextFormatter: ActionFormatter = ({ state, input, output }) => {
    const text = input?.text || '';
    const preview = text.substring(0, 20);
    const displayText = text.length > 20 ? preview + '...' : preview;
    const typed = output?.typed || text.length;

    if (state === 'loading') {
        return {
            action: 'Typing text',
            description: `"${displayText}"`
        };
    }
    if (state === 'success') {
        return {
            action: 'Text typed',
            description: `${typed} characters`
        };
    }
    return {
        action: 'Typing failed',
        description: displayText ? `"${displayText}"` : undefined
    };
};

export const scrollFormatter: ActionFormatter = ({ state, input }) => {
    const direction = input?.direction || 'down';

    if (state === 'loading') {
        return {
            action: 'Scrolling',
            description: direction
        };
    }
    if (state === 'success') {
        return {
            action: 'Scrolled',
            description: direction
        };
    }
    return { action: 'Scroll failed' };
};

export const waitForElementFormatter: ActionFormatter = ({ state, input }) => {
    const selector = input?.selector;

    if (state === 'loading') {
        return {
            action: 'Waiting for element',
            description: selector ? truncateText(selector, 40) : undefined
        };
    }
    if (state === 'success') {
        return {
            action: 'Element found',
            description: selector ? truncateText(selector, 40) : undefined
        };
    }
    return { action: 'Wait timeout' };
};
