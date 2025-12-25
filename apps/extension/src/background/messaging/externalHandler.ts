import { createLogger } from '~logger';
import {
    ExternalMessage,
    ExternalResponse,
    SetProviderPayload,
    ClearProviderPayload,
    GetProviderConfigResponse,
    SearchSettingsWithKeys,
    AskAIButtonSettings,
    TextSummarizerSettings,
    TextRewriterSettings,
    WriteCommandSettings,
    SupermemorySettings,
    ResearchWorkflowSettings,
    AIConfigSettings,
    TTSSettings,
    VoiceSettings,
    PreviewVoicePayload,
    PreviewVoiceResponse,
    DeleteAllChatsResponse,
    CreateReminderPayload,
    DeleteReminderPayload,
    UpdateReminderPayload,
    Reminder,
} from '@cognito/shared/types';
import { openSidePanel, openSidePanelForTab } from '@/background/sidepanelUtils';
import {
    getProviderConfig,
    setGoogleApiKey,
    setVertexCredentials,
    clearGoogleApiKey,
    clearVertexCredentials,
    hasGoogleApiKey,
    hasVertexCredentials,
    setSelectedProvider,
} from '@/utils/credentials';
// Settings utilities
import {
    getSearchSettings,
    saveSearchSettings,
    getSearchApiKeys,
    saveSearchApiKeys,
} from '@/utils/settings/searchSettings';
import {
    getVisibilitySettings,
    hideForever,
    reEnableButton,
    hideForSession,
    clearSessionHide,
    removeDomainFromHidden,
    clearAllHiddenDomains,
    hideForCurrentPage,
} from '@/utils/settings/ask-ai-button-visibility';
import {
    getTextSummarizerSettings,
    saveTextSummarizerSettings,
} from '@/utils/settings/textSummarizerSettings';
import {
    getRewriteSettings,
    saveRewriteSettings,
} from '@/utils/settings/rewriteSettings';
import {
    getWriteCommandSettings,
    saveWriteCommandSettings,
} from '@/utils/settings/writeCommandSettings';
import {
    getResearchWorkflowSettings,
    saveResearchWorkflowSettings,
} from '@/utils/settings/researchWorkflowSettings';
import {
    getSuggestionsEnabled,
    setSuggestionsEnabled,
    getTTSProvider,
    setTTSProvider,
    getVoiceName,
    setVoiceName,
    getMaxToolCallLimit,
    setMaxToolCallLimit,
    getSupermemoryApiKey,
    setSupermemoryApiKey,
    getSupermemoryEnabled,
    setSupermemoryEnabled,
} from '@/utils/settings/settingsStorage';
// Supermemory specific settings
import {
    isAutoExtractionEnabled,
    setAutoExtractionEnabled,
    isContentMemoryEnabled,
    setContentMemoryEnabled,
} from '@/utils/supermemory';
// Database utilities
import { clearChatHistory, getDBStats } from '@/db';
// Voice utilities
import { generateSpeech } from '@/utils/ai';
import { getGoogleApiKey } from '@/utils/credentials';
// Reminder utilities
import {
    getActiveReminders,
    saveReminder,
    deleteReminder,
    updateReminder,
} from '@/actions/reminder/storage';

const log = createLogger('ExternalMessaging', 'BACKGROUND');

export function initializeExternalMessageRouter(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chrome.runtime.onMessageExternal.addListener((message: ExternalMessage, sender, sendResponse: (response: ExternalResponse<any>) => void) => {
        log.info('Received external message:', message.type, 'from', sender.url);

        // Verify sender
        const allowedOrigins = [
            'http://localhost:3002',
            'https://app.cognito.ai',
        ];

        const origin = sender.url ? new URL(sender.url).origin : null;
        if (!origin || !allowedOrigins.some(allowed => origin === allowed || (allowed.includes('*') && origin.match(allowed)))) {
            // Basic check, though manifest 'externally_connectable' already filters this at browser level
            // double check doesn't hurt.
            // However, for localhost:3002, we should be fine.
        }

        handleExternalMessage(message, sender)
            .then(response => {
                sendResponse(response);
            })
            .catch(error => {
                log.error('Error handling external message:', error);
                sendResponse({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            });

        return true; // Async response
    });

    log.info('External message router initialized');
}

async function handleExternalMessage(message: ExternalMessage, sender: chrome.runtime.MessageSender): Promise<ExternalResponse> {
    const { type } = message;

    switch (type) {
        // =================================================================
        // Lifecycle Messages
        // =================================================================
        case 'PING':
            return {
                success: true,
                version: chrome.runtime.getManifest().version
            };

        case 'OPEN_SIDEPANEL':
            // Try to open sidepanel in the current window of the sender if possible
            if (sender.tab?.id) {
                const success = await openSidePanelForTab(sender.tab.id);
                return { success };
            }

            if (sender.tab?.windowId) {
                const success = await openSidePanel(sender.tab.windowId);
                return { success };
            }

            // Fallback to last focused window
            const window = await chrome.windows.getLastFocused();
            if (window.id) {
                const success = await openSidePanel(window.id);
                return { success };
            }

            return { success: false, error: 'Could not determine window to open sidepanel' };

        // =================================================================
        // Onboarding Messages
        // =================================================================
        case 'GET_ONBOARDING_STATUS':
            const { onboarding_completed } = await chrome.storage.local.get('onboarding_completed');
            return { success: true, data: { completed: !!onboarding_completed } };

        case 'SET_ONBOARDING_COMPLETE':
            await chrome.storage.local.set({ onboarding_completed: true });
            return { success: true };

        // =================================================================
        // Reminder Messages
        // =================================================================
        case 'GET_REMINDERS': {
            try {
                const reminders = await getActiveReminders();
                return { success: true, data: reminders };
            } catch (error) {
                log.error('Failed to get reminders', error);
                return { success: false, error: 'Failed to get reminders' };
            }
        }

        case 'CREATE_REMINDER': {
            try {
                const payload = message.payload as CreateReminderPayload;
                if (!payload) {
                    return { success: false, error: 'Missing payload' };
                }

                const id = crypto.randomUUID();
                const reminder: Reminder = {
                    id,
                    title: payload.title,
                    when: payload.when,
                    createdAt: Date.now(),
                    generatedTitle: payload.generatedTitle,
                    generatedDescription: payload.generatedDescription,
                    repeat: payload.repeat || 'none',
                };

                await saveReminder(reminder);
                await chrome.alarms.create(`reminder:${id}`, { when: reminder.when });

                log.info('Created reminder via external message', { id });
                return { success: true, data: reminder };
            } catch (error) {
                log.error('Failed to create reminder', error);
                return { success: false, error: 'Failed to create reminder' };
            }
        }

        case 'UPDATE_REMINDER': {
            try {
                const payload = message.payload as UpdateReminderPayload;
                if (!payload?.id || !payload?.updates) {
                    return { success: false, error: 'Missing id or updates in payload' };
                }

                const updated = await updateReminder(payload.id, payload.updates);

                // Reschedule alarm if time changed
                if (payload.updates.when !== undefined) {
                    await chrome.alarms.clear(`reminder:${payload.id}`);
                    if (!updated.isPaused) {
                        await chrome.alarms.create(`reminder:${payload.id}`, { when: updated.when });
                    }
                }

                log.info('Updated reminder via external message', { id: payload.id });
                return { success: true, data: updated };
            } catch (error) {
                log.error('Failed to update reminder', error);
                return { success: false, error: error instanceof Error ? error.message : 'Failed to update reminder' };
            }
        }

        case 'DELETE_REMINDER': {
            try {
                const payload = message.payload as DeleteReminderPayload;
                if (!payload?.id) {
                    return { success: false, error: 'Missing id in payload' };
                }

                // Clear the alarm first
                await chrome.alarms.clear(`reminder:${payload.id}`);
                // Delete from storage
                await deleteReminder(payload.id);

                log.info('Deleted reminder via external message', { id: payload.id });
                return { success: true };
            } catch (error) {
                log.error('Failed to delete reminder', error);
                return { success: false, error: 'Failed to delete reminder' };
            }
        }

        // =================================================================
        // General Settings Messages
        // =================================================================
        case 'GET_ALL_SETTINGS':
            const allData = await chrome.storage.local.get(null);
            return {
                success: true,
                data: allData
            };

        // =================================================================
        // Provider Config Messages
        // =================================================================
        case 'GET_PROVIDER_CONFIG': {
            try {
                const config = await getProviderConfig();
                const hasGoogle = await hasGoogleApiKey();
                const hasVertex = await hasVertexCredentials();

                const response: GetProviderConfigResponse = {
                    config,
                    hasGoogle,
                    hasVertex,
                };

                return { success: true, data: response };
            } catch (error) {
                log.error('Failed to get provider config', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to get provider config'
                };
            }
        }

        case 'SET_PROVIDER_CONFIG': {
            try {
                const payload = message.payload as SetProviderPayload;
                if (!payload) {
                    return { success: false, error: 'Missing payload' };
                }

                if (payload.provider === 'google') {
                    if (!payload.googleApiKey) {
                        return { success: false, error: 'Google API key is required' };
                    }
                    await setGoogleApiKey(payload.googleApiKey);
                    await setSelectedProvider('google');
                    log.info('Google API key saved via external message');
                } else if (payload.provider === 'vertex') {
                    if (!payload.vertexCredentials) {
                        return { success: false, error: 'Vertex credentials are required' };
                    }
                    await setVertexCredentials(payload.vertexCredentials);
                    await setSelectedProvider('vertex');
                    log.info('Vertex credentials saved via external message');
                } else {
                    return { success: false, error: 'Invalid provider' };
                }

                return { success: true };
            } catch (error) {
                log.error('Failed to set provider config', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to set provider config'
                };
            }
        }

        case 'CLEAR_PROVIDER_CONFIG': {
            try {
                const payload = message.payload as ClearProviderPayload;
                if (!payload) {
                    return { success: false, error: 'Missing payload' };
                }

                if (payload.provider === 'google') {
                    await clearGoogleApiKey();
                    log.info('Google API key cleared via external message');
                } else if (payload.provider === 'vertex') {
                    await clearVertexCredentials();
                    log.info('Vertex credentials cleared via external message');
                } else {
                    return { success: false, error: 'Invalid provider' };
                }

                return { success: true };
            } catch (error) {
                log.error('Failed to clear provider config', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to clear provider config'
                };
            }
        }

        // =================================================================
        // Search Settings Messages
        // =================================================================
        case 'GET_SEARCH_SETTINGS': {
            try {
                const settings = await getSearchSettings();
                const apiKeys = await getSearchApiKeys();
                const response: SearchSettingsWithKeys = {
                    ...settings,
                    apiKeys,
                };
                return { success: true, data: response };
            } catch (error) {
                log.error('Failed to get search settings', error);
                return { success: false, error: 'Failed to get search settings' };
            }
        }

        case 'SET_SEARCH_SETTINGS': {
            try {
                const payload = message.payload as Partial<SearchSettingsWithKeys>;
                if (!payload) {
                    return { success: false, error: 'Missing payload' };
                }

                // Separate settings and API keys
                const { apiKeys, ...settings } = payload;

                if (Object.keys(settings).length > 0) {
                    const current = await getSearchSettings();
                    await saveSearchSettings({ ...current, ...settings });
                }

                if (apiKeys) {
                    const currentKeys = await getSearchApiKeys();
                    await saveSearchApiKeys({ ...currentKeys, ...apiKeys });
                }

                return { success: true };
            } catch (error) {
                log.error('Failed to set search settings', error);
                return { success: false, error: 'Failed to set search settings' };
            }
        }

        // =================================================================
        // Ask AI Button Settings Messages
        // =================================================================
        case 'GET_ASK_AI_SETTINGS': {
            try {
                const settings = await getVisibilitySettings();
                const response: AskAIButtonSettings = settings;
                return { success: true, data: response };
            } catch (error) {
                log.error('Failed to get Ask AI settings', error);
                return { success: false, error: 'Failed to get Ask AI settings' };
            }
        }

        case 'SET_ASK_AI_SETTINGS': {
            try {
                const payload = message.payload as Partial<AskAIButtonSettings> & { action?: string; domain?: string };
                if (!payload) {
                    return { success: false, error: 'Missing payload' };
                }

                // Handle specific actions
                if (payload.action === 'hideForever') {
                    await hideForever();
                } else if (payload.action === 'reEnable') {
                    await reEnableButton();
                } else if (payload.action === 'hideForSession') {
                    await hideForSession();
                } else if (payload.action === 'clearSessionHide') {
                    await clearSessionHide();
                } else if (payload.action === 'removeDomain' && payload.domain) {
                    await removeDomainFromHidden(payload.domain);
                } else if (payload.action === 'clearAllDomains') {
                    await clearAllHiddenDomains();
                } else if (payload.action === 'hideForPage' && payload.domain) {
                    await hideForCurrentPage(payload.domain);
                } else if (payload.permanentlyHidden !== undefined) {
                    if (payload.permanentlyHidden) {
                        await hideForever();
                    } else {
                        await reEnableButton();
                    }
                }

                return { success: true };
            } catch (error) {
                log.error('Failed to set Ask AI settings', error);
                return { success: false, error: 'Failed to set Ask AI settings' };
            }
        }

        // =================================================================
        // Text Summarizer Settings Messages
        // =================================================================
        case 'GET_SUMMARIZER_SETTINGS': {
            try {
                const settings = await getTextSummarizerSettings();
                return { success: true, data: settings as TextSummarizerSettings };
            } catch (error) {
                log.error('Failed to get summarizer settings', error);
                return { success: false, error: 'Failed to get summarizer settings' };
            }
        }

        case 'SET_SUMMARIZER_SETTINGS': {
            try {
                const payload = message.payload as Partial<TextSummarizerSettings>;
                if (!payload) {
                    return { success: false, error: 'Missing payload' };
                }

                const current = await getTextSummarizerSettings();
                await saveTextSummarizerSettings({ ...current, ...payload });
                return { success: true };
            } catch (error) {
                log.error('Failed to set summarizer settings', error);
                return { success: false, error: 'Failed to set summarizer settings' };
            }
        }

        // =================================================================
        // Text Rewriter Settings Messages
        // =================================================================
        case 'GET_REWRITER_SETTINGS': {
            try {
                const settings = await getRewriteSettings();
                return { success: true, data: settings as TextRewriterSettings };
            } catch (error) {
                log.error('Failed to get rewriter settings', error);
                return { success: false, error: 'Failed to get rewriter settings' };
            }
        }

        case 'SET_REWRITER_SETTINGS': {
            try {
                const payload = message.payload as Partial<TextRewriterSettings>;
                if (!payload) {
                    return { success: false, error: 'Missing payload' };
                }

                const current = await getRewriteSettings();
                await saveRewriteSettings({ ...current, ...payload });
                return { success: true };
            } catch (error) {
                log.error('Failed to set rewriter settings', error);
                return { success: false, error: 'Failed to set rewriter settings' };
            }
        }

        // =================================================================
        // Write Command Settings Messages
        // =================================================================
        case 'GET_WRITE_SETTINGS': {
            try {
                const settings = await getWriteCommandSettings();
                return { success: true, data: settings as WriteCommandSettings };
            } catch (error) {
                log.error('Failed to get write settings', error);
                return { success: false, error: 'Failed to get write settings' };
            }
        }

        case 'SET_WRITE_SETTINGS': {
            try {
                const payload = message.payload as Partial<WriteCommandSettings>;
                if (!payload) {
                    return { success: false, error: 'Missing payload' };
                }

                const current = await getWriteCommandSettings();
                await saveWriteCommandSettings({ ...current, ...payload });
                return { success: true };
            } catch (error) {
                log.error('Failed to set write settings', error);
                return { success: false, error: 'Failed to set write settings' };
            }
        }

        // =================================================================
        // Supermemory Settings Messages
        // =================================================================
        case 'GET_SUPERMEMORY_SETTINGS': {
            try {
                const apiKey = await getSupermemoryApiKey() || '';
                const enabled = await getSupermemoryEnabled();
                const autoExtraction = await isAutoExtractionEnabled();
                const contentMemory = await isContentMemoryEnabled();

                const response: SupermemorySettings = {
                    apiKey,
                    enabled,
                    autoExtraction,
                    contentMemory,
                };
                return { success: true, data: response };
            } catch (error) {
                log.error('Failed to get Supermemory settings', error);
                return { success: false, error: 'Failed to get Supermemory settings' };
            }
        }

        case 'SET_SUPERMEMORY_SETTINGS': {
            try {
                const payload = message.payload as Partial<SupermemorySettings>;
                if (!payload) {
                    return { success: false, error: 'Missing payload' };
                }

                if (payload.apiKey !== undefined) {
                    await setSupermemoryApiKey(payload.apiKey || undefined);
                }
                if (payload.enabled !== undefined) {
                    await setSupermemoryEnabled(payload.enabled);
                }
                if (payload.autoExtraction !== undefined) {
                    await setAutoExtractionEnabled(payload.autoExtraction);
                }
                if (payload.contentMemory !== undefined) {
                    await setContentMemoryEnabled(payload.contentMemory);
                }

                return { success: true };
            } catch (error) {
                log.error('Failed to set Supermemory settings', error);
                return { success: false, error: 'Failed to set Supermemory settings' };
            }
        }

        // =================================================================
        // Research Workflow Settings Messages
        // =================================================================
        case 'GET_RESEARCH_SETTINGS': {
            try {
                const settings = await getResearchWorkflowSettings();
                return { success: true, data: settings as ResearchWorkflowSettings };
            } catch (error) {
                log.error('Failed to get research settings', error);
                return { success: false, error: 'Failed to get research settings' };
            }
        }

        case 'SET_RESEARCH_SETTINGS': {
            try {
                const payload = message.payload as Partial<ResearchWorkflowSettings>;
                if (!payload) {
                    return { success: false, error: 'Missing payload' };
                }

                const current = await getResearchWorkflowSettings();
                await saveResearchWorkflowSettings({ ...current, ...payload });
                return { success: true };
            } catch (error) {
                log.error('Failed to set research settings', error);
                return { success: false, error: 'Failed to set research settings' };
            }
        }

        // =================================================================
        // TTS Settings Messages
        // =================================================================
        case 'GET_TTS_SETTINGS': {
            try {
                const ttsProvider = await getTTSProvider();
                const suggestionsEnabled = await getSuggestionsEnabled();

                const response: TTSSettings = {
                    ttsProvider,
                    suggestionsEnabled,
                };
                return { success: true, data: response };
            } catch (error) {
                log.error('Failed to get TTS settings', error);
                return { success: false, error: 'Failed to get TTS settings' };
            }
        }

        case 'SET_TTS_SETTINGS': {
            try {
                const payload = message.payload as Partial<TTSSettings>;
                if (!payload) {
                    return { success: false, error: 'Missing payload' };
                }

                if (payload.ttsProvider !== undefined) {
                    await setTTSProvider(payload.ttsProvider);
                }
                if (payload.suggestionsEnabled !== undefined) {
                    await setSuggestionsEnabled(payload.suggestionsEnabled);
                }

                return { success: true };
            } catch (error) {
                log.error('Failed to set TTS settings', error);
                return { success: false, error: 'Failed to set TTS settings' };
            }
        }

        // =================================================================
        // Voice Settings Messages
        // =================================================================
        case 'GET_VOICE_SETTINGS': {
            try {
                const voiceName = await getVoiceName();
                const response: VoiceSettings = { voiceName };
                return { success: true, data: response };
            } catch (error) {
                log.error('Failed to get voice settings', error);
                return { success: false, error: 'Failed to get voice settings' };
            }
        }

        case 'SET_VOICE_SETTINGS': {
            try {
                const payload = message.payload as Partial<VoiceSettings>;
                if (!payload) {
                    return { success: false, error: 'Missing payload' };
                }

                if (payload.voiceName !== undefined) {
                    await setVoiceName(payload.voiceName);
                }

                return { success: true };
            } catch (error) {
                log.error('Failed to set voice settings', error);
                return { success: false, error: 'Failed to set voice settings' };
            }
        }

        // =================================================================
        // AI Config Settings Messages
        // =================================================================
        case 'GET_AI_CONFIG': {
            try {
                const maxToolCallLimit = await getMaxToolCallLimit();
                const response: AIConfigSettings = { maxToolCallLimit };
                return { success: true, data: response };
            } catch (error) {
                log.error('Failed to get AI config', error);
                return { success: false, error: 'Failed to get AI config' };
            }
        }

        case 'SET_AI_CONFIG': {
            try {
                const payload = message.payload as Partial<AIConfigSettings>;
                if (!payload) {
                    return { success: false, error: 'Missing payload' };
                }

                if (payload.maxToolCallLimit !== undefined) {
                    // Clamp value between 1 and 50
                    const clamped = Math.max(1, Math.min(50, payload.maxToolCallLimit));
                    await setMaxToolCallLimit(clamped);
                }

                return { success: true };
            } catch (error) {
                log.error('Failed to set AI config', error);
                return { success: false, error: 'Failed to set AI config' };
            }
        }

        // =================================================================
        // Data Operations Messages
        // =================================================================
        case 'DELETE_ALL_CHATS': {
            try {
                const statsBefore = await getDBStats();
                await clearChatHistory();
                const statsAfter = await getDBStats();

                const response: DeleteAllChatsResponse = {
                    messagesDeleted: statsBefore.chatMessageCount - statsAfter.chatMessageCount,
                    threadsDeleted: statsBefore.threadCount - statsAfter.threadCount,
                };
                log.info('All chats deleted via external message', response);
                return { success: true, data: response };
            } catch (error) {
                log.error('Failed to delete all chats', error);
                return { success: false, error: 'Failed to delete all chats' };
            }
        }

        case 'PREVIEW_VOICE': {
            try {
                const payload = message.payload as PreviewVoicePayload;
                if (!payload?.voiceName) {
                    return { success: false, error: 'Voice name is required' };
                }

                const apiKey = await getGoogleApiKey();
                if (!apiKey) {
                    return { success: false, error: 'API key not configured' };
                }

                const text = payload.text || 'Hello! I am your AI assistant. This is how I sound.';
                const audioBuffer = await generateSpeech(text, apiKey, { voiceName: payload.voiceName });

                // Convert ArrayBuffer to base64
                const uint8Array = new Uint8Array(audioBuffer);
                let binary = '';
                for (let i = 0; i < uint8Array.length; i++) {
                    binary += String.fromCharCode(uint8Array[i]!);
                }
                const audioData = btoa(binary);

                const response: PreviewVoiceResponse = {
                    audioData,
                    mimeType: 'audio/wav',
                };
                return { success: true, data: response };
            } catch (error) {
                log.error('Failed to preview voice', error);
                return { success: false, error: error instanceof Error ? error.message : 'Failed to preview voice' };
            }
        }

        default:
            return {
                success: false,
                error: `Unknown message type: ${type}`
            };
    }
}
