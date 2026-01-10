/**
 * Frontend AI Logic - Main Entry Point
 * Direct AI backend integration using AI SDK v6
 * Runs directly in the UI thread, no service worker needed
 */

import { createUIMessageStream, convertToModelMessages, generateId } from 'ai';
import { createLogger } from '~logger';

import { localSystemPrompt } from '../../prompts/templates/local';
import { getWorkflow } from '../../../workflows/registry';
import type { WorkflowDefinition } from '../../../workflows/types';

import { hasGoogleApiKey } from '@/utils/credentials';
import { getModelConfig } from '@/utils/ai';
import { getMaxToolCallLimit } from '@/utils/settings';
import { getSearchSettings, hasApiKeyForProvider } from '@/utils/settings/searchSettings';
import { WEB_SEARCH_SELF_API_KEY_HIDDEN } from '@/constants';
import { SEARCH_TOOL_NAMES } from '../../tools/searchToolFilter';
import { APIError, BaseAppError, NetworkError } from '../../../errors/errorTypes';
import { executeStreamText } from '../../stream/streamExecutor';
import { parseProviderError } from '../../errors/handlers';
import { writeErrorToStream } from '../../stream/streamHelpers';
import { createStreamRetryManager, writeMissingApiKeyError, setupLocalMode, setupRemoteMode } from '../../setup';
import { useSettingsStore, useToolsStore } from '@/stores';

import type { StreamAIParams, AIProvider, StreamState } from './types';
import { handleBackendMode } from './backendMode';
import { buildSystemPromptForMode } from './promptBuilder';
import { createOnErrorCallback, createOnFinishCallback, createPrepareStepCallback } from './streamHandlers';
import { streamCliModeChat } from '../../cliMode/cliModeChat';
import { ToolsMode } from '~types/settings';

const log = createLogger('AI-Chat', 'AI_CHAT');

/**
 * Stream AI response directly from the frontend
 * Returns a UIMessageStream that can be consumed by useChat
 * 
 * Handles both local (Gemini Nano) and remote (Gemini API) modes
 * Also supports workflow mode with custom prompts and tool filtering
 * 
 * **Error Handling:**
 * - Automatically retries transient errors (rate limits, network issues, server errors)
 * - Displays user-friendly error messages inline in the chat stream
 * - Shows retry countdown when waiting to retry
 * - Validates API key before making requests
 * - Marks API key as invalid after auth failures
 * - Handles malformed function calls from AI model
 * 
 * @param params - Stream parameters including messages, callbacks, and options
 * @returns UIMessageStream that can be consumed by useChat hook
 */
export async function streamAIResponse(params: StreamAIParams) {
    const { messages, abortSignal, initialPageContext, onError, onUsageUpdate, workflowId, threadId, onFinishCallback } = params;

    log.info('Starting AI stream', { messageCount: messages.length, workflowId: workflowId || 'none' });

    // Check if cli mode is active - route to local bridge
    const currentToolsMode = useToolsStore.getState().currentMode;
    if (currentToolsMode === 'cli') {
        log.info('🔧 Using CLI MODE - routing to local bridge');
        return streamCliModeChat({
            messages,
            abortSignal,
            onError,
        });
    }

    // Check if backend mode is enabled - route to backend immediately
    const useBackendMode = useSettingsStore.getState().useBackendMode;
    if (useBackendMode) {
        log.info('🌐 Using BACKEND MODE with tools - routing to Vercel backend');
        return handleBackendMode(params);
    }

    // Get current model configuration
    const modelConfig = await getModelConfig();

    // Determine mode based on API key availability
    let effectiveMode = modelConfig.mode;
    let missingApiKey = false;

    if (effectiveMode === 'remote') {
        const hasKey = await hasGoogleApiKey();
        if (!hasKey) {
            log.warn('⚠️ Remote mode requested but no API key found');
            missingApiKey = true;
        }
    }

    log.info('🎯 AI Mode:', effectiveMode, effectiveMode === 'remote' ? modelConfig.remoteModel : 'gemini-nano');

    // Initialize state for streaming
    let state: StreamState = {
        provider: 'local',
        effectiveMode,
        isSearchModeActive: false,
        initialActiveTools: undefined,
        enhancedPrompt: '',
        model: null,
        tools: {},
    };

    try {
        const stream = createUIMessageStream({
            execute: async ({ writer }) => {
                const retryManager = createStreamRetryManager(writer, abortSignal);

                try {
                    log.info('Stream execute function started');

                    // Send initial processing status
                    writer.write({
                        type: 'data-status',
                        id: 'status-' + generateId(),
                        data: { status: 'processing', timestamp: Date.now() },
                        transient: true,
                    });

                    // Check for workflow mode
                    let workflowConfig = null;
                    if (workflowId) {
                        workflowConfig = getWorkflow(workflowId);
                        if (workflowConfig) {
                            log.info('📋 Workflow mode detected:', { workflowId, name: workflowConfig.name });
                        } else {
                            log.warn('⚠️ Invalid workflowId provided:', workflowId);
                        }
                    }

                    // Handle missing API key
                    if (missingApiKey && effectiveMode === 'remote') {
                        writeMissingApiKeyError(writer);
                        return;
                    }

                    // Setup model based on mode
                    try {
                        if (effectiveMode === 'local') {
                            const localSetup = await setupLocalMode(writer, workflowConfig || null, localSystemPrompt);
                            state.model = localSetup.model;
                            state.tools = localSetup.tools;
                            state.enhancedPrompt = localSetup.systemPrompt;
                            state.provider = 'local';
                        } else {
                            // Remote mode setup
                            const modelName = modelConfig.remoteModel || 'gemini-3-flash-preview';

                            // Check search mode
                            const searchSettings = await getSearchSettings();
                            const hasSearchKey = WEB_SEARCH_SELF_API_KEY_HIDDEN || await hasApiKeyForProvider(searchSettings.defaultProvider);
                            state.isSearchModeActive = searchSettings.enabled && hasSearchKey && !workflowConfig;

                            log.info('🔍 Search mode check:', {
                                enabled: searchSettings.enabled,
                                hasKey: hasSearchKey,
                                isActive: state.isSearchModeActive,
                            });

                            // Build system prompt
                            const promptResult = await buildSystemPromptForMode(workflowConfig ?? null as WorkflowDefinition | null, state.isSearchModeActive);

                            // Setup remote mode
                            const remoteSetup = await setupRemoteMode(modelName, workflowConfig ?? null as WorkflowDefinition | null, promptResult.systemPrompt);

                            state.model = remoteSetup.model;
                            state.tools = remoteSetup.tools;
                            state.enhancedPrompt = remoteSetup.systemPrompt;
                            state.provider = remoteSetup.provider;

                            // Set initial active tools
                            state.initialActiveTools = determineActiveTools(
                                state.tools,
                                promptResult.toolsMode,
                                state.isSearchModeActive,
                                !!workflowConfig
                            );
                        }
                    } catch (setupError) {
                        handleSetupError(writer, setupError, effectiveMode, state.provider);
                        return;
                    }

                    // Enhance prompt with page context if available (remote only)
                    if (initialPageContext && effectiveMode === 'remote') {
                        state.enhancedPrompt = `${state.enhancedPrompt}\n\n[INITIAL PAGE CONTEXT - Captured at thread start]\n${initialPageContext}\n\nNote: This is the page context from when this conversation started. If you navigate to different pages or need updated context, use the readPageContent or getActiveTab tools.`;
                        log.info('✓ Enhanced system prompt with initial page context');
                    }

                    // Convert messages and determine step count
                    const modelMessages = await convertToModelMessages(messages);
                    const stepCount = workflowConfig?.stepCount || (effectiveMode === 'local' ? 5 : await getMaxToolCallLimit());

                    log.info('📡 Starting streamText...', {
                        mode: effectiveMode,
                        toolCount: Object.keys(state.tools).length,
                        stepCount,
                    });

                    // Execute stream with retry logic
                    const result = await retryManager.execute(async () => {
                        return await executeStreamText({
                            model: state.model,
                            modelMessages,
                            tools: state.tools,
                            enhancedPrompt: state.enhancedPrompt,
                            abortSignal,
                            stepCount,
                            writer,
                            effectiveMode,
                            modelConfig,
                            onUsageUpdate,
                            workflowId,
                            threadId,
                            onError,
                            activeTools: state.initialActiveTools,
                            prepareStep: createPrepareStepCallback({
                                tools: state.tools,
                                enhancedPrompt: state.enhancedPrompt,
                                isSearchModeActive: state.isSearchModeActive,
                                workflowConfig: workflowConfig ?? null as WorkflowDefinition | null,
                            }),
                        });
                    }, 'AI stream');

                    if (!result) {
                        log.error('❌ executeStreamText returned undefined result');
                        throw new Error('Stream execution failed - no result returned');
                    }

                    // Merge AI stream with status stream
                    log.info('✓ AI streamText result received, merging with UI stream...');

                    writer.merge(
                        result.toUIMessageStream({
                            onError: createOnErrorCallback({
                                writer,
                                provider: state.provider,
                                tools: state.tools,
                                initialActiveTools: state.initialActiveTools,
                                onError,
                            }),
                            onFinish: createOnFinishCallback({
                                writer,
                                result,
                                modelConfig,
                                effectiveMode,
                                onUsageUpdate,
                                onFinishCallback,
                            }),
                        })
                    );
                } catch (error) {
                    handleStreamError(writer, error, state.provider);
                }
            },
        });

        log.info('✓ UI message stream created successfully');
        return stream;
    } catch (error) {
        log.error('❌ Error creating stream', { error, provider: state.provider });
        const enhancedError = error instanceof APIError || error instanceof NetworkError
            ? error
            : parseProviderError(error, state.provider);
        onError?.(enhancedError);
        throw enhancedError;
    }
}

/**
 * Determine which tools should be active based on mode
 */
function determineActiveTools(
    tools: Record<string, any>,
    toolsMode: ToolsMode,
    isSearchModeActive: boolean,
    isWorkflow: boolean
): string[] {
    const allToolNames = Object.keys(tools);

    if (toolsMode === 'adaptive' && !isWorkflow) {
        const activeTools = allToolNames.filter(t => !SEARCH_TOOL_NAMES.includes(t as any));
        log.info('🌐 ADAPTIVE MODE - Search tools discoverable via discoverTools:', { activeCount: activeTools.length });
        return activeTools;
    }

    if (isSearchModeActive) {
        log.info('🔍 SEARCH MODE - All tools including search:', { count: allToolNames.length });
        return allToolNames;
    }

    const activeTools = allToolNames.filter(t => !SEARCH_TOOL_NAMES.includes(t as any));
    log.info('🔧 AGENT MODE - Excluding search tools:', { activeCount: activeTools.length });
    return activeTools;
}

/**
 * Handle model setup errors
 */
function handleSetupError(
    writer: any,
    error: unknown,
    effectiveMode: 'local' | 'remote',
    provider: AIProvider
) {
    log.error('❌ Model setup failed:', {
        error,
        mode: effectiveMode,
        provider,
        message: error instanceof Error ? error.message : String(error)
    });

    const enhancedError = error instanceof BaseAppError
        ? error
        : parseProviderError(error, provider);

    writeErrorToStream(writer, enhancedError, 'Model setup');
}

/**
 * Handle stream execution errors
 */
function handleStreamError(
    writer: any,
    error: unknown,
    provider: AIProvider
) {
    log.error('Stream execution error', { error, provider });

    const enhancedError = error instanceof BaseAppError
        ? error
        : parseProviderError(error, provider);

    writeErrorToStream(writer, enhancedError, 'Stream execution');
}
