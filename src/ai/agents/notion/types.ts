/**
 * Type definitions for Notion Creator Agent
 * This agent creates hierarchical Notion pages using MCP tools
 */

/**
 * Input for Notion Creator Agent
 * Specifies the main page and nested pages to create
 */
export interface NotionCreatorInput {
    /** Title for the main Notion page */
    mainPageTitle: string;

    /** Video URL to be added as a page property */
    videoUrl: string;

    /** Array of nested pages to create under the main page */
    nestedPages: NestedPageInput[];

    /** Optional: Parent page ID to nest the main page under */
    parentPageId?: string;
}

/**
 * A single nested page to create
 */
export interface NestedPageInput {
    /** Title of the nested page */
    title: string;

    /** Content/body of the nested page (can be markdown or plain text) */
    content: string;
}

/**
 * Output from Notion Creator Agent
 * Contains URLs and status of created pages
 */
export interface NotionCreatorOutput {
    /** Whether the operation succeeded */
    success: boolean;

    /** URL of the main page created */
    mainPageUrl?: string;

    /** URLs of all nested pages created */
    nestedPageUrls?: string[];

    /** Total number of pages created (including main page) */
    pageCount?: number;

    /** Success or error message */
    message: string;

    /** Error details if operation failed */
    error?: string;
}

/**
 * Result from a single Notion page creation
 */
export interface NotionPageCreationResult {
    /** Page ID returned by Notion API */
    id: string;

    /** URL to access the page */
    url: string;

    /** Title of the created page */
    title: string;
}
