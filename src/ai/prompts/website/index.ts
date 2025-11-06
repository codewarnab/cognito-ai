// Types
export type { WebsiteConfig, WebsiteToolContext } from './types';

// Website Detection
export {
    getCurrentWebsite,
    matchUrlToWebsite,
    getAllWebsiteConfigs,
    registerWebsiteConfig,
} from './websiteDetector';

// Tool Mapping
export {
    getWebsiteTools,
    isToolAllowedForWebsite,
    getAllowedToolNames,
    getToolFilterStats,
} from './toolMapper';

// Prompt Augmentation
export {
    getWebsitePromptAddition,
    augmentSystemPrompt,
    createWebsitePromptSection,
    validatePromptAddition,
} from './promptAugmenter';

// Site Configurations
export {
    baseWebsiteConfig,
    // FUTURE: Add website-specific configs here
    // Example:
    // googleDocsConfig,
    // googleSheetsConfig,
} from './sites';
