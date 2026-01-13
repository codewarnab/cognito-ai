/**
 * Gemini CLI agent handler
 */

import { streamText, stepCountIs } from 'ai';
import { createGeminiProvider } from 'ai-sdk-provider-gemini-cli';
import { buildAISDKTools } from './aiSdkTools';
import {
    getCapabilityMessage,
    createEngagingMessageSender,
    DEFAULT_MESSAGE_INTERVAL,
} from './engagingMessages';
import {
    convertBridgeMessagesToAISDK,
    getSystemPromptForToolsMode,
    type AgentHandlerParams,
} from './chatUtils';

/**
 * Handle Gemini CLI agent requests using AI SDK
 */
export async function handleGeminiAgent({
    agent,
    messages,
    sendEvent,
    abortController,
    res,
    enabledTools,
    toolsMode,
}: AgentHandlerParams): Promise<void> {
    const geminiModelId =
        agent.acpModel ||
        process.env.COGNITO_GEMINI_MODEL ||
        process.env.GEMINI_MODEL ||
        'gemini-2.5-flash';

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    const authType = apiKey ? 'api-key' : 'oauth-personal';

    sendEvent('status', { message: `Initializing Gemini (${authType})...` });

    // Gemini 3 models require thought signatures for function calls (tools) in some environments.
    // AI SDK tool calling does not currently expose/roundtrip these signatures, so tool use fails.
    // Fall back to Gemini 2.5 models for reliable tool calling.
    const requestedModelId = geminiModelId;
    const usingGemini3 = requestedModelId.toLowerCase().startsWith('gemini-3');
    const effectiveModelId = usingGemini3 ? 'gemini-2.5-flash' : requestedModelId;

    if (usingGemini3) {
        sendEvent('status', {
            message:
                `Model "${requestedModelId}" requires thought-signatures for tool calls; ` +
                `falling back to "${effectiveModelId}" for CLI Mode tools.`,
        });
    } else {
        sendEvent('status', { message: `Model: ${requestedModelId}` });
    }

    const gemini =
        authType === 'api-key'
            ? createGeminiProvider({ authType, apiKey })
            : createGeminiProvider({ authType });

    // Convert incoming messages to AI SDK format (text + file parts)
    const aiMessages = convertBridgeMessagesToAISDK(messages as any);

    // Build AI SDK tools from extension-registered tool schemas (filtered by enabledTools)
    const { aiTools } = buildAISDKTools(sendEvent, { enabledTools });
    const toolCount = Object.keys(aiTools).length;

    const systemPrompt = getSystemPromptForToolsMode(toolsMode);

    // Send engaging capability message instead of boring "Tools available: X"
    sendEvent('status', { message: getCapabilityMessage(toolCount) });

    // Start sending engaging messages while waiting for AI response
    const engagingMessages = createEngagingMessageSender(sendEvent, DEFAULT_MESSAGE_INTERVAL);
    engagingMessages.start();

    try {
        const result = await streamText({
            model: gemini(effectiveModelId),
            messages: aiMessages as any,
            system: systemPrompt,
            tools: toolCount > 0 ? aiTools : undefined,
            toolChoice: 'auto',
            stopWhen: [stepCountIs(10)],
            abortSignal: abortController.signal,
        });

        // Stop engaging messages once we start receiving the response
        let firstChunkReceived = false;

        for await (const chunk of result.textStream) {
            if (abortController.signal.aborted) break;

            // Stop engaging messages on first chunk
            if (!firstChunkReceived) {
                engagingMessages.stop();
                firstChunkReceived = true;
            }

            if (chunk) {
                sendEvent('text', { content: chunk });
            }
        }

        sendEvent('done', {});
        res.end();
    } catch (err) {
        // Stop engaging messages on error
        engagingMessages.stop();

        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('[chat] Gemini stream error:', errorMessage);

        // Extra hint for missing OAuth creds
        const hint =
            authType === 'oauth-personal'
                ? 'If you have not authenticated yet, run `gemini` once in your terminal and complete the login flow.'
                : undefined;

        sendEvent('error', {
            error: hint ? `${errorMessage}\n\n${hint}` : errorMessage,
        });
        sendEvent('done', {});
        res.end();
    }
}
