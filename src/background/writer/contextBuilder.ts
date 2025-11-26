/**
 * Context Builder
 * Builds rich context from page information for better writing suggestions
 */

import { createLogger } from '~logger';
import type { WritePageContext } from '@/types';

const log = createLogger('ContextBuilder', 'BACKGROUND');

/**
 * Platform detection patterns
 * Maps URL patterns to platform names
 */
const PLATFORM_PATTERNS: Array<{
    pattern: RegExp;
    platform: string;
    fieldType?: string;
    suggestedTone: string;
}> = [
        // Email platforms
        {
            pattern: /mail\.google\.com/i,
            platform: 'Gmail',
            fieldType: 'email',
            suggestedTone: 'professional',
        },
        {
            pattern: /outlook\.(live|office)\.com/i,
            platform: 'Outlook',
            fieldType: 'email',
            suggestedTone: 'professional',
        },
        {
            pattern: /mail\.yahoo\.com/i,
            platform: 'Yahoo Mail',
            fieldType: 'email',
            suggestedTone: 'professional',
        },

        // Professional networks
        {
            pattern: /linkedin\.com\/messaging/i,
            platform: 'LinkedIn',
            fieldType: 'message',
            suggestedTone: 'professional',
        },
        {
            pattern: /linkedin\.com/i,
            platform: 'LinkedIn',
            fieldType: 'post',
            suggestedTone: 'professional',
        },

        // Social media
        {
            pattern: /(twitter|x)\.com/i,
            platform: 'Twitter',
            fieldType: 'tweet',
            suggestedTone: 'casual',
        },
        {
            pattern: /facebook\.com/i,
            platform: 'Facebook',
            fieldType: 'post',
            suggestedTone: 'casual',
        },
        {
            pattern: /instagram\.com/i,
            platform: 'Instagram',
            fieldType: 'caption',
            suggestedTone: 'casual',
        },
        {
            pattern: /threads\.net/i,
            platform: 'Threads',
            fieldType: 'post',
            suggestedTone: 'casual',
        },
        {
            pattern: /reddit\.com/i,
            platform: 'Reddit',
            fieldType: 'comment',
            suggestedTone: 'casual',
        },

        // Developer platforms
        {
            pattern: /github\.com.*\/(issues|pull)/i,
            platform: 'GitHub',
            fieldType: 'issue-comment',
            suggestedTone: 'professional',
        },
        {
            pattern: /github\.com/i,
            platform: 'GitHub',
            fieldType: 'markdown',
            suggestedTone: 'professional',
        },
        {
            pattern: /gitlab\.com/i,
            platform: 'GitLab',
            fieldType: 'markdown',
            suggestedTone: 'professional',
        },
        {
            pattern: /stackoverflow\.com/i,
            platform: 'Stack Overflow',
            fieldType: 'answer',
            suggestedTone: 'professional',
        },

        // Messaging platforms
        {
            pattern: /slack\.com/i,
            platform: 'Slack',
            fieldType: 'message',
            suggestedTone: 'casual',
        },
        {
            pattern: /discord\.com/i,
            platform: 'Discord',
            fieldType: 'message',
            suggestedTone: 'casual',
        },
        {
            pattern: /teams\.microsoft\.com/i,
            platform: 'Microsoft Teams',
            fieldType: 'message',
            suggestedTone: 'professional',
        },
        {
            pattern: /web\.whatsapp\.com/i,
            platform: 'WhatsApp',
            fieldType: 'message',
            suggestedTone: 'casual',
        },
        {
            pattern: /web\.telegram\.org/i,
            platform: 'Telegram',
            fieldType: 'message',
            suggestedTone: 'casual',
        },

        // Documentation platforms
        {
            pattern: /notion\.so/i,
            platform: 'Notion',
            fieldType: 'document',
            suggestedTone: 'professional',
        },
        {
            pattern: /docs\.google\.com/i,
            platform: 'Google Docs',
            fieldType: 'document',
            suggestedTone: 'professional',
        },
        {
            pattern: /medium\.com/i,
            platform: 'Medium',
            fieldType: 'article',
            suggestedTone: 'professional',
        },
    ];

/**
 * Platform detection result
 */
export interface PlatformInfo {
    platform: string;
    fieldType: string;
    suggestedTone: string;
}

/**
 * Detect platform from URL
 * Returns platform info or defaults for unknown sites
 */
export function detectPlatform(url: string): PlatformInfo {
    try {
        for (const { pattern, platform, fieldType, suggestedTone } of PLATFORM_PATTERNS) {
            if (pattern.test(url)) {
                log.debug('Platform detected', { platform, url });
                return {
                    platform,
                    fieldType: fieldType || 'text',
                    suggestedTone,
                };
            }
        }
    } catch (error) {
        log.warn('Failed to detect platform', { url, error });
    }

    // Default for unknown platforms
    return {
        platform: 'Web',
        fieldType: 'text',
        suggestedTone: 'professional',
    };
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch {
        return 'unknown';
    }
}

/**
 * Build page context from raw page data
 */
export function buildPageContext(
    title: string,
    url: string,
    additionalContext?: Partial<WritePageContext>
): WritePageContext {
    const domain = extractDomain(url);
    const platformInfo = detectPlatform(url);

    return {
        title,
        url,
        domain,
        platform: platformInfo.platform,
        fieldType: platformInfo.fieldType,
        ...additionalContext,
    };
}

/**
 * Build a context string for the AI prompt
 * Used to provide context about the writing environment
 */
export function buildContextString(context: WritePageContext): string {
    const parts: string[] = [];

    if (context.platform) {
        parts.push(`Platform: ${context.platform}`);
    }

    if (context.domain) {
        parts.push(`Domain: ${context.domain}`);
    }

    if (context.title) {
        parts.push(`Page: "${context.title}"`);
    }

    if (context.fieldType) {
        parts.push(`Field: ${context.fieldType}`);
    }

    return parts.join(' | ');
}

/**
 * Get suggested tone based on platform
 */
export function getSuggestedTone(url: string): string {
    const platformInfo = detectPlatform(url);
    return platformInfo.suggestedTone;
}
