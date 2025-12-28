/**
 * Tool Name Sanitizer
 * 
 * Sanitizes tool names for Gemini API compatibility.
 * Gemini has specific requirements for tool names.
 */

import { createLogger } from '~logger';

const log = createLogger('ToolNameSanitizer', 'AI_CHAT_BACKEND');

/**
 * Sanitize a tool name for Gemini compatibility
 * 
 * Gemini tool names must:
 * - Not start with a digit
 * - Only contain: a-z, A-Z, 0-9, _, ., -, :
 * 
 * @param name - Original tool name
 * @returns Sanitized tool name safe for Gemini
 */
export function sanitizeToolName(name: string): string {
    // If starts with digit, prefix with tool_
    let sanitized = name;
    if (/^[0-9]/.test(sanitized)) {
        sanitized = `tool_${sanitized}`;
    }
    // Replace invalid chars with underscore (allowed: a-z, A-Z, 0-9, _, ., -, :)
    sanitized = sanitized.replace(/[^a-zA-Z0-9_.:-]/g, '_');
    return sanitized;
}

/**
 * Prepare tool schemas for backend by sanitizing names
 * 
 * @param toolSchemas - Original tool schemas
 * @returns Object with sanitized schemas and name mapping
 */
export function prepareToolSchemasForBackend(toolSchemas: Record<string, any>): {
    sanitizedSchemas: Record<string, any>;
    toolNameMapping: Record<string, string>; // sanitized -> original
} {
    const sanitizedSchemas: Record<string, any> = {};
    const toolNameMapping: Record<string, string> = {};

    for (const [name, schema] of Object.entries(toolSchemas)) {
        const sanitized = sanitizeToolName(name);
        sanitizedSchemas[sanitized] = schema;
        toolNameMapping[sanitized] = name;

        if (name !== sanitized) {
            log.info('🔧 Sanitized tool name for backend:', { original: name, sanitized });
        }
    }

    return { sanitizedSchemas, toolNameMapping };
}

/**
 * Map a sanitized tool name back to its original name
 * 
 * @param sanitizedName - The sanitized name received from backend
 * @param toolNameMapping - The mapping from prepareToolSchemasForBackend
 * @returns Original tool name (or sanitized name if no mapping exists)
 */
export function mapToolNameBack(
    sanitizedName: string,
    toolNameMapping: Record<string, string>
): string {
    return toolNameMapping[sanitizedName] || sanitizedName;
}
