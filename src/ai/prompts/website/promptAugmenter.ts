import type { WebsiteToolContext } from './types';

/**
 * Gets the website-specific prompt addition for the current website
 * @param websiteContext - Current website context
 * @returns Website-specific prompt text, or empty string if no context
 */
export function getWebsitePromptAddition(
    websiteContext: WebsiteToolContext | null
): string {
    if (!websiteContext) {
        return '';
    }

    return websiteContext.promptAddition;
}

/**
 * Augments the base system prompt with website-specific documentation
 * @param basePrompt - The base system prompt
 * @param websiteContext - Current website context
 * @returns Augmented prompt with website-specific additions
 */
export function augmentSystemPrompt(
    basePrompt: string,
    websiteContext: WebsiteToolContext | null
): string {
    if (!websiteContext || !websiteContext.promptAddition) {
        return basePrompt;
    }

    // Combine base prompt with website-specific addition
    // Add separator for clarity
    return `${basePrompt}

${'='.repeat(80)}
WEBSITE-SPECIFIC CONTEXT
${'='.repeat(80)}

${websiteContext.promptAddition}`;
}

/**
 * Creates a formatted prompt section for the current website
 * @param websiteContext - Current website context
 * @returns Formatted prompt section with website information
 */
export function createWebsitePromptSection(
    websiteContext: WebsiteToolContext | null
): string {
    if (!websiteContext) {
        return '';
    }

    return `
📍 Current Website: ${websiteContext.websiteName}
🔗 URL: ${websiteContext.currentUrl}
🔧 Available Tools: ${websiteContext.allowedTools.length} tools enabled

${websiteContext.promptAddition}
`;
}

/**
 * Validates that a prompt addition is well-formed
 * @param promptAddition - The prompt addition text to validate
 * @returns Object with validation result and any warnings
 */
export function validatePromptAddition(promptAddition: string): {
    isValid: boolean;
    warnings: string[];
} {
    const warnings: string[] = [];

    // Check if prompt is empty
    if (!promptAddition || promptAddition.trim().length === 0) {
        warnings.push('Prompt addition is empty');
        return { isValid: false, warnings };
    }

    // Check for reasonable length (not too short, not too long)
    if (promptAddition.length < 50) {
        warnings.push('Prompt addition seems very short (< 50 characters)');
    }

    if (promptAddition.length > 10000) {
        warnings.push(
            'Prompt addition is very long (> 10000 characters), may impact performance'
        );
    }

    // Check for common formatting issues
    if (!promptAddition.includes('===') && !promptAddition.includes('---')) {
        warnings.push('No section separators found, consider adding for clarity');
    }

    return {
        isValid: warnings.length === 0 || warnings.every((w) => !w.includes('empty')),
        warnings,
    };
}
