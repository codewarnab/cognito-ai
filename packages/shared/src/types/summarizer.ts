/**
 * Summarizer Feature Types
 * Shared types for the text summarization feature
 */

/**
 * Summary type options
 * - key-points: Extract main ideas as a bulleted list
 * - tl-dr: Concise 2-3 sentence summary
 * - headline: Single headline capturing the main idea
 * - teaser: Brief teaser to encourage reading the full text
 */
export type SummaryType = 'key-points' | 'tl-dr' | 'headline' | 'teaser';

/**
 * Summary length options
 * Controls the approximate length of the generated summary
 */
export type SummaryLength = 'short' | 'medium' | 'long';

/**
 * Page context for summarization
 * Provides context about the source page for better summaries
 */
export interface SummaryPageContext {
    title: string;
    url: string;
    domain: string;
}
