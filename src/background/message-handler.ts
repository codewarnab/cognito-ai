/**
 * Message handler for background service worker
 */

import { isModelReady, getModelDebugInfo } from './model-ready';
import { isPaused, setPaused } from './settings';
import { scheduleWipe, cancelWipe } from './privacy';
import type { BgMsgFromContent, BgMsgToContent } from './types';

/**
 * Handle incoming messages from content scripts, popup, and sidepanel
 */
export async function handleMessage(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
): Promise<void> {
    console.log('[MessageHandler] Message received:', message, 'from:', sender);

    try {
        // Handle messages
        if ('type' in message) {
            const msg = message as BgMsgFromContent;

            switch (msg.type) {
                case 'TogglePause': {
                    await setPaused(msg.paused);
                    sendResponse({ type: 'Ack' } as BgMsgToContent);
                    break;
                }

                case 'CheckModelReady': {
                    // Check model readiness
                    const ready = await isModelReady();
                    sendResponse({ ready });
                    break;
                }

                case 'GetModelDebugInfo': {
                    // Get model debug info
                    const debugInfo = await getModelDebugInfo();
                    sendResponse(debugInfo);
                    break;
                }

                case 'privacy:wipe': {
                    // Schedule or execute data wipe
                    await scheduleWipe(msg.alsoRemoveModel ?? false, msg.delayMs ?? 0);
                    sendResponse({ type: 'Ack' } as BgMsgToContent);
                    break;
                }

                case 'privacy:wipe:cancel': {
                    // Cancel pending wipe
                    await cancelWipe();
                    sendResponse({ type: 'Ack' } as BgMsgToContent);
                    break;
                }

                case 'GET_SETTINGS': {
                    try {
                        const modelReady = await isModelReady();
                        const paused = await isPaused();

                        sendResponse({
                            type: 'SETTINGS',
                            data: {
                                modelReady,
                                paused
                            }
                        });
                    } catch (error) {
                        sendResponse({
                            type: 'ERROR',
                            code: 'SETTINGS_LOAD_ERROR',
                            message: String(error)
                        });
                    }
                    break;
                }

                case 'SET_PAUSED': {
                    try {
                        const pausedMsg = msg as any;
                        await setPaused(pausedMsg.paused);
                        sendResponse({ type: 'Ack' });
                    } catch (error) {
                        sendResponse({
                            type: 'ERROR',
                            code: 'SET_PAUSED_ERROR',
                            message: String(error)
                        });
                    }
                    break;
                }

                default:
                    console.warn('[MessageHandler] Unknown message type:', (msg as any).type);
            }
        }
    } catch (error) {
        console.error('[MessageHandler] Error:', error);
        sendResponse({ type: 'Error', message: String(error) } as BgMsgToContent);
    }
}
