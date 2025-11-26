/**
 * Message Router
 * 
 * Central message routing system that delegates messages to specialized handlers
 */

import { createLogger } from '~logger';
import { handleMcpMessage } from './mcpHandler';
import { handleFileMessage } from './fileHandler';
import { handleUiMessage } from './uiHandler';
import { handleSummarizeRequest } from '../summarizer';

const backgroundLog = createLogger('Background-Router', 'BACKGROUND');

/**
 * Initialize the message router
 * Sets up the main chrome.runtime.onMessage listener
 */
export function initializeMessageRouter(): void {
    chrome.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
        backgroundLog.info(' Received message:', message.type || message.action, message);

        // Route MCP messages
        if (message.type?.startsWith('mcp/')) {
            handleMcpMessage(message, sender, sendResponse);
            return true; // Will respond asynchronously
        }

        // Route file messages
        if (message.type === 'READ_LOCAL_PDF') {
            handleFileMessage(message, sender, sendResponse);
            return true; // Will respond asynchronously
        }

        // Route UI messages
        if (
            message.action === 'OPEN_SIDEBAR' ||
            message.action === 'OPEN_SIDEBAR_WITH_MESSAGE' ||
            message.type === 'MODEL_DOWNLOAD_PROGRESS' ||
            message.type === 'ai/notification/create' ||
            message.type === 'summarize:availability' ||
            message.type === 'summarize:request'
        ) {
            handleUiMessage(message, sender, sendResponse);
            return true; // Will respond asynchronously
        }

        // Return false for unhandled messages
        return false;
    });

    backgroundLog.info('Message router initialized');
}

/**
 * Initialize the summarizer port listener
 * Handles streaming summarization requests via chrome.runtime.connect
 */
export function initializeSummarizerPortListener(): void {
    chrome.runtime.onConnect.addListener((port) => {
        if (port.name === 'text-summarizer') {
            backgroundLog.info('Text summarizer port connected');

            port.onMessage.addListener(async (message) => {
                if (message.action === 'SUMMARIZE_REQUEST') {
                    await handleSummarizeRequest(message, port);
                }
            });

            port.onDisconnect.addListener(() => {
                backgroundLog.debug('Text summarizer port disconnected');
            });
        }
    });

    backgroundLog.info('Summarizer port listener initialized');
}
