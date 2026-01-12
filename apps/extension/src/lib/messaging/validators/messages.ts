/**
 * Message Schemas
 *
 * Central registry of Zod schemas for message payloads and responses.
 * Structure mirrors MessageRegistry in @/types/messaging/index.ts
 *
 * @see /docs/TYPE_SAFE_MESSAGING.md for API reference
 */

import { z } from 'zod';
import { BasicResponseSchema, GeolocationPositionSchema } from './common';

// =============================================================================
// MESSAGE SCHEMAS
// =============================================================================

/**
 * Central registry of Zod schemas for message payloads and responses.
 *
 * Structure mirrors MessageRegistry in @/types/messaging/index.ts
 */
export const MessageSchemas = {
    // -------------------------------------------------------------------------
    // Tab Context Messages
    // -------------------------------------------------------------------------

    GET_CURRENT_TAB_ID: {
        payload: z.undefined(),
        response: z.object({
            tabId: z.number().optional(),
        }),
    },

    // -------------------------------------------------------------------------
    // Memory / Supermemory Messages
    // -------------------------------------------------------------------------

    CHECK_SUPERMEMORY_READY: {
        payload: z.undefined(),
        response: z.object({
            ready: z.boolean(),
        }),
    },

    QUEUE_MEMORY_EXTRACTION: {
        payload: z.object({
            threadId: z.string(),
            messageCount: z.number(),
        }),
        response: BasicResponseSchema,
    },

    // -------------------------------------------------------------------------
    // UI Messages
    // -------------------------------------------------------------------------

    CHECK_SIDEBAR_STATUS: {
        payload: z.undefined(),
        response: z.object({
            isOpen: z.boolean(),
        }),
    },

    OPEN_SIDEBAR: {
        payload: z.undefined(),
        response: BasicResponseSchema,
    },

    OPEN_SIDEBAR_WITH_MESSAGE: {
        payload: z.object({
            message: z.string(),
            tabAttachments: z.array(z.unknown()).optional(),
        }),
        response: BasicResponseSchema,
    },

    SIDEBAR_OPENED: {
        payload: z.undefined(),
        response: z.void(),
    },

    MODEL_DOWNLOAD_PROGRESS: {
        payload: z.object({
            modelId: z.string(),
            loaded: z.number(),
            total: z.number(),
            progress: z.number(),
        }),
        response: z.object({
            success: z.boolean(),
        }),
    },

    MODEL_DOWNLOAD_PROGRESS_UPDATE: {
        payload: z.object({
            modelId: z.string(),
            loaded: z.number(),
            total: z.number(),
            progress: z.number(),
        }),
        response: z.void(),
    },

    // -------------------------------------------------------------------------
    // AI Notifications
    // -------------------------------------------------------------------------

    'ai/notification/create': {
        payload: z.object({
            threadId: z.string(),
            title: z.string(),
            message: z.string(),
            timestamp: z.number(),
        }),
        response: z.object({
            success: z.boolean(),
            notificationId: z.string().optional(),
            error: z.string().optional(),
        }),
    },

    'ai/notification/action': {
        payload: z.object({
            action: z.enum(['continue', 'dismiss', 'navigate']),
            threadId: z.string(),
        }),
        response: BasicResponseSchema,
    },

    // -------------------------------------------------------------------------
    // Summarizer Messages
    // -------------------------------------------------------------------------

    'summarize:availability': {
        payload: z.undefined(),
        response: z.object({
            available: z.boolean(),
            error: z.string().optional(),
        }),
    },

    'summarize:request': {
        payload: z.object({
            requestId: z.string(),
            text: z.string(),
            options: z.object({
                type: z.enum(['key-points', 'tl-dr', 'headline', 'teaser']),
                format: z.enum(['markdown', 'plain-text']),
                length: z.enum(['short', 'medium', 'long']),
                sharedContext: z.string().optional(),
            }),
            context: z.string().optional(),
        }),
        response: z.object({
            ok: z.boolean(),
            summary: z.string().optional(),
            error: z.string().optional(),
        }),
    },

    // -------------------------------------------------------------------------
    // Geolocation Messages
    // -------------------------------------------------------------------------

    'geolocation/request': {
        payload: z.undefined(),
        response: z.union([
            z.object({
                success: z.literal(true),
                position: GeolocationPositionSchema,
            }),
            z.object({
                success: z.literal(false),
                errorType: z.enum(['denied', 'timeout', 'unavailable', 'unknown']),
                error: z.string(),
            }),
        ]),
    },

    // -------------------------------------------------------------------------
    // File Messages
    // -------------------------------------------------------------------------

    READ_LOCAL_PDF: {
        payload: z.object({
            filePath: z.string(),
        }),
        response: z.object({
            success: z.boolean(),
            content: z.string().optional(),
            filename: z.string().optional(),
            error: z.string().optional(),
        }),
    },

    // -------------------------------------------------------------------------
    // Offscreen Document Messages
    // -------------------------------------------------------------------------

    'offscreen/summarize/availability': {
        payload: z.undefined(),
        response: z.object({
            available: z.boolean(),
        }),
    },

    'offscreen/summarize/request': {
        payload: z.object({
            text: z.string(),
            type: z.enum(['key-points', 'tl-dr', 'headline', 'teaser']),
            format: z.enum(['markdown', 'plain-text']),
            length: z.enum(['short', 'medium', 'long']),
        }),
        response: z.object({
            success: z.boolean(),
            result: z.string().optional(),
            error: z.string().optional(),
        }),
    },

    'offscreen/geolocation/request': {
        payload: z.undefined(),
        response: z.union([
            z.object({ position: GeolocationPositionSchema }),
            z.object({ error: z.string(), errorType: z.string() }),
        ]),
    },

    // -------------------------------------------------------------------------
    // WebMCP Messages
    // -------------------------------------------------------------------------

    'webmcp/tools/register': {
        payload: z.object({
            tools: z.array(
                z.object({
                    name: z.string(),
                    originalName: z.string(),
                    description: z.string().optional(),
                    domain: z.string(),
                    tabId: z.number(),
                    url: z.string(),
                    favicon: z.string().optional(),
                    inputSchema: z.record(z.string(), z.unknown()),
                })
            ),
            tabId: z.number(),
            domain: z.string(),
            url: z.string(),
        }),
        response: BasicResponseSchema,
    },

    'webmcp/tools/list': {
        payload: z.undefined(),
        response: z.object({
            success: z.boolean(),
            data: z
                .object({
                    tools: z.array(z.unknown()),
                })
                .optional(),
            error: z.string().optional(),
        }),
    },

    'webmcp/tools/state': {
        payload: z.undefined(),
        response: z.object({
            success: z.boolean(),
            data: z
                .object({
                    tools: z.array(z.unknown()),
                    activeTabId: z.number().nullable(),
                    activeDomain: z.string().nullable(),
                    isDiscovering: z.boolean(),
                    lastUpdated: z.number(),
                })
                .optional(),
            error: z.string().optional(),
        }),
    },

    'webmcp/tool/call': {
        payload: z.object({
            toolName: z.string(),
            args: z.record(z.string(), z.unknown()),
        }),
        response: z.object({
            success: z.boolean(),
            result: z.unknown().optional(),
            error: z.string().optional(),
        }),
    },

    'webmcp/tools/refresh': {
        payload: z.undefined(),
        response: BasicResponseSchema,
    },

    'webmcp/tools/updated': {
        payload: z.object({
            tools: z.array(z.unknown()),
        }),
        response: z.void(),
    },
} as const;

// =============================================================================
// TYPE INFERENCE
// =============================================================================

/** Type for message schema keys */
export type MessageSchemaType = keyof typeof MessageSchemas;
