/**
 * Tool Name Sanitizer
 * 
 * Gemini API requires function names to:
 * - Start with a letter or underscore (not a digit)
 * - Only contain alphanumeric chars, underscores, dots, colons, dashes
 * 
 * This module provides utilities to sanitize and unsanitize tool names
 * for Gemini compatibility while maintaining mappings for lookups.
 */

/**
 * Sanitize a tool name for Gemini compatibility.
 * If the name starts with a digit, prefix with "fn_".
 * Replace any invalid characters with underscores.
 */
export function sanitizeToolName(name: string): string {
    let sanitized = name;
    // If starts with digit, prefix with fn_
    if (/^[0-9]/.test(sanitized)) {
        sanitized = `fn_${sanitized}`;
    }
    // Replace invalid chars with underscore (allowed: a-z, A-Z, 0-9, _, ., -, :)
    sanitized = sanitized.replace(/[^a-zA-Z0-9_.:-]/g, '_');
    return sanitized;
}

/**
 * Check if a tool name was sanitized (has fn_ prefix added for digit-starting names)
 */
export function isSanitizedName(name: string): boolean {
    // Check if it has fn_ prefix AND the character after fn_ is a digit
    return name.startsWith('fn_') && /^fn_[0-9]/.test(name);
}

/**
 * Get the original tool name from a potentially sanitized name.
 * Only removes fn_ prefix if the name was sanitized (fn_ followed by digit).
 */
export function getOriginalToolName(name: string): string {
    if (isSanitizedName(name)) {
        return name.substring(3); // Remove 'fn_' prefix
    }
    return name;
}

/**
 * Get both original and sanitized versions of a tool name.
 * Useful for registering tools under both keys.
 */
export function getToolNameVariants(originalName: string): { original: string; sanitized: string } {
    const sanitized = sanitizeToolName(originalName);
    return {
        original: originalName,
        sanitized,
    };
}
