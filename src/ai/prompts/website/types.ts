export interface WebsiteConfig {
    id: string;
    name: string;
    urlPatterns: string[];        // URL patterns to match (e.g., 'docs.google.com/document')
    allowedTools: string[];       // Tool names allowed on this site
    promptAddition: string;       // Prompt text to inject for this site
    priority?: number;            // Match priority (higher = check first)
}

export interface WebsiteToolContext {
    websiteId: string;
    websiteName: string;
    allowedTools: string[];
    promptAddition: string;
    currentUrl: string;
}
