/**
 * Prompts for extracting insights from content interactions
 */

import type {
  ContentMemorySource,
  SummarizerMemoryItem,
  WriterMemoryItem,
  RewriterMemoryItem,
} from './types';

/**
 * System prompt for summarizer insights
 */
export const SUMMARIZER_SYSTEM_PROMPT = `You analyze what a user is reading and researching based on their summarization activity.

Your task: Extract insights about the user's interests and research topics.

EXTRACT insights like:
- Topics they're researching (e.g., "User is researching machine learning optimization techniques")
- Areas of interest (e.g., "User is interested in startup funding strategies")
- Domain expertise areas (e.g., "User follows React ecosystem developments")

DO NOT EXTRACT:
- The actual content of what they read (that's not useful for memory)
- Temporary or one-off lookups
- Very generic topics without context

Each insight should be:
- Written in third person ("User is interested in...")
- Specific enough to be useful in future conversations
- Focused on the USER's interests, not the content itself

After analyzing, call the save_reading_insights function with your findings.
If no useful insights can be extracted, call with an empty array.`;

/**
 * System prompt for writer insights
 */
export const WRITER_SYSTEM_PROMPT = `You analyze what a user writes about and their writing contexts based on their usage of an AI writing assistant.

Your task: Extract insights about the user's writing activities and contexts.

EXTRACT insights like:
- Topics they write about (e.g., "User writes technical documentation about APIs")
- Platforms/contexts they write for (e.g., "User frequently writes professional emails")
- Writing purposes (e.g., "User creates content for developer audiences")

DO NOT EXTRACT:
- The actual generated content
- One-time writing tasks
- Very generic writing activities

Each insight should be:
- Written in third person
- Actionable for future assistance
- Focused on patterns, not individual instances

After analyzing, call the save_writing_insights function with your findings.
If no useful insights can be extracted, call with an empty array.`;


/**
 * System prompt for rewriter insights
 */
export const REWRITER_SYSTEM_PROMPT = `You analyze a user's writing style preferences based on how they transform text using a rewriter tool.

Your task: Extract insights about the user's preferred writing styles and transformations.

EXTRACT insights like:
- Style preferences (e.g., "User prefers concise, direct writing")
- Common transformations (e.g., "User often simplifies complex text")
- Tone preferences (e.g., "User favors professional tone in work contexts")

DO NOT EXTRACT:
- The actual text content
- One-time style changes
- Changes that seem accidental or experimental

Each insight should be:
- Written in third person
- About patterns, not individual instances
- Useful for personalizing future writing assistance

After analyzing, call the save_style_insights function with your findings.
If no useful insights can be extracted, call with an empty array.`;

/**
 * Build user prompt for summarizer
 */
export function buildSummarizerPrompt(item: SummarizerMemoryItem): string {
  const { data } = item;
  return `The user summarized content from "${data.pageContext.domain}" (${data.pageContext.title}).

Summary type requested: ${data.summaryType}

Generated summary:
${data.summary}

Based on this summarization activity, extract insights about what topics or areas the user is interested in researching.`;
}

/**
 * Build user prompt for writer
 */
export function buildWriterPrompt(item: WriterMemoryItem): string {
  const { data } = item;
  const contextInfo = data.pageContext
    ? `Platform: ${data.pageContext.platform || data.pageContext.domain}
Field type: ${data.pageContext.fieldType || 'unknown'}
Page: ${data.pageContext.title}`
    : 'No page context available';

  return `The user used the AI writer with this context:
${contextInfo}

Tone selected: ${data.tone || 'default'}
Had attachment: ${data.hasAttachment}

User's prompt:
"${data.prompt}"

Based on this writing activity, extract insights about what the user writes about and their writing contexts.`;
}

/**
 * Build user prompt for rewriter
 */
export function buildRewriterPrompt(item: RewriterMemoryItem): string {
  const { data } = item;
  const contextInfo = data.pageContext
    ? `On: ${data.pageContext.domain} (${data.pageContext.title})`
    : 'No page context';

  return `The user used the rewriter with these settings:
Preset: ${data.preset || 'custom'}
Custom instruction: ${data.customInstruction || 'none'}
${contextInfo}

Original text (${data.originalText.length} chars):
"${data.originalText.substring(0, 500)}${data.originalText.length > 500 ? '...' : ''}"

Rewritten to (${data.rewrittenText.length} chars):
"${data.rewrittenText.substring(0, 500)}${data.rewrittenText.length > 500 ? '...' : ''}"

Based on this rewrite activity, extract insights about the user's preferred writing style and common transformations.`;
}

/**
 * Prompt builder configuration for each source
 */
interface PromptBuilder {
  system: string;
  build: (item: SummarizerMemoryItem | WriterMemoryItem | RewriterMemoryItem) => string;
}

/**
 * Get the appropriate prompt builder for a source
 */
export function getPromptBuilder(source: ContentMemorySource): PromptBuilder {
  switch (source) {
    case 'summarizer':
      return {
        system: SUMMARIZER_SYSTEM_PROMPT,
        build: (item) => buildSummarizerPrompt(item as SummarizerMemoryItem),
      };
    case 'writer':
      return {
        system: WRITER_SYSTEM_PROMPT,
        build: (item) => buildWriterPrompt(item as WriterMemoryItem),
      };
    case 'rewriter':
      return {
        system: REWRITER_SYSTEM_PROMPT,
        build: (item) => buildRewriterPrompt(item as RewriterMemoryItem),
      };
  }
}
