/**
 * Prompt Constants
 * Shared prompt instructions for AI content features
 */

import type { WriteTone, WritePlatform } from '../types/writer.js';
import type { RewritePreset } from '../types/rewriter.js';
import type { SummaryType, SummaryLength } from '../types/summarizer.js';

/**
 * Tone-specific instructions for writer
 */
export const TONE_INSTRUCTIONS: Record<WriteTone, string> = {
    professional: 'Use a professional, business-appropriate tone. Be clear, respectful, and focused.',
    casual: 'Use a casual, relaxed tone. Be friendly and conversational.',
    formal: 'Use a formal tone. Be precise, respectful, and proper.',
    friendly: 'Use a warm, friendly tone. Be approachable and personable.',
};

/**
 * Platform-specific writing instructions
 * Frontend version (more detailed)
 */
export const PLATFORM_INSTRUCTIONS: Record<WritePlatform, string> = {
    Gmail: 'You are writing an email. Be clear, professional, and include appropriate greetings/closings when appropriate.',
    LinkedIn: 'You are writing for a professional network. Be engaging, business-appropriate, and thoughtful.',
    Twitter: 'You are writing a tweet. Be concise (under 280 chars if possible), engaging, and consider hashtags if appropriate.',
    GitHub: 'You are writing for developers. Be technical, clear, and follow markdown conventions when helpful.',
    Slack: 'You are writing a workplace message. Be concise, friendly, and professional.',
    Discord: 'You are writing a chat message. Be casual and conversational.',
    Web: 'You are writing general web content. Be clear and helpful.',
};

/**
 * Preset prompts for rewriter
 * All presets include edge case handling: questions/prompts should be transformed, not answered
 * Frontend version (more detailed with edge-case handling)
 */
export const PRESET_PROMPTS: Record<RewritePreset, string> = {
    shorter: 'Make this text shorter and more concise while preserving the key meaning. If the text is a question or prompt, shorten the question/prompt itself - do NOT answer it',
    longer: 'Expand this text by adding more detail, context, and elaboration. If the text is a question or prompt, make it a more detailed and comprehensive question/prompt - do NOT answer it',
    professional: 'Rewrite this in a more professional and formal tone. If the text is a question or prompt, make it more professionally worded - do NOT answer it',
    casual: 'Rewrite this in a more casual and friendly tone. If the text is a question or prompt, make it sound more casual - do NOT answer it',
    improve: 'Improve this text by fixing grammar, clarity, and flow. If the text is a question or prompt, improve the question/prompt itself - do NOT answer it',
    simplify: 'Simplify this text for easier understanding. If the text is a question or prompt, simplify the question/prompt itself - do NOT answer it',
    enthusiastic: 'Rewrite this in a more enthusiastic and positive tone. If the text is a question or prompt, make it sound more enthusiastic - do NOT answer it',
    conversational: 'Rewrite this in a more natural, conversational style. If the text is a question or prompt, make it more conversational - do NOT answer it',
};

/**
 * Summary type instructions
 * Frontend version (more detailed)
 */
export const SUMMARY_TYPE_INSTRUCTIONS: Record<SummaryType, string> = {
    'key-points': 'Extract the key points from the text as a bulleted list. Focus on the main ideas and important details.',
    'tl-dr': 'Provide a concise TL;DR summary of the text. Capture the essence in 2-3 sentences.',
    'headline': 'Create a single headline that captures the main idea of the text.',
    'teaser': 'Write a brief teaser that would make someone want to read the full text.',
};

/**
 * Summary length token limits
 */
export const SUMMARY_LENGTH_TOKENS: Record<SummaryLength, number> = {
    short: 100,
    medium: 250,
    long: 500,
};

/**
 * Suggestion capabilities for AI context
 */
export const SUGGESTION_CAPABILITIES = [
    'navigate to websites and search the web',
    'manage and organize browser tabs into groups',
    'search browser history and find previously visited pages',
    'set reminders for tasks and deadlines',
    'save and retrieve information to/from memory',
    'interact with pages (click buttons, fill forms, read content)',
    'send emails using web-based email services',
    'analyze YouTube videos and provide insights',
] as const;
