// Browser agent implementation
// Barrel export for browser agent

export {
    browserActionAgentDeclaration,
    executeBrowserActionAgent
} from './browserActionAgent';

export {
    getBrowserCapabilitiesSummary,
    getGeminiLiveSystemInstruction,
    BROWSER_ACTION_AGENT_SYSTEM_INSTRUCTION,
    BROWSER_ACTION_TOOL_DESCRIPTION
} from './prompts';
