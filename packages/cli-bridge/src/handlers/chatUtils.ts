/**
 * Shared utilities for chat handlers
 */

import type { SSEEventSender } from './aiSdkTools';

/** Default system prompt for coding agents */
export const CODING_AGENT_SYSTEM_PROMPT =
    'You are a coding agent connected to the user\'s Chrome extension. ' +
    'When you need to take actions in the browser (navigate, click, read content), call the available tools. ' +
    'Tool results are returned as structured data; use them to proceed. ' +
    'Be direct and pragmatic.';

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
}

/** Extended params that include cwd */
export interface AgentHandlerParamsWithCwd extends AgentHandlerParams {
    cwd: string;
}
