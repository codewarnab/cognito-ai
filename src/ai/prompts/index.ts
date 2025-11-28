// Prompt management
// Barrel export for prompts module

export * from './utils';
export * from './templates';

// Search prompt
export {
    SEARCH_SYSTEM_PROMPT,
    SEARCH_USER_REMINDER,
    getSearchPromptAddition
} from './searchPrompt';
