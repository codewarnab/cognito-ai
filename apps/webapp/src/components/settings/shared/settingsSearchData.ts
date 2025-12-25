/**
 * Searchable settings metadata
 * Maps setting keywords to their accordion locations
 */
export interface SearchableSetting {
    section: 'ai-search' | 'voice' | 'writing' | 'memory' | 'danger';
    accordion: string;
    title: string;
    description: string;
    keywords: string[];
}

/**
 * All searchable settings with their keywords
 */
export const SEARCHABLE_SETTINGS: SearchableSetting[] = [
    // AI & Search Section
    {
        section: 'ai-search',
        accordion: 'ai-behavior',
        title: 'AI Behavior',
        description: 'Configure general AI interaction settings',
        keywords: [
            'maximum tool calls', 'tool limit', 'actions',
            'show suggestions', 'suggested actions'
        ]
    },
    {
        section: 'ai-search',
        accordion: 'web-search',
        title: 'Web Search',
        description: 'Configure Tavily search integration',
        keywords: [
            'tavily', 'api key', 'maximum results',
            'search results', 'include images', 'image results'
        ]
    },
    {
        section: 'ai-search',
        accordion: 'research',
        title: 'Research Workflow',
        description: 'Configure automated research behavior',
        keywords: [
            'minimum sources', 'sources',
            'maximum steps', 'step count', 'automated research'
        ]
    },

    // Voice & Audio Section
    {
        section: 'voice',
        accordion: 'tts',
        title: 'Text-to-Speech',
        description: 'Configure voice output settings',
        keywords: [
            'tts', 'voice', 'audio', 'tts provider',
            'gemini voice', 'voice output', 'preview voice', 'aoede',
            'charon', 'fenrir', 'kore', 'orion', 'orus', 'puck', 'web native'
        ]
    },

    // Writing Tools Section
    {
        section: 'writing',
        accordion: 'summarizer',
        title: 'Text Summarizer',
        description: 'Configure text selection summarization',
        keywords: [
            'summarize', 'summary', 'summary type',
            'key points', 'tl;dr', 'headline', 'teaser', 'summary length',
            'minimum text length'
        ]
    },
    {
        section: 'writing',
        accordion: 'rewriter',
        title: 'Text Rewriter',
        description: 'Configure text rewriting options',
        keywords: [
            'rewrite', 'preset buttons',
            'shorten', 'expand'
        ]
    },
    {
        section: 'writing',
        accordion: 'write',
        title: 'Write Command',
        description: 'Configure /write command behavior',
        keywords: [
            '/write', 'default tone', 'professional',
            'casual', 'formal', 'friendly', 'page context'
        ]
    },

    // Memory Section
    {
        section: 'memory',
        accordion: 'supermemory',
        title: 'Supermemory',
        description: 'Configure persistent memory integration',
        keywords: [
            'memory', 'persistent memory', 'api key',
            'auto-extract', 'auto extract', 'insights', 'conversations'
        ]
    },

    // Danger Zone
    {
        section: 'danger',
        accordion: 'danger-zone',
        title: 'Danger Zone',
        description: 'Delete all data',
        keywords: [
            'danger zone', 'delete all data', 'clear history',
            'reset', 'delete', 'remove'
        ]
    }
];

/**
 * Check if an accordion matches the search query
 * Searches through title, description, and keywords
 */
export function accordionMatchesQuery(accordion: string, query: string): boolean {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return true; // Show all when no query

    const setting = SEARCHABLE_SETTINGS.find(s => s.accordion === accordion);
    if (!setting) return true; // Show unknown accordions

    // Check title
    if (setting.title.toLowerCase().includes(lowerQuery)) return true;

    // Check description
    if (setting.description.toLowerCase().includes(lowerQuery)) return true;

    // Check keywords
    for (const keyword of setting.keywords) {
        if (keyword.toLowerCase().includes(lowerQuery)) return true;
    }

    return false;
}

/**
 * Find all accordions that match a search query
 */
export function findMatchingAccordions(query: string): Set<string> {
    const matches = new Set<string>();
    const lowerQuery = query.toLowerCase().trim();

    if (!lowerQuery) return matches;

    for (const setting of SEARCHABLE_SETTINGS) {
        if (accordionMatchesQuery(setting.accordion, query)) {
            matches.add(setting.accordion);
        }
    }

    return matches;
}

/**
 * Check if text matches the search query
 */
export function textMatchesQuery(text: string, query: string): boolean {
    if (!query.trim()) return false;
    return text.toLowerCase().includes(query.toLowerCase().trim());
}

/**
 * Check if a section has any visible accordions
 */
export function sectionHasVisibleAccordions(section: 'ai-search' | 'voice' | 'writing' | 'memory' | 'danger', query: string): boolean {
    if (!query.trim()) return true; // Show all sections when no query

    return SEARCHABLE_SETTINGS
        .filter(s => s.section === section)
        .some(s => accordionMatchesQuery(s.accordion, query));
}
