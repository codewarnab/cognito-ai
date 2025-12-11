/**
 * Ask Command Content Script
 * Plasmo content script that enables the /ask command in any input field
 *
 * Usage: Type "/ask" followed by your question in any text field
 * Example: "/ask what does this page say about pricing?"
 *
 * Also supports context menu: Right-click selected text → "Ask Cognito AI about..."
 */
import type { PlasmoCSConfig } from 'plasmo';
import { useCallback, useState, useEffect } from 'react';
import cssText from 'data-text:~/styles/features/ask-command.css';

import { useAskCommandDetection } from './ask-command/useAskCommandDetection';
import { useAskConversation } from './ask-command/useAskConversation';
import { usePageContextCapture } from './ask-command/usePageContextCapture';
import { AskOverlay } from './ask-command/AskOverlay';
import { AskCommandErrorBoundary } from './ask-command/ErrorBoundary';
import type { AskPageContext } from '@/types';
import { createLogger } from '~logger';

const log = createLogger('AskCommand');

export const config: PlasmoCSConfig = {
    matches: ['<all_urls>'],
    all_frames: true,
};

export const getStyle = () => {
    const style = document.createElement('style');
    style.textContent = cssText;
    return style;
};

// Message type from background context menu
interface ShowAskerMessage {
    action: 'SHOW_ASKER';
    payload: {
        selectedText: string;
    };
}

function AskCommandContent() {
    const { isAskMode, overlayPosition, setIsAskMode, isEnabled } = useAskCommandDetection();

    const { captureContext } = usePageContextCapture();
    const [pageContext, setPageContext] = useState<AskPageContext | null>(null);
    
    // State for context menu triggered overlay
    const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
    const [contextMenuSelectedText, setContextMenuSelectedText] = useState<string | null>(null);
    const [isContextMenuMode, setIsContextMenuMode] = useState(false);

    // Listen for messages from background script (context menu click)
    useEffect(() => {
        const handleMessage = (
            message: ShowAskerMessage,
            _sender: chrome.runtime.MessageSender,
            sendResponse: (response?: unknown) => void
        ) => {
            if (message.action === 'SHOW_ASKER') {
                log.info('Received SHOW_ASKER from context menu', {
                    textLength: message.payload.selectedText.length,
                });

                // Get the current selection from the DOM for positioning
                const windowSelection = window.getSelection();
                let position = { x: 100, y: 100 }; // Default fallback position

                if (windowSelection && !windowSelection.isCollapsed) {
                    const range = windowSelection.getRangeAt(0);
                    const rect = range.getBoundingClientRect();

                    // Position overlay below the selection
                    position = {
                        x: Math.max(16, Math.min(rect.left, window.innerWidth - 436)),
                        y: rect.bottom + 20,
                    };

                    // If not enough space below, position above
                    if (position.y + 500 > window.innerHeight) {
                        position.y = Math.max(16, rect.top - 520);
                    }
                }

                // Capture page context with the selected text
                const context = captureContext();
                setPageContext({
                    ...context,
                    selectedText: message.payload.selectedText,
                });

                // Set context menu mode state
                setContextMenuPosition(position);
                setContextMenuSelectedText(message.payload.selectedText);
                setIsContextMenuMode(true);

                sendResponse({ success: true });
                return true;
            }
            return false;
        };

        chrome.runtime.onMessage.addListener(handleMessage);

        return () => {
            chrome.runtime.onMessage.removeListener(handleMessage);
        };
    }, [captureContext]);

    // Capture context when overlay opens via /ask command
    useEffect(() => {
        if (isAskMode && !isContextMenuMode) {
            const context = captureContext();
            setPageContext(context);
            log.debug('Page context captured', {
                title: context.title,
                domain: context.domain,
                hasSelectedText: !!context.selectedText,
            });
        }
    }, [isAskMode, isContextMenuMode, captureContext]);

    const {
        messages,
        isGenerating,
        currentAnswer,
        error,
        askQuestion,
        clearConversation,
        cancelGeneration,
        retryLastQuestion,
    } = useAskConversation({ pageContext: pageContext || undefined });

    const handleClose = useCallback(() => {
        setIsAskMode(false);
        clearConversation();
        setPageContext(null);
        // Reset context menu state
        setIsContextMenuMode(false);
        setContextMenuPosition(null);
        setContextMenuSelectedText(null);
    }, [setIsAskMode, clearConversation]);

    // Determine if overlay should be shown
    const showOverlay = isAskMode || isContextMenuMode;
    
    // Use context menu position if in context menu mode, otherwise use detection position
    const currentPosition = isContextMenuMode && contextMenuPosition 
        ? contextMenuPosition 
        : overlayPosition;

    // Initial question for context menu mode
    const initialQuestion = isContextMenuMode && contextMenuSelectedText
        ? `What does this mean: "${contextMenuSelectedText.length > 100 ? contextMenuSelectedText.substring(0, 100) + '...' : contextMenuSelectedText}"`
        : undefined;

    if (!isEnabled || !showOverlay) {
        return null;
    }

    return (
        <AskCommandErrorBoundary onClose={handleClose}>
            <AskOverlay
                position={currentPosition}
                messages={messages}
                currentAnswer={currentAnswer}
                isGenerating={isGenerating}
                error={error}
                onAsk={askQuestion}
                onClose={handleClose}
                onClearConversation={clearConversation}
                onCancelGeneration={cancelGeneration}
                onRetry={retryLastQuestion}
                initialQuestion={initialQuestion}
            />
        </AskCommandErrorBoundary>
    );
}

export default AskCommandContent;
