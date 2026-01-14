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
 * CLI-specific instructions appended to system prompts.
 * These override or extend base behavior for the CLI bridge environment.
 */
const CLI_BRIDGE_INSTRUCTIONS = `

## CLI BRIDGE MODE - CRITICAL INSTRUCTIONS

You are running through the CLI Bridge. Follow these MANDATORY rules:

**TOOL PARAMETERS - NEVER ASK THE USER:**
- ALWAYS choose tool parameters automatically based on context and user intent
- NEVER ask the user "which parameter should I use?" or "what value do you want for X?"
- NEVER ask for confirmation before calling tools - just execute them
- Use your best judgment to infer the most appropriate values from the user's request
- If a parameter is ambiguous, choose the most reasonable default that fulfills the user's goal
- If multiple options exist, pick the one most likely to satisfy the user's intent

**AUTONOMOUS EXECUTION:**
- Execute tools immediately without asking for parameter clarification
- If information is missing, use sensible defaults or search/gather the information yourself
- Chain multiple tool calls as needed to complete the task
- Only ask the user if you truly cannot proceed (e.g., need credentials, password, or sensitive personal data)

**EXAMPLES:**
- User says "search for cats" → Use webSearch with query "cats" (don't ask "what search engine?")
- User says "open YouTube" → Navigate to youtube.com (don't ask "which URL?")
- User says "set a reminder" → Ask only for the essential info like time if not provided
- User says "click the button" → Identify and click the most relevant button (don't ask "which button?")
`;

/**
 * Select the shared system prompt for a given tools mode.
 * Custom mode uses the Agent prompt (tool availability is still controlled by enabledTools).
 * Appends CLI-specific instructions for autonomous tool execution.
 */
export function getSystemPromptForToolsMode(toolsMode: CliToolsMode | undefined): string {
    let basePrompt: string;
    switch (toolsMode) {
        case 'chat':
            basePrompt = CHAT_MODE_SYSTEM_PROMPT;
            break;
        case 'adaptive':
            basePrompt = ADAPTIVE_MODE_SYSTEM_PROMPT;
            break;
        case 'custom':
        case 'agent':
        default:
            basePrompt = AGENT_MODE_SYSTEM_PROMPT;
            break;
    }

    // Append CLI-specific instructions to ensure autonomous tool execution
    return basePrompt + CLI_BRIDGE_INSTRUCTIONS;
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
