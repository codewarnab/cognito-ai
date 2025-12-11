/**
 * Platform Detector
 * Detects the current platform/website for context-aware writing suggestions
 */

export interface PlatformInfo {
    platform: string;
    fieldType: string;
    suggestedTone: 'professional' | 'casual' | 'formal' | 'friendly' | 'neutral';
}

/**
 * Platform detection patterns
 */
const PLATFORM_PATTERNS: Array<{
    pattern: RegExp;
    platform: string;
    fieldType: string;
    tone: PlatformInfo['suggestedTone'];
    pathCheck?: (path: string) => { fieldType?: string; tone?: PlatformInfo['suggestedTone'] } | null;
}> = [
        // Email clients
        {
            pattern: /mail\.google\.com/,
            platform: 'Gmail',
            fieldType: 'email',
            tone: 'professional',
        },
        {
            pattern: /outlook\.(live|office)\.com/,
            platform: 'Outlook',
            fieldType: 'email',
            tone: 'professional',
        },
        {
            pattern: /mail\.yahoo\.com/,
            platform: 'Yahoo Mail',
            fieldType: 'email',
            tone: 'professional',
        },
        // Professional networks
        {
            pattern: /linkedin\.com/,
            platform: 'LinkedIn',
            fieldType: 'post',
            tone: 'professional',
            pathCheck: (path) => {
                if (path.includes('/messaging/')) {
                    return { fieldType: 'message', tone: 'professional' };
                }
                if (path.includes('/feed/')) {
                    return { fieldType: 'post', tone: 'professional' };
                }
                return null;
            },
        },
        // Social media
        {
            pattern: /(twitter\.com|x\.com)/,
            platform: 'Twitter',
            fieldType: 'tweet',
            tone: 'casual',
        },
        {
            pattern: /facebook\.com/,
            platform: 'Facebook',
            fieldType: 'post',
            tone: 'casual',
        },
        {
            pattern: /instagram\.com/,
            platform: 'Instagram',
            fieldType: 'caption',
            tone: 'casual',
        },
        {
            pattern: /reddit\.com/,
            platform: 'Reddit',
            fieldType: 'comment',
            tone: 'casual',
            pathCheck: (path) => {
                if (path.includes('/submit')) {
                    return { fieldType: 'post' };
                }
                return null;
            },
        },
        // Developer platforms
        {
            pattern: /github\.com/,
            platform: 'GitHub',
            fieldType: 'comment',
            tone: 'professional',
            pathCheck: (path) => {
                if (path.includes('/issues/') || path.includes('/pull/')) {
                    return { fieldType: 'comment' };
                }
                if (path.includes('/discussions/')) {
                    return { fieldType: 'discussion' };
                }
                return { fieldType: 'markdown' };
            },
        },
        {
            pattern: /gitlab\.com/,
            platform: 'GitLab',
            fieldType: 'comment',
            tone: 'professional',
        },
        {
            pattern: /stackoverflow\.com/,
            platform: 'Stack Overflow',
            fieldType: 'answer',
            tone: 'professional',
        },
        // Messaging platforms
        {
            pattern: /slack\.com/,
            platform: 'Slack',
            fieldType: 'message',
            tone: 'casual',
        },
        {
            pattern: /discord\.com/,
            platform: 'Discord',
            fieldType: 'message',
            tone: 'casual',
        },
        {
            pattern: /teams\.microsoft\.com/,
            platform: 'Microsoft Teams',
            fieldType: 'message',
            tone: 'professional',
        },
        {
            pattern: /web\.whatsapp\.com/,
            platform: 'WhatsApp',
            fieldType: 'message',
            tone: 'casual',
        },
        {
            pattern: /telegram\.org|web\.telegram\.org/,
            platform: 'Telegram',
            fieldType: 'message',
            tone: 'casual',
        },
        // Productivity platforms
        {
            pattern: /notion\.so/,
            platform: 'Notion',
            fieldType: 'document',
            tone: 'neutral',
        },
        {
            pattern: /docs\.google\.com/,
            platform: 'Google Docs',
            fieldType: 'document',
            tone: 'neutral',
        },
        {
            pattern: /trello\.com/,
            platform: 'Trello',
            fieldType: 'card',
            tone: 'professional',
        },
        {
            pattern: /asana\.com/,
            platform: 'Asana',
            fieldType: 'task',
            tone: 'professional',
        },
        {
            pattern: /monday\.com/,
            platform: 'Monday',
            fieldType: 'update',
            tone: 'professional',
        },
        {
            pattern: /jira\.atlassian\.com|[a-z]+\.atlassian\.net/,
            platform: 'Jira',
            fieldType: 'ticket',
            tone: 'professional',
        },
        // Video/Meeting platforms
        {
            pattern: /zoom\.us/,
            platform: 'Zoom',
            fieldType: 'chat',
            tone: 'professional',
        },
        // Content platforms
        {
            pattern: /medium\.com/,
            platform: 'Medium',
            fieldType: 'article',
            tone: 'neutral',
        },
        {
            pattern: /wordpress\.com|wp-admin/,
            platform: 'WordPress',
            fieldType: 'post',
            tone: 'neutral',
        },
        // Support platforms
        {
            pattern: /zendesk\.com/,
            platform: 'Zendesk',
            fieldType: 'ticket',
            tone: 'professional',
        },
        {
            pattern: /intercom\.com|intercom\.io/,
            platform: 'Intercom',
            fieldType: 'reply',
            tone: 'friendly',
        },
    ];

/**
 * Default platform info for unknown websites
 */
const DEFAULT_PLATFORM: PlatformInfo = {
    platform: 'Web',
    fieldType: 'text',
    suggestedTone: 'neutral',
};

/**
 * Detect the current platform based on hostname and pathname
 */
export function detectPlatform(): PlatformInfo {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;

    for (const config of PLATFORM_PATTERNS) {
        if (config.pattern.test(hostname)) {
            let fieldType = config.fieldType;
            let tone = config.tone;

            // Check path-specific overrides
            if (config.pathCheck) {
                const pathResult = config.pathCheck(pathname);
                if (pathResult) {
                    if (pathResult.fieldType) fieldType = pathResult.fieldType;
                    if (pathResult.tone) tone = pathResult.tone;
                }
            }

            return {
                platform: config.platform,
                fieldType,
                suggestedTone: tone,
            };
        }
    }

    return DEFAULT_PLATFORM;
}

/**
 * Get platform-specific writing instructions
 */
export function getPlatformInstructions(platform: string): string {
    const instructions: Record<string, string> = {
        Gmail: 'You are writing an email. Be clear, professional, and include appropriate greetings and closings.',
        Outlook: 'You are writing an email. Be clear, professional, and follow business email conventions.',
        LinkedIn: 'You are writing for a professional network. Be engaging, business-appropriate, and authentic.',
        Twitter: 'You are writing a tweet. Be concise (under 280 characters if possible), engaging, and consider using relevant hashtags.',
        Facebook: 'You are writing a social media post. Be conversational, engaging, and personal.',
        Instagram: 'You are writing a caption. Be creative, use emojis appropriately, and consider relevant hashtags.',
        Reddit: 'You are writing for Reddit. Be authentic, follow subreddit culture, and provide value to the discussion.',
        GitHub: 'You are writing for developers. Be technical, clear, use proper markdown formatting, and follow contribution guidelines.',
        GitLab: 'You are writing for developers. Be technical, clear, and concise.',
        'Stack Overflow': 'You are writing a technical answer. Be precise, provide code examples where appropriate, and cite sources.',
        Slack: 'You are writing a workplace message. Be concise, friendly, and professional.',
        Discord: 'You are writing a chat message. Be casual, friendly, and conversational.',
        'Microsoft Teams': 'You are writing a workplace message. Be clear, professional, and concise.',
        WhatsApp: 'You are writing a personal message. Be casual and conversational.',
        Telegram: 'You are writing a chat message. Be casual and conversational.',
        Notion: 'You are writing documentation. Be clear, well-structured, and use proper formatting.',
        'Google Docs': 'You are writing a document. Be clear, well-organized, and professional.',
        Trello: 'You are writing a task or card description. Be clear and actionable.',
        Asana: 'You are writing a task description. Be clear, specific, and actionable.',
        Monday: 'You are writing a work update. Be clear and status-oriented.',
        Jira: 'You are writing a ticket or comment. Be technical, specific, and follow the project conventions.',
        Zoom: 'You are writing a chat message. Be brief and professional.',
        Medium: 'You are writing an article. Be engaging, well-structured, and provide value to readers.',
        WordPress: 'You are writing a blog post or content. Be clear, engaging, and SEO-friendly.',
        Zendesk: 'You are writing a support response. Be helpful, professional, and empathetic.',
        Intercom: 'You are writing a support reply. Be friendly, helpful, and solution-oriented.',
    };

    return instructions[platform] || 'You are a helpful writing assistant. Generate clear, appropriate content based on context.';
}

/**
 * Get the page context for AI generation
 */
export function getPageContext() {
    const platformInfo = detectPlatform();

    return {
        title: document.title,
        url: window.location.href,
        domain: window.location.hostname,
        platform: platformInfo.platform,
        fieldType: platformInfo.fieldType,
        suggestedTone: platformInfo.suggestedTone,
    };
}
