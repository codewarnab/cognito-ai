/**
 * Text Rewriter Content Script
 * Plasmo content script that enables text rewriting via context menu
 *
 * Usage: Select text on any webpage → Right-click → "Rewrite with Cognito AI" → Rewriter tooltip appears
 */
import type { PlasmoCSConfig } from 'plasmo';
import { useCallback, useState, useEffect } from 'react';
import cssText from 'data-text:~/styles/features/text-rewriter.css';

import { useRewriter } from './text-rewriter/useRewriter';
import { RewriterTooltip } from './text-rewriter/RewriterTooltip';
import type { RewritePreset, RewriteSelectionData } from '@/types';
import { isRewriteEnabled } from '@/utils/settings/rewriteSettings';
import { createLogger } from '~logger';

const log = createLogger('TextRewriter');

export const config: PlasmoCSConfig = {
    matches: ['<all_urls>'],
    all_frames: false,
    // Note: chrome://, chrome-extension://, and moz-extension:// URLs are automatically
    // excluded by the browser - content scripts cannot run on these pages
};

export const getStyle = () => {
    const style = document.createElement('style');
    style.textContent = cssText;
    return style;
};

// Message type from background context menu
interface ShowRewriterMessage {
    action: 'SHOW_REWRITER';
    payload: {
        selectedText: string;
    };
}

function TextRewriterContent() {
    const { rewrittenText, isProcessing, error, rewrite, replaceSelection, reset } = useRewriter();
    const [showTooltip, setShowTooltip] = useState(false);
    const [isEnabled, setIsEnabled] = useState(true);
    const [selection, setSelection] = useState<RewriteSelectionData | null>(null);

    // Check if feature is enabled on mount
    useEffect(() => {
        const checkEnabled = async () => {
            const enabled = await isRewriteEnabled();
            setIsEnabled(enabled);
        };
        void checkEnabled();
    }, []);

    // Listen for messages from background script (context menu click)
    useEffect(() => {
        const handleMessage = (
            message: ShowRewriterMessage,
            _sender: chrome.runtime.MessageSender,
            sendResponse: (response?: unknown) => void
        ) => {
            if (message.action === 'SHOW_REWRITER') {
                log.info('Received SHOW_REWRITER from context menu', {
                    textLength: message.payload.selectedText.length,
                });

                // Get the current selection from the DOM
                const windowSelection = window.getSelection();
                if (!windowSelection || windowSelection.isCollapsed) {
                    log.warn('No active selection found');
                    sendResponse({ success: false, error: 'No selection' });
                    return true;
                }

                const range = windowSelection.getRangeAt(0);
                const rect = range.getBoundingClientRect();

                // Position tooltip centered above the selection
                const x = rect.left + window.scrollX + rect.width / 2;
                const y = rect.top + window.scrollY - 10;

                // Get the target element (for context)
                const targetElement = range.commonAncestorContainer instanceof HTMLElement
                    ? range.commonAncestorContainer
                    : range.commonAncestorContainer.parentElement || undefined;

                // Set selection data and show tooltip
                setSelection({
                    text: message.payload.selectedText,
                    range: range.cloneRange(),
                    position: { x, y },
                    targetElement,
                });
                setShowTooltip(true);

                sendResponse({ success: true });
                return true;
            }
            return false;
        };

        chrome.runtime.onMessage.addListener(handleMessage);

        return () => {
            chrome.runtime.onMessage.removeListener(handleMessage);
        };
    }, []);

    // Handle preset click
    const handlePresetClick = useCallback((
        preset: RewritePreset,
        toolSettings?: { enableUrlContext: boolean; enableGoogleSearch: boolean }
    ) => {
        if (selection) {
            log.debug('Preset selected', { preset, textLength: selection.text.length, toolSettings });
            void rewrite(selection.text, undefined, preset, toolSettings);
        }
    }, [selection, rewrite]);

    // Handle custom instruction rewrite
    const handleCustomRewrite = useCallback((
        instruction: string,
        toolSettings?: { enableUrlContext: boolean; enableGoogleSearch: boolean }
    ) => {
        if (selection && instruction.trim()) {
            log.debug('Custom rewrite', { instruction, textLength: selection.text.length, toolSettings });
            void rewrite(selection.text, instruction, undefined, toolSettings);
        }
    }, [selection, rewrite]);

    // Handle apply - replace selection with rewritten text
    const handleApply = useCallback(() => {
        if (selection && rewrittenText) {
            log.debug('Applying rewrite', { outputLength: rewrittenText.length });
            const success = replaceSelection(selection.range, rewrittenText);
            if (success) {
                log.info('Rewrite applied successfully');
                handleClose();
            } else {
                log.error('Failed to apply rewrite - trying clipboard fallback');
                // Fallback: copy to clipboard
                navigator.clipboard.writeText(rewrittenText).catch(() => {
                    log.error('Clipboard fallback also failed');
                });
            }
        }
    }, [selection, rewrittenText, replaceSelection]);

    // Handle close/cleanup
    const handleClose = useCallback(() => {
        setShowTooltip(false);
        setSelection(null);
        reset();
    }, [reset]);

    // Don't render if feature is disabled or no selection to show
    if (!isEnabled || !selection || !showTooltip) {
        return null;
    }

    return (
        <RewriterTooltip
            position={selection.position}
            selectedText={selection.text}
            rewrittenText={rewrittenText}
            isProcessing={isProcessing}
            error={error}
            onPresetClick={handlePresetClick}
            onCustomRewrite={handleCustomRewrite}
            onApply={handleApply}
            onClose={handleClose}
        />
    );
}

export default TextRewriterContent;
