/**
 * Backend Chat with Tools - Tool Preparation
 *
 * Utilities for preparing tool schemas before sending to the backend.
 * Handles fetching tool definitions and sanitizing them for Gemini compatibility.
 *
 * @module backendChatWithTools/prepareTool
 */

import { createLogger } from '~logger';
import { getToolSchemas } from '../frontendToolExecutor';
import { prepareToolSchemasForBackend } from './toolNameSanitizer';

const log = createLogger('PrepareTools', 'AI_CHAT_BACKEND');

/**
 * Result of tool preparation containing sanitized schemas and name mappings.
 */
export interface ToolPreparationResult {
    /**
     * Sanitized tool schemas ready to send to the backend.
     * Tool names are modified to be Gemini-compatible (alphanumeric + underscores only).
     */
    sanitizedSchemas: Record<string, unknown>;

    /**
     * Mapping from sanitized names back to original names.
     * Used to restore original tool names when processing tool call results.
     *
     * @example
     * ```typescript
     * // If original name was "notion-search", sanitized becomes "notion_search"
     * toolNameMapping: { "notion_search": "notion-search" }
     * ```
     */
    toolNameMapping: Record<string, string>;

    /**
     * Total number of tools prepared.
     */
    toolCount: number;
}

/**
 * Prepares tool schemas for backend transmission.
 *
 * This function:
 * 1. Fetches all available tool schemas
 * 2. Excludes server-executed tools when search is enabled (backend adds them)
 * 3. Sanitizes tool names for Gemini API compatibility
 * 4. Creates a mapping to restore original names on response
 *
 * @param searchEnabled - Whether search mode is enabled.
 *                        When true, server-executed tools are excluded from the schema
 *                        as the backend will add and execute them directly.
 *
 * @returns Promise resolving to the prepared tool schemas, name mapping, and count.
 *
 * @example
 * ```typescript
 * const { sanitizedSchemas, toolNameMapping, toolCount } = await prepareTools(true);
 * console.log(`Prepared ${toolCount} tools for backend`);
 *
 * // Later, when receiving tool calls:
 * const originalName = toolNameMapping[receivedToolName] || receivedToolName;
 * ```
 *
 * @throws Will throw if tool schema fetching fails.
 */
export async function prepareTools(searchEnabled?: boolean): Promise<ToolPreparationResult> {
    // Get tool schemas to send to backend
    // Exclude server-executed tools when searchEnabled (backend will add them)
    const toolSchemas = await getToolSchemas(searchEnabled);

    // Sanitize tool names for Gemini compatibility
    const { sanitizedSchemas, toolNameMapping } = prepareToolSchemasForBackend(toolSchemas);

    const toolCount = Object.keys(sanitizedSchemas).length;
    log.info('Tool schemas prepared', { toolCount, searchEnabled: !!searchEnabled });

    return {
        sanitizedSchemas,
        toolNameMapping,
        toolCount,
    };
}
