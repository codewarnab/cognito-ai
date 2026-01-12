/**
 * AI SDK Tools Builder
 *
 * Shared logic for building AI SDK tools from extension-registered tool schemas.
 * Used by both Gemini CLI and CodeX CLI providers.
 */

import { z } from 'zod';
import {
    executeToolOnExtension,
    getRegisteredTools,
    getToolExecutionClientCount,
    type ExtensionToolSchema,
} from '../mcp/toolStore';

/**
 * Mapping from sanitized tool names back to original names
 */
export type ToolNameMapping = Map<string, { originalName: string }>;

/**
 * SSE event sender function signature
 */
export interface SSEEventSender {
    (event: string, data: unknown): void;
}

/**
 * Generate a unique tool call ID
 */
export function generateToolCallId(): string {
    return `tool_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Sanitize tool names for Gemini/OpenAI compatibility.
 * 
 * Tool function names must:
 * - Start with a letter or underscore (not a digit)
 * - Contain only alphanumeric, underscores, dots, colons, dashes
 */
export function sanitizeToolName(name: string): string {
    let sanitized = name;
    // Prefix with fn_ if it starts with a digit
    if (/^[0-9]/.test(sanitized)) {
        sanitized = `fn_${sanitized}`;
    }
    // Replace invalid characters with underscores
    sanitized = sanitized.replace(/[^a-zA-Z0-9_.:-]/g, '_');
    return sanitized;
}

/**
 * Convert JSON Schema to Zod schema (best-effort).
 * We intentionally lean permissive to avoid rejecting model-produced arguments.
 */
export function jsonSchemaToZod(schema: unknown): z.ZodTypeAny {
    try {
        if (!schema || typeof schema !== 'object') {
            return z.any();
        }

        const s = schema as Record<string, unknown>;
        const enumValues = s.enum as unknown;

        // Enum (string-only) -> z.enum
        if (Array.isArray(enumValues) && enumValues.every((v) => typeof v === 'string')) {
            const values = enumValues as string[];
            if (values.length >= 1) {
                return z.enum(values as [string, ...string[]]);
            }
        }

        const type = s.type as unknown;

        // Union types (anyOf/oneOf) - fallback permissive
        if (Array.isArray(s.anyOf) || Array.isArray(s.oneOf)) {
            return z.any();
        }

        switch (type) {
            case 'string':
                return z.string();
            case 'number':
            case 'integer':
                return z.number();
            case 'boolean':
                return z.boolean();
            case 'null':
                return z.null();
            case 'array': {
                const items = s.items as unknown;
                return z.array(items ? jsonSchemaToZod(items) : z.any());
            }
            case 'object': {
                const properties = s.properties as unknown;
                const required = s.required as unknown;

                if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
                    return z.record(z.string(), z.any());
                }

                const requiredKeys = Array.isArray(required)
                    ? (required.filter((v) => typeof v === 'string') as string[])
                    : [];
                const shape: Record<string, z.ZodTypeAny> = {};

                for (const [key, propSchema] of Object.entries(
                    properties as Record<string, unknown>
                )) {
                    let propZod = jsonSchemaToZod(propSchema);
                    if (!requiredKeys.includes(key)) {
                        propZod = propZod.optional();
                    }
                    shape[key] = propZod;
                }

                // Passthrough to tolerate extra args that the model may include.
                return z.object(shape).passthrough();
            }
            default:
                return z.any();
        }
    } catch {
        return z.any();
    }
}

/**
 * Options for building AI SDK tools
 */
export interface BuildAISDKToolsOptions {
    /** If provided, only include tools whose names are in this list */
    enabledTools?: string[];
}

/**
 * Build AI SDK tools from extension-registered tool schemas.
 * 
 * This function converts tool schemas registered by the Chrome extension
 * into AI SDK compatible tools that can be used with streamText().
 * 
 * @param sendEvent - Function to send SSE events to the client
 * @param options - Optional configuration including tool filtering
 * @returns Object containing aiTools record and toolNameMapping
 */
export function buildAISDKTools(
    sendEvent: SSEEventSender,
    options?: BuildAISDKToolsOptions
): { aiTools: Record<string, any>; toolNameMapping: ToolNameMapping } {
    let registeredTools = getRegisteredTools();

    // Filter tools if enabledTools list is provided
    if (options?.enabledTools && options.enabledTools.length > 0) {
        const enabledSet = new Set(options.enabledTools);
        registeredTools = registeredTools.filter(t => enabledSet.has(t.name));
    }
    const toolNameMapping: ToolNameMapping = new Map();
    const aiTools: Record<string, any> = {};

    for (const t of registeredTools) {
        const originalName = t.name;
        const baseSanitized = sanitizeToolName(originalName);

        // Resolve collisions if any
        let sanitizedName = baseSanitized;
        let suffix = 2;
        while (
            toolNameMapping.has(sanitizedName) &&
            toolNameMapping.get(sanitizedName)!.originalName !== originalName
        ) {
            sanitizedName = `${baseSanitized}_${suffix++}`;
        }

        toolNameMapping.set(sanitizedName, { originalName });

        aiTools[sanitizedName] = {
            description: t.description || `Tool: ${originalName}`,
            inputSchema: jsonSchemaToZod(t.parameters as unknown),
            execute: async (args: unknown, options?: any) => {
                const toolCallId =
                    typeof options?.toolCallId === 'string'
                        ? options.toolCallId
                        : generateToolCallId();

                const argsForEvent =
                    args && typeof args === 'object' && !Array.isArray(args)
                        ? (args as Record<string, unknown>)
                        : { value: args };

                sendEvent('tool_call', {
                    toolName: originalName,
                    toolCallId,
                    args: argsForEvent,
                });

                const connectedClients = getToolExecutionClientCount();
                if (connectedClients === 0) {
                    const error =
                        'No extension connected for tool execution. Pair the extension and ensure tool events are connected.';
                    sendEvent('tool_result', {
                        toolCallId,
                        result: { success: false, error },
                    });
                    return { error: true, message: error };
                }

                sendEvent('status', { message: `Running tool: ${originalName}` });
                const start = Date.now();

                // IMPORTANT: Use toolCallId as requestId so the extension UI can
                // approve/deny the *same* call id it is displaying.
                const result = await executeToolOnExtension(originalName, args, {
                    requestId: toolCallId,
                    interactive: true,
                });
                const durationMs = Date.now() - start;

                console.log('[aiSdkTools] Tool executed:', {
                    toolName: originalName,
                    toolCallId,
                    success: result.success,
                    durationMs,
                });

                sendEvent('tool_result', {
                    toolCallId,
                    result: result.success
                        ? result.result
                        : { success: false, error: result.error },
                });

                if (result.success) {
                    return result.result;
                }

                return {
                    error: true,
                    message: result.error || 'Tool execution failed',
                    toolName: originalName,
                    toolCallId,
                };
            },
        };
    }

    return { aiTools, toolNameMapping };
}
