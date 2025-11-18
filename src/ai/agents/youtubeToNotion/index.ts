/**
 * YouTube to Notion Agent Module
 * Exports all types and functions for the YouTube to Notion agent
 */

// Types
export type {
    VideoType,
    NoteFormat,
    YouTubeToNotionInput,
    YouTubeToNotionOutput,
    StructuredVideoNotes,
    NestedPage,
    VideoNotesTemplate
} from './types';

// Templates
export {
    VIDEO_TEMPLATES,
    VIDEO_TYPE_KEYWORDS,
    detectVideoType,
    getTemplate,
    generateTemplateGuidelines
} from './templates';

// Agent
export { executeYouTubeToNotionAgent } from './youtubeToNotionAgent';

// Tool
export {
    youtubeToNotionAgentDeclaration,
    executeYouTubeToNotion
} from './youtubeToNotionAgentTool';
