/**
 * Message Router
 * 
 * Central message routing system that delegates messages to specialized handlers
 */

import { createLogger } from '~logger';
import { handleMcpMessage } from './mcpHandler';
import { handleWebMCPMessage, isWebMCPMessage } from './webmcpHandler';
import { handleFileMessage } from './fileHandler';
import { handleUiMessage } from './uiHandler';
import { handleSummarizeRequest } from '../summarizer';
import { handleWriteGenerate } from '../writer';
import { handleRewriteRequest } from '../rewriter';
import { handleAskGenerate } from '../asker';
import { isMemorySearchAvailable as checkSupermemoryReady } from '../supermemory';
import { queueThreadForExtraction } from '../supermemory/extraction/queue';

const backgroundLog = createLogger('Background-Router', 'BACKGROUND');

/**
 * Initialize the message router
 * Sets up the main chrome.runtime.onMessage listener
 */
export function initializeMessageRouter(): void {
    chrome.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
        backgroundLog.info(' Received message:', message.type || message.action, message);

        // Handle GET_CURRENT_TAB_ID request from content scripts
        if (message.type === 'GET_CURRENT_TAB_ID') {
            sendResponse({ tabId: sender.tab?.id });
            return false; // Synchronous response
        }

        // Route WebMCP messages (before MCP to avoid conflicts)
        if (isWebMCPMessage(message)) {
            handleWebMCPMessage(message, sender, sendResponse);
            return true; // Will respond asynchronously
        }

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

        // Handle Supermemory ready check
        if (message.type === 'CHECK_SUPERMEMORY_READY') {
            checkSupermemoryReady().then((ready) => {
                sendResponse({ ready });
            }).catch(() => {
                sendResponse({ ready: false });
            });
            return true; // Will respond asynchronously
        }

        // Handle memory extraction queue request
        if (message.type === 'QUEUE_MEMORY_EXTRACTION') {
            queueThreadForExtraction(message.threadId, message.messageCount)
                .then(() => {
                    sendResponse({ success: true });
                })
                .catch((error) => {
                    backgroundLog.error('Failed to queue extraction', {
                        threadId: message.threadId,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                    sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown' });
                });
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

/**
 * Initialize the writer port listener
 * Handles streaming write generation requests via chrome.runtime.connect
 */
export function initializeWriterPortListener(): void {
    chrome.runtime.onConnect.addListener((port) => {
        if (port.name === 'write-command') {
            backgroundLog.info('Write command port connected');

            port.onMessage.addListener(async (message) => {
                if (message.action === 'WRITE_GENERATE') {
                    await handleWriteGenerate(message, port);
                }
            });

            port.onDisconnect.addListener(() => {
                backgroundLog.debug('Write command port disconnected');
            });
        }
    });

    backgroundLog.info('Writer port listener initialized');
}

/**
 * Initialize the rewriter port listener
 * Handles text rewrite requests (non-streaming) via chrome.runtime.connect
 */
export function initializeRewriterPortListener(): void {
    chrome.runtime.onConnect.addListener((port) => {
        if (port.name === 'text-rewriter') {
            backgroundLog.info('Text rewriter port connected');

            port.onMessage.addListener(async (message) => {
                if (message.action === 'REWRITE_REQUEST') {
                    await handleRewriteRequest(message, port);
                }
            });

            port.onDisconnect.addListener(() => {
                backgroundLog.debug('Text rewriter port disconnected');
            });
        }
    });

    backgroundLog.info('Rewriter port listener initialized');
}

/**
 * Initialize the asker port listener
 * Handles Q&A requests via chrome.runtime.connect
 */
export function initializeAskerPortListener(): void {
    chrome.runtime.onConnect.addListener((port) => {
        if (port.name === 'ask-command') {
            backgroundLog.info('Ask command port connected');

            port.onMessage.addListener(async (message) => {
                if (message.action === 'ASK_GENERATE') {
                    await handleAskGenerate(message, port);
                }
            });

            port.onDisconnect.addListener(() => {
                backgroundLog.debug('Ask command port disconnected');
            });
        }
    });

    backgroundLog.info('Asker port listener initialized');
}
