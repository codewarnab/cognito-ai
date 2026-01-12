/**
 * MCP Message Schemas
 *
 * Zod schemas for Model Context Protocol (MCP) messages.
 * Includes both static (no server ID) and dynamic (with server ID) schemas.
 */

import { z } from 'zod';
import { BasicResponseSchema } from './common';

// =============================================================================
// MCP STATIC MESSAGE SCHEMAS
// =============================================================================

/**
 * Schemas for static MCP messages (no server ID)
 */
export const McpStaticMessageSchemas = {
    'mcp/tools/list': {
        payload: z.undefined(),
        response: z.object({
            success: z.boolean(),
            data: z
                .object({
                    tools: z.array(
                        z.object({
                            name: z.string(),
                            description: z.string().optional(),
                            inputSchema: z.record(z.string(), z.unknown()).optional(),
                            serverId: z.string(),
                            serverName: z.string().optional(),
                        })
                    ),
                })
                .optional(),
            error: z.string().optional(),
        }),
    },

    'mcp/custom-servers/reload': {
        payload: z.undefined(),
        response: BasicResponseSchema,
    },

    'mcp/servers/get': {
        payload: z.undefined(),
        response: z.object({
            success: z.boolean(),
            data: z
                .array(
                    z.object({
                        id: z.string(),
                        name: z.string(),
                        state: z.string(),
                        tools: z.array(z.unknown()).optional(),
                    })
                )
                .optional(),
            error: z.string().optional(),
        }),
    },
} as const;

// =============================================================================
// MCP SERVER MESSAGE SCHEMAS
// =============================================================================

/**
 * Schemas for dynamic MCP server messages (with server ID)
 */
export const McpServerMessageSchemas = {
    payloads: {
        'auth/start': z.undefined(),
        'auth/complete': z.object({ code: z.string() }),
        'auth/refresh': z.undefined(),
        enable: z.undefined(),
        disable: z.undefined(),
        disconnect: z.undefined(),
        'status/get': z.undefined(),
        'status/update': z.object({
            state: z.string(),
            error: z.string().optional(),
            tools: z.array(z.unknown()).optional(),
        }),
        'health/check': z.undefined(),
        'tool/call': z.object({
            name: z.string(),
            arguments: z.record(z.string(), z.unknown()).optional(),
        }),
        'tools/list': z.undefined(),
        'tools/config/get': z.undefined(),
        'tools/config/set': z.object({
            disabledTools: z.array(z.string()),
        }),
        'resource/read': z.object({
            uri: z.string(),
        }),
    },
    responses: {
        'auth/start': z.object({
            success: z.boolean(),
            authUrl: z.string().optional(),
            error: z.string().optional(),
        }),
        'auth/complete': BasicResponseSchema,
        'auth/refresh': BasicResponseSchema,
        enable: BasicResponseSchema,
        disable: BasicResponseSchema,
        disconnect: BasicResponseSchema,
        'status/get': z.object({
            success: z.boolean(),
            data: z
                .object({
                    state: z.string(),
                    error: z.string().optional(),
                    tools: z.array(z.unknown()).optional(),
                })
                .optional(),
            error: z.string().optional(),
        }),
        'status/update': BasicResponseSchema,
        'health/check': z.object({
            success: z.boolean(),
            healthy: z.boolean().optional(),
            error: z.string().optional(),
        }),
        'tool/call': z.object({
            success: z.boolean(),
            data: z.unknown().optional(),
            error: z.string().optional(),
        }),
        'tools/list': z.object({
            success: z.boolean(),
            data: z
                .object({
                    tools: z.array(z.unknown()),
                })
                .optional(),
            error: z.string().optional(),
        }),
        'tools/config/get': z.object({
            success: z.boolean(),
            data: z
                .object({
                    disabledTools: z.array(z.string()),
                })
                .optional(),
            error: z.string().optional(),
        }),
        'tools/config/set': BasicResponseSchema,
        'resource/read': z.object({
            success: z.boolean(),
            data: z
                .object({
                    contents: z.array(z.unknown()),
                })
                .optional(),
            error: z.string().optional(),
        }),
    },
} as const;

// =============================================================================
// TYPE INFERENCE
// =============================================================================

/** Type for MCP static message schema keys */
export type McpStaticSchemaType = keyof typeof McpStaticMessageSchemas;

/** Type for MCP server action keys */
export type McpServerActionSchemaType = keyof typeof McpServerMessageSchemas.payloads;
