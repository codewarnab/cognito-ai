/**
 * Page Context Capture Hook
 * Captures comprehensive page context for /ask command
 * Provides enhanced context including selected text and visible content
 */
import { useCallback } from 'react';
import type { AskPageContext } from '@/types';
import { detectPlatform } from '../write-command/platformDetector';

const MAX_VISIBLE_CONTENT_LENGTH = 3000;
const MAX_SELECTED_TEXT_LENGTH = 1000;

/**
 * Extract visible text content from the page
 * Walks the DOM tree and collects text from visible elements
 */
function extractVisibleContent(): string {
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;

                // Skip hidden elements
                const style = window.getComputedStyle(parent);
                if (style.display === 'none' || style.visibility === 'hidden') {
                    return NodeFilter.FILTER_REJECT;
                }

                // Skip script/style/noscript content
                const tagName = parent.tagName.toLowerCase();
                if (['script', 'style', 'noscript', 'svg', 'path'].includes(tagName)) {
                    return NodeFilter.FILTER_REJECT;
                }

                return NodeFilter.FILTER_ACCEPT;
            },
        }
    );

    const textParts: string[] = [];
    let totalLength = 0;

    while (walker.nextNode() && totalLength < MAX_VISIBLE_CONTENT_LENGTH) {
        const text = walker.currentNode.textContent?.trim();
        if (text && text.length > 2) {
            textParts.push(text);
            totalLength += text.length;
        }
    }

    return textParts.join(' ').substring(0, MAX_VISIBLE_CONTENT_LENGTH);
}

/**
 * Get current text selection from the page
 */
function getSelectedText(): string | undefined {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 0) {
        return text.substring(0, MAX_SELECTED_TEXT_LENGTH);
    }
    return undefined;
}

/**
 * Get page meta description
 */
function getMetaDescription(): string | undefined {
    const meta = document.querySelector('meta[name="description"]');
    return meta?.getAttribute('content') || undefined;
}

/**
 * Hook for capturing page context
 * Returns a function that captures the current page state
 */
export function usePageContextCapture() {
    const captureContext = useCallback((): AskPageContext => {
        const platformInfo = detectPlatform();

        return {
            title: document.title,
            url: window.location.href,
            domain: window.location.hostname,
            platform: platformInfo.platform,
            selectedText: getSelectedText(),
            visibleContent: extractVisibleContent(),
            metaDescription: getMetaDescription(),
        };
    }, []);

    return { captureContext };
}
