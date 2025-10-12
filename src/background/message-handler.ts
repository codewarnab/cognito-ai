/**
 * Message handler for background service worker
 */

import { isHostBlocked, updateSettings, openDb } from '../db/index';
import { isModelReady, getModelDebugInfo } from './model-ready';
import { isPaused, setPaused, getSetting } from './settings';
import { enqueuePageSeen, clearQueue, getQueueStats } from './queue';
import { scheduleWipe, cancelWipe } from './privacy';
import { runSchedulerTick, getProcessingStatus } from './scheduler';
import { getStats, getMiniSearchInstance } from '../search/minisearch';
import type { BgMsgFromContent, BgMsgToContent, OffscreenMsgToBg } from './types';

/**
 * Handle incoming messages from content scripts, popup, and offscreen
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
            const msg = message as BgMsgFromContent | OffscreenMsgToBg;

            switch (msg.type) {
                case 'PageSeen': {
                    // Check if paused
                    if (await isPaused()) {
                        sendResponse({ type: 'Error', message: 'Processing is paused' } as BgMsgToContent);
                        return;
                    }

                    // Check privacy settings (allowlist/denylist)
                    const settings = await chrome.storage.local.get(['paused', 'domainAllowlist', 'domainDenylist']);
                    if (isHostBlocked(msg.url, settings)) {
                        sendResponse({ type: 'Error', message: 'URL blocked by privacy settings' } as BgMsgToContent);
                        return;
                    }

                    const id = await enqueuePageSeen(
                        msg.url,
                        msg.title,
                        msg.description,
                        msg.payload,
                        'content'
                    );

                    sendResponse({ type: 'Ack', id } as BgMsgToContent);

                    // Trigger immediate processing
                    setTimeout(() => runSchedulerTick(), 0);
                    break;
                }

                case 'TogglePause': {
                    await setPaused(msg.paused);
                    sendResponse({ type: 'Ack' } as BgMsgToContent);
                    break;
                }

                case 'ClearIndex': {
                    await clearQueue();
                    sendResponse({ type: 'Ack' } as BgMsgToContent);
                    break;
                }

                case 'WorkerReady': {
                    // Offscreen worker is ready, we can set model version if not set
                    const modelVersion = await getSetting('modelVersion');
                    if (!modelVersion) {
                        await chrome.storage.local.set({ modelVersion: '1.0.0' });
                        console.log('[MessageHandler] Model version set after worker ready');
                    }
                    break;
                }

                case 'BatchResult': {
                    // Handled in scheduler
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

                case 'settings:update': {
                    // Update settings
                    await updateSettings(msg.payload);
                    sendResponse({ type: 'Ack' } as BgMsgToContent);
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

                // History page message handlers
                case 'GET_SETTINGS': {
                    try {
                        const modelReady = await isModelReady();
                        const paused = await isPaused();
                        const settings = await chrome.storage.local.get(['domainAllowlist', 'domainDenylist']);

                        sendResponse({
                            type: 'SETTINGS',
                            data: {
                                modelReady,
                                paused,
                                domainAllowlist: settings.domainAllowlist || [],
                                domainDenylist: settings.domainDenylist || []
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

                case 'UPDATE_FILTERS': {
                    try {
                        const filterMsg = msg as any;
                        const updates: any = {};
                        if (filterMsg.allowlist !== undefined) {
                            updates.domainAllowlist = filterMsg.allowlist;
                        }
                        if (filterMsg.denylist !== undefined) {
                            updates.domainDenylist = filterMsg.denylist;
                        }

                        await chrome.storage.local.set(updates);
                        sendResponse({ type: 'Ack' });
                    } catch (error) {
                        sendResponse({
                            type: 'ERROR',
                            code: 'UPDATE_FILTERS_ERROR',
                            message: String(error)
                        });
                    }
                    break;
                }

                case 'CLEAR_INDEX': {
                    try {
                        await clearQueue();
                        sendResponse({ type: 'CLEAR_OK' });
                    } catch (error) {
                        sendResponse({
                            type: 'ERROR',
                            code: 'CLEAR_INDEX_ERROR',
                            message: String(error)
                        });
                    }
                    break;
                }

                case 'GetIndexStats': {
                    try {
                        const stats = await getStats();
                        sendResponse({ stats });
                    } catch (error) {
                        sendResponse({ error: String(error) });
                    }
                    break;
                }

                case 'GetQueueStats': {
                    try {
                        const stats = await getQueueStats();
                        sendResponse({ stats });
                    } catch (error) {
                        sendResponse({ error: String(error) });
                    }
                    break;
                }

                case 'GetProcessingStatus': {
                    try {
                        const status = getProcessingStatus();
                        sendResponse({ status });
                    } catch (error) {
                        sendResponse({ error: String(error) });
                    }
                    break;
                }

                case 'HistoryRAGSearch': {
                    try {
                        const historyMsg = msg as any;
                        const query = historyMsg.query;
                        const topK = historyMsg.topK || 10;

                        if (!query || query.trim().length === 0) {
                            sendResponse({
                                error: 'Query cannot be empty',
                                results: []
                            });
                            break;
                        }

                        // Get MiniSearch instance for sparse search
                        const miniSearchInstance = getMiniSearchInstance();
                        if (!miniSearchInstance) {
                            sendResponse({
                                error: 'Search index not ready',
                                results: []
                            });
                            break;
                        }

                        // Perform MiniSearch query (sparse search)
                        const sparseResults = miniSearchInstance.search(query, {
                            prefix: true,
                            fuzzy: 0.2
                        }).slice(0, topK * 2); // Get more for diversity

                        // Get database instance
                        const db = await openDb();

                        // Get page metadata for results
                        const results = await Promise.all(
                            sparseResults.slice(0, topK).map(async (result: any) => {
                                try {
                                    // Get chunk for URL and snippet
                                    const chunk = await db.chunks.get(result.id);
                                    if (!chunk) {
                                        return null;
                                    }

                                    // Try to get page metadata for title
                                    const page = await db.pages.get(chunk.url);

                                    return {
                                        url: chunk.url,
                                        title: page?.title || chunk.url,
                                        snippet: chunk.text.substring(0, 200),
                                        score: result.score
                                    };
                                } catch (err) {
                                    console.error('[HistoryRAGSearch] Error processing result:', err);
                                    return null;
                                }
                            })
                        );

                        // Filter out null results
                        const validResults = results.filter(r => r !== null);

                        sendResponse({
                            results: validResults
                        });
                    } catch (error) {
                        console.error('[MessageHandler] HistoryRAGSearch error:', error);
                        sendResponse({
                            error: String(error),
                            results: []
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
