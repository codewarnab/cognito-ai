/**
 * CodeX CLI agent handler
 */

import { streamText, stepCountIs } from 'ai';
import { createCodexCli, isAuthenticationError as isCodexAuthenticationError } from 'ai-sdk-provider-codex-cli';
import { buildAISDKTools } from './aiSdkTools';
import {
    getCapabilityMessage,
    createEngagingMessageSender,
    DEFAULT_MESSAGE_INTERVAL,
} from './engagingMessages';
import {
    CODING_AGENT_SYSTEM_PROMPT,
    convertBridgeMessagesToAISDK,
    type AgentHandlerParamsWithCwd,
} from './chatUtils';

/**
 * Handle CodeX CLI agent requests using AI SDK
 */
export async function handleCodexAgent({
    agent,
    messages,
    sendEvent,
    abortController,
    res,
    cwd,
    enabledTools,
}: AgentHandlerParamsWithCwd): Promise<void> {
    const codexModelId =
        agent.acpModel ||
        process.env.CODEX_MODEL ||
        'gpt-5.1-codex';

    const apiKey = process.env.OPENAI_API_KEY;
    const authType = apiKey ? 'api-key' : 'oauth';

    sendEvent('status', { message: `Initializing CodeX CLI (${authType})...` });
    sendEvent('status', { message: `Model: ${codexModelId}` });

    // Create CodeX CLI provider with appropriate settings
    // SECURITY: Use 'off' sandbox mode by default - combined with isolated CWD,
    // this prevents any file system writes. The sandboxed temp directory is empty,
    // so even if writes were allowed, there's nothing sensitive to overwrite.
    const codexProvider = createCodexCli({
        defaultSettings: {
            allowNpx: true, // Allow npx fallback if codex CLI is not installed
            skipGitRepoCheck: true, // Skip git repo safety check for non-repo contexts
            cwd, // Use isolated sandbox directory (set in cli.ts)
            approvalMode: process.env.CODEX_APPROVAL_MODE as any || 'on-failure',
            sandboxMode: process.env.CODEX_SANDBOX_MODE as any || 'off', // Disable writes by default for security
            env: apiKey ? { OPENAI_API_KEY: apiKey } : undefined,
            verbose: process.env.CODEX_VERBOSE === 'true',
        },
    });

    // Convert incoming messages to AI SDK format
    const aiMessages = convertBridgeMessagesToAISDK(messages as any);

    // Build AI SDK tools from extension-registered tool schemas (filtered by enabledTools)
    const { aiTools } = buildAISDKTools(sendEvent, { enabledTools });
    const toolCount = Object.keys(aiTools).length;

    // Send engaging capability message instead of boring "Tools available: X"
    sendEvent('status', { message: getCapabilityMessage(toolCount) });

    // Start sending engaging messages while waiting for AI response
    const engagingMessages = createEngagingMessageSender(sendEvent, DEFAULT_MESSAGE_INTERVAL);
    engagingMessages.start();

    try {
        const result = await streamText({
            model: codexProvider(codexModelId),
            messages: aiMessages as any,
            system: CODING_AGENT_SYSTEM_PROMPT,
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
        console.error('[chat] CodeX stream error:', errorMessage);

        // Check for authentication errors
        if (isCodexAuthenticationError(err)) {
            sendEvent('error', {
                error:
                    'Authentication failed. Please run `codex login` in your terminal to authenticate with OpenAI.',
                code: 'AUTH_REQUIRED',
            });
        } else {
            // Generic error with auth hint if using OAuth
            const hint =
                authType === 'oauth'
                    ? 'If authentication fails, run `codex login` in your terminal.'
                    : undefined;

            sendEvent('error', {
                error: hint ? `${errorMessage}\n\n${hint}` : errorMessage,
            });
        }

        sendEvent('done', {});
        res.end();
    }
}
