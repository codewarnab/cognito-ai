/**
 * Claude Code agent handler
 *
 * Claude Code supports custom MCP tools via createSdkMcpServer, which allows
 * us to bridge extension tools to Claude Code. This means all extension tools
 * (navigateTo, clickByText, typeInField, etc.) work with Claude Code alongside
 * its powerful built-in tools (Read, Write, Bash, etc.).
 */

import { streamText, stepCountIs } from 'ai';
import { z } from 'zod';
import {
    createClaudeCode,
    createSdkMcpServer,
    tool as claudeCodeTool,
    isAuthenticationError as isClaudeAuthenticationError,
    isTimeoutError as isClaudeTimeoutError,
    getErrorMetadata as getClaudeErrorMetadata,
} from 'ai-sdk-provider-claude-code';
import { getToolExecutionClientCount, getRegisteredTools } from '../mcp/toolStore';
import {
    type SSEEventSender,
    generateToolCallId,
    jsonSchemaToZod,
} from './aiSdkTools';
import {
    getExtensionToolNames,
    isExtensionTool,
} from '../mcp/extensionToolsMcpServer';
import {
    getCapabilityMessage,
    createEngagingMessageSender,
    DEFAULT_MESSAGE_INTERVAL,
} from './engagingMessages';
import {
    convertBridgeMessagesToAISDK,
    type AgentHandlerParamsWithCwd,
} from './chatUtils';

/**
 * Handle Claude Code agent requests using AI SDK with in-process MCP server
 */
export async function handleClaudeCodeAgent({
    agent,
    messages,
    sendEvent,
    abortController,
    res,
    cwd,
    enabledTools,
}: AgentHandlerParamsWithCwd): Promise<void> {
    const claudeCodeModel =
        agent.acpModel ||
        process.env.CLAUDE_CODE_MODEL ||
        'sonnet';

    sendEvent('status', { message: `Initializing Claude Code...` });
    sendEvent('status', { message: `Model: ${claudeCodeModel}` });

    // Get registered extension tools, filtered by enabledTools if provided
    let registeredTools = getRegisteredTools();
    if (enabledTools && enabledTools.length > 0) {
        const enabledSet = new Set(enabledTools);
        registeredTools = registeredTools.filter(t => enabledSet.has(t.name));
    }

    // Create MCP tools from extension registry using the Claude Code SDK's tool() helper
    const mcpTools = registeredTools.map((t) => {
        const zodSchema = jsonSchemaToZod(t.parameters);

        return claudeCodeTool(
            t.name,
            t.description || `Extension tool: ${t.name}`,
            zodSchema instanceof z.ZodObject ? zodSchema.shape : {},
            async (args: Record<string, unknown>) => {
                // Claude Code tool-call IDs are internal to the provider and not exposed here.
                // Generate a stable id for the extension UI + HITL approvals, and reuse it
                // as the tool execution requestId.
                const toolCallId = generateToolCallId();

                try {
                    sendEvent('tool_call', {
                        toolName: t.name,
                        toolCallId,
                        args,
                        serverExecuted: true, // Executed via the bridge/extension
                    });

                    console.log(`[chat] Claude Code executing extension tool: ${t.name}`, { toolCallId });

                    // Check if extension is connected
                    const clientCount = getToolExecutionClientCount();
                    if (clientCount === 0) {
                        sendEvent('tool_result', {
                            toolCallId,
                            result: { success: false, error: 'No extension connected for tool execution' },
                            serverExecuted: true,
                        });
                        return {
                            content: [{ type: 'text' as const, text: 'Error: No extension connected for tool execution' }],
                            isError: true,
                        };
                    }

                    // Import dynamically to avoid circular dependency
                    const { executeToolOnExtension } = await import('../mcp/toolStore');
                    const result = await executeToolOnExtension(t.name, args, {
                        requestId: toolCallId,
                        interactive: true,
                    });

                    if (!result.success) {
                        sendEvent('tool_result', {
                            toolCallId,
                            result: { success: false, error: result.error || 'Tool execution failed' },
                            serverExecuted: true,
                        });
                        return {
                            content: [{ type: 'text' as const, text: `Error: ${result.error || 'Tool execution failed'}` }],
                            isError: true,
                        };
                    }

                    const textResult =
                        typeof result.result === 'string'
                            ? result.result
                            : JSON.stringify(result.result, null, 2);

                    sendEvent('tool_result', {
                        toolCallId,
                        result: result.result,
                        serverExecuted: true,
                    });

                    return {
                        content: [{ type: 'text' as const, text: textResult }],
                    };
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error(`[chat] Tool ${t.name} error:`, errorMessage);

                    sendEvent('tool_result', {
                        toolCallId,
                        result: { success: false, error: errorMessage },
                        serverExecuted: true,
                    });

                    return {
                        content: [{ type: 'text' as const, text: `Error: ${errorMessage}` }],
                        isError: true,
                    };
                }
            }
        );
    });

    // Create in-process MCP server with extension tools
    const extensionMcpServer = createSdkMcpServer({
        name: 'extension',
        version: '1.0.0',
        tools: mcpTools,
    });

    // Get extension tool names for allowedTools configuration
    const extensionToolNames = getExtensionToolNames();

    // SECURITY: Only allow extension tools - no file system or shell access
    // This prevents agents from reading/writing local files or running arbitrary commands.
    // Combined with sandbox isolation (in cli.ts), this ensures agents can only
    // interact with the browser extension tools.
    const allowedTools = [
        // Extension tools only (prefixed with mcp__extension__)
        // No built-in tools: Read, Write, Edit, Bash, LS, Grep, Glob are intentionally excluded
        ...extensionToolNames,
    ];

    sendEvent('status', {
        message: getCapabilityMessage(extensionToolNames.length),
    });

    // Start sending engaging messages while waiting for AI response
    const engagingMessages = createEngagingMessageSender(sendEvent, DEFAULT_MESSAGE_INTERVAL);
    engagingMessages.start();

    // Create Claude Code provider with MCP server configuration
    const claudeCodeProvider = createClaudeCode({
        defaultSettings: {
            mcpServers: { extension: extensionMcpServer },
            allowedTools,
            permissionMode: process.env.CLAUDE_CODE_PERMISSION_MODE as any || 'bypassPermissions',
            cwd,
            verbose: process.env.CLAUDE_CODE_VERBOSE === 'true',
            persistSession: false, // Don't persist extension sessions
            maxTurns: process.env.CLAUDE_CODE_MAX_TURNS
                ? parseInt(process.env.CLAUDE_CODE_MAX_TURNS, 10)
                : undefined,
        },
    });

    // Convert messages to AI SDK format
    const aiMessages = convertBridgeMessagesToAISDK(messages as any);

    // System prompt for the coding agent with extension capabilities
    const systemPrompt =
        'You are a coding agent helping the user via a Chrome extension. ' +
        'You have access to both file system tools (Read, Write, Bash) and browser tools (navigateTo, clickByText, typeInField, readPageContent, takeScreenshot). ' +
        'Use the appropriate tools for the task at hand. Browser tools are prefixed with mcp__extension__.';

    try {
        const result = await streamText({
            model: claudeCodeProvider(claudeCodeModel),
            messages: aiMessages as any,
            system: systemPrompt,
            stopWhen: [stepCountIs(10)],
            abortSignal: abortController.signal,
        });

        // Track Claude Code provider toolCallIds that correspond to extension tools,
        // so we can skip their tool-result events even if toolName is missing.
        const extensionProviderToolCallIds = new Set<string>();

        // Stop engaging messages once we start receiving the response
        let firstPartReceived = false;

        // Process the full stream for complete tool event handling
        for await (const part of result.fullStream) {
            if (abortController.signal.aborted) break;

            // Stop engaging messages on first part
            if (!firstPartReceived) {
                engagingMessages.stop();
                firstPartReceived = true;
            }

            // Use type assertion for extended stream parts from Claude Code SDK
            const streamPart = part as any;

            switch (streamPart.type) {
                case 'text-delta':
                    sendEvent('text', { content: streamPart.textDelta });
                    break;

                case 'tool-call':
                    // Determine if this is an extension tool or Claude's built-in tool
                    const toolNameRaw = streamPart.toolName as string;
                    const isExtTool = isExtensionTool(toolNameRaw);
                    // Extension tool events are emitted from the MCP tool executor above
                    // (with UI-aligned ids for approvals). Skip them here to avoid duplicates.
                    if (isExtTool) {
                        if (typeof streamPart.toolCallId === 'string') {
                            extensionProviderToolCallIds.add(streamPart.toolCallId);
                        }
                        break;
                    }

                    const displayToolName = toolNameRaw;

                    // Parse tool arguments
                    let toolArgs: Record<string, unknown> = {};
                    try {
                        const inputStr = streamPart.input;
                        toolArgs = inputStr ? JSON.parse(inputStr) : {};
                    } catch {
                        toolArgs = streamPart.args || {};
                    }

                    sendEvent('tool_call', {
                        toolName: displayToolName,
                        toolCallId: streamPart.toolCallId,
                        args: toolArgs,
                        serverExecuted: true, // Claude Code executes tools server-side
                    });
                    break;

                case 'tool-result':
                    // Skip extension tool results - emitted from MCP tool executor above.
                    if (
                        (typeof streamPart.toolName === 'string' && isExtensionTool(streamPart.toolName)) ||
                        (typeof streamPart.toolCallId === 'string' && extensionProviderToolCallIds.has(streamPart.toolCallId))
                    ) {
                        if (typeof streamPart.toolCallId === 'string') {
                            extensionProviderToolCallIds.delete(streamPart.toolCallId);
                        }
                        break;
                    }

                    sendEvent('tool_result', {
                        toolCallId: streamPart.toolCallId,
                        result: streamPart.result,
                        isError: streamPart.isError,
                        serverExecuted: true,
                    });
                    break;

                case 'error':
                    console.error('[chat] Claude Code stream error:', streamPart.error);
                    sendEvent('error', {
                        error: streamPart.error instanceof Error
                            ? streamPart.error.message
                            : String(streamPart.error),
                    });
                    break;
            }
        }

        sendEvent('done', {});
        res.end();
    } catch (err) {
        // Stop engaging messages on error
        engagingMessages.stop();

        const errorMessage = err instanceof Error ? err.message : String(err);
        const metadata = getClaudeErrorMetadata(err);

        console.error('[chat] Claude Code error:', errorMessage);
        if (metadata) {
            console.error('[chat] Error metadata:', metadata);
        }

        // Provide helpful hints based on error type
        let hint: string | undefined;

        if (isClaudeAuthenticationError(err)) {
            hint = 'Not logged in to Claude. Run `claude login` in your terminal to authenticate.';
        } else if (isClaudeTimeoutError(err)) {
            hint = 'Request timed out. Claude Opus may need more time for complex tasks.';
        } else if (errorMessage.includes('command not found') || errorMessage.includes('ENOENT')) {
            hint = 'Claude Code CLI not found. Run `npm install -g @anthropic-ai/claude-code` to install.';
        } else if (errorMessage.includes('not logged in') || errorMessage.includes('claude login')) {
            hint = 'Claude Code not authenticated. Run `claude login` in your terminal.';
        }

        sendEvent('error', {
            error: hint ? `${errorMessage}\n\n${hint}` : errorMessage,
            metadata,
        });
        sendEvent('done', {});
        res.end();
    }
}
