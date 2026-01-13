/**
 * Backend Mode Handler
 * Routes to Vercel backend when backend mode is enabled
 */

import { createLogger } from '~logger';

import { getMaxToolCallLimit, getToolsMode } from '@/utils/settings';
import { getSearchSettings } from '@/utils/settings/searchSettings';
import { useToolsStore, useMcpStore } from '@/stores';
import { streamBackendChatWithTools } from '../../backend';

import type { StreamAIParams } from './types';

const log = createLogger('AI-BackendMode', 'AI_CHAT');

/**
 * Handle backend mode - routes chat to Vercel backend
 * Returns immediately with backend stream, skipping local AI setup
 */
export async function handleBackendMode(params: StreamAIParams) {
    const { messages, abortSignal, onError, onFinishCallback, initialPageContext } = params;

    // Get current tools mode (chat/agent/adaptive)
    // 'custom' mode is treated as 'agent' for backend purposes
    const toolsMode = await getToolsMode();
    const backendMode = toolsMode === 'custom' ? 'agent' : toolsMode;

    // Get user's max tool call limit
    const userMaxSteps = await getMaxToolCallLimit();

    log.info('📡 Backend mode configuration:', { toolsMode: backendMode, maxSteps: userMaxSteps });

    // Check if search mode should be enabled for backend
    // When searchEnabled is true, backend will add and execute webSearch tool server-side
    const searchSettings = await getSearchSettings();
    const searchEnabled = searchSettings.enabled;

    log.info('🔍 Backend search mode:', { searchEnabled, searchProvider: searchSettings.defaultProvider });

    // Check if YouTube transcript tool is enabled - if so, execute it server-side for better caching
    const enabledMap = useToolsStore.getState().enabledMap;
    const youtubeEnabled = enabledMap['getYouTubeTranscript'] === true;

    log.info('📺 Backend YouTube mode:', { youtubeEnabled });

    // Get enabled MCP server names to inform the AI about available integrations
    const serverStatuses = useMcpStore.getState().serverStatuses;
    const enabledMcpServerNames = Object.values(serverStatuses)
        .filter((status) => status.isEnabled)
        .map((status) => status.serverId);

    log.info('🔌 Enabled MCP servers:', { count: enabledMcpServerNames.length, names: enabledMcpServerNames });

    return streamBackendChatWithTools({
        messages,
        systemPrompt: undefined, // Backend will use mode-appropriate prompt
        // Note: model is NOT sent - backend uses fixed model (gemini-2.5-flash)
        mode: backendMode,
        maxSteps: userMaxSteps,
        abortSignal,
        onError,
        onFinishCallback,
        initialPageContext, // Pass page context for page-aware conversations
        searchEnabled, // Tell backend to add webSearch tool
        youtubeEnabled, // Tell backend to add getYouTubeTranscript tool
        enabledMcpServerNames, // Tell backend about enabled MCP integrations
        onToolCall: (tc) => log.info('Tool call:', { name: tc.name, id: tc.id }),
        onToolResult: (tr) => log.info('Tool result:', { id: tr.id, isError: tr.isError }),
    });
}
