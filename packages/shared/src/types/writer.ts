/**
 * Writer Feature Types
 * Shared types for the /write slash command feature
 */

/**
 * Tone options for generated content
 */
export type WriteTone = 'professional' | 'casual' | 'formal' | 'friendly';

/**
 * Page context information for writing
 * Provides context about the current page for better writing suggestions
 */
export interface WritePageContext {
    title: string;
    url: string;
    domain: string;
    platform?: string;
    fieldType?: string;
}

/**
 * Available platforms for contextual writing
 */
export type WritePlatform =
    | 'Gmail'
    | 'LinkedIn'
    | 'Twitter'
    | 'GitHub'
    | 'Slack'
    | 'Discord'
    | 'Web';
