/**
 * Shared utilities for chat handlers
 */

import type { SSEEventSender } from './aiSdkTools';
import {
    ADAPTIVE_MODE_SYSTEM_PROMPT,
    AGENT_MODE_SYSTEM_PROMPT,
    CHAT_MODE_SYSTEM_PROMPT,
} from '@cognito/shared';

/**
 * Tools mode as sent by the extension to the CLI bridge.
 * Controls which shared system prompt is used.
 */
export type CliToolsMode = 'chat' | 'agent' | 'adaptive' | 'custom';

/**
 * Select the shared system prompt for a given tools mode.
 * Custom mode uses the Agent prompt (tool availability is still controlled by enabledTools).
 */
export function getSystemPromptForToolsMode(toolsMode: CliToolsMode | undefined): string {
    switch (toolsMode) {
        case 'chat':
            return CHAT_MODE_SYSTEM_PROMPT;
        case 'adaptive':
            return ADAPTIVE_MODE_SYSTEM_PROMPT;
        case 'custom':
        case 'agent':
        default:
            return AGENT_MODE_SYSTEM_PROMPT;
    }
}

/**
 * Convert Bridge messages to AI SDK format
 */
export function convertBridgeMessagesToAISDK(
    messages: Array<{ role: 'user' | 'assistant'; content: Array<any> }>
): Array<{ role: 'user' | 'assistant'; content: Array<any> }> {
    return messages
        .map((m) => {
            const parts = m.content
                .map((p) => {
                    if (!p || typeof p !== 'object') return null;

                    if (p.type === 'text') {
                        return { type: 'text' as const, text: String((p as any).text ?? '') };
                    }

                    // Gemini provider expects "file" parts for all non-text inputs.
                    const mimeType = String((p as any).mimeType ?? 'application/octet-stream');
                    const data = String((p as any).data ?? '');

                    if (m.role === 'user') {
                        return { type: 'file' as const, data, mediaType: mimeType };
                    }

                    // Assistant history rarely contains files; fall back to a text placeholder.
                    const name = typeof (p as any).name === 'string' ? (p as any).name : undefined;
                    return {
                        type: 'text' as const,
                        text: name
                            ? `[Attachment omitted: ${name} (${mimeType})]`
                            : `[Attachment omitted: ${mimeType}]`,
                    };
                })
                .filter((p): p is NonNullable<typeof p> => p !== null);

            return { role: m.role, content: parts };
        })
        // Gemini rejects empty message parts; drop empty messages defensively.
        .filter((m) => m.content.length > 0);
}

/** Common agent handler parameters */
export interface AgentHandlerParams {
    agent: { acpModel?: string };
    messages: Array<{ role: 'user' | 'assistant'; content: Array<any> }>;
    sendEvent: SSEEventSender;
    abortController: AbortController;
    res: import('http').ServerResponse;
    enabledTools?: string[];
    toolsMode?: CliToolsMode;
}

/** Extended params that include cwd */
export interface AgentHandlerParamsWithCwd extends AgentHandlerParams {
    cwd: string;
}
