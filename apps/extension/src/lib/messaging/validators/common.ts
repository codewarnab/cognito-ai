/**
 * Common Response Schemas
 *
 * Shared Zod schemas for success/error responses used across message types.
 */

import { z } from 'zod';

// =============================================================================
// COMMON RESPONSE SCHEMAS
// =============================================================================

/** Schema for successful responses */
export const SuccessResponseSchema = z.object({
    success: z.literal(true),
});

/** Schema for error responses */
export const ErrorResponseSchema = z.object({
    success: z.literal(false),
    error: z.string().optional(),
});

/** Schema for generic success/error response */
export const ResponseSchema = z.union([SuccessResponseSchema, ErrorResponseSchema]);

/** Schema for basic success response with optional error */
export const BasicResponseSchema = z.object({
    success: z.boolean(),
    error: z.string().optional(),
});

// =============================================================================
// GEOLOCATION SCHEMAS
// =============================================================================

/** GeolocationCoordinates schema (matching Web API) */
export const GeolocationCoordsSchema = z.object({
    latitude: z.number(),
    longitude: z.number(),
    accuracy: z.number(),
    altitude: z.number().nullable(),
    altitudeAccuracy: z.number().nullable(),
    heading: z.number().nullable(),
    speed: z.number().nullable(),
});

/** GeolocationPosition schema (matching Web API) */
export const GeolocationPositionSchema = z.object({
    coords: GeolocationCoordsSchema,
    timestamp: z.number(),
});
