/**
 * Type definitions for YouTube to Notion Agent
 * This agent converts YouTube videos into structured Notion notes
 */

/**
 * Video types supported by the agent
 * Each type has a different template structure
 */
export type VideoType =
    | 'tutorial'      // How-to, coding tutorials
    | 'lecture'       // Academic, educational content
    | 'podcast'       // Interviews, discussions
    | 'documentary'   // In-depth explorations
    | 'presentation'  // Conference talks, slides
    | 'webinar'       // Professional training
    | 'course'        // Structured learning
    | 'review'        // Product/service reviews
    | 'generic';      // Fallback

/**
 * Format types for note structures
 */
export type NoteFormat = 'Q&A' | 'Step-by-Step' | 'Insights' | 'Mixed';

/**
 * Input for YouTube to Notion Agent
 * Minimal input - agent does all the heavy lifting
 */
export interface YouTubeToNotionInput {
    /** YouTube video URL */
    youtubeUrl: string;

    /** Video title from page */
    videoTitle: string;

    /** Optional: Parent page ID to nest notes under */
    parentPageId?: string;
}

/**
 * Output from YouTube to Notion Agent
 * Compact response back to main workflow
 */
export interface YouTubeToNotionOutput {
    /** Whether the operation succeeded */
    success: boolean;

    /** URL of the main Notion page created */
    mainPageUrl?: string;

    /** Number of pages created (including main page) */
    pageCount?: number;

    /** Detected video type */
    videoType?: VideoType;

    /** Success or error message */
    message: string;

    /** Error details if operation failed */
    error?: string;

    /** Optional: URLs of child pages created (Phase 1+) */
    childPageUrls?: string[];
}

/**
 * Structured notes generated from video
 * Internal format used by the agent
 */
export interface StructuredVideoNotes {
    /** Detected video type */
    videoType: VideoType;

    /** Main page title */
    mainPageTitle: string;

    /** Video URL */
    videoUrl: string;

    /** Array of nested pages */
    nestedPages: NestedPage[];
}

/**
 * A single nested page in the notes structure
 */
export interface NestedPage {
    /** Page title (question or topic) */
    title: string;

    /** Page content (detailed answer or explanation) */
    content: string;
}

/**
 * Video notes template definition
 * Defines how to structure notes for each video type
 */
export interface VideoNotesTemplate {
    /** Type of video */
    type: VideoType;

    /** Human-readable name */
    name: string;

    /** Description of the template */
    description: string;

    /** Format style */
    format: NoteFormat;

    /** Guidelines for section creation */
    sectionGuidelines: {
        /** Minimum number of sections */
        minSections: number;

        /** Maximum number of sections */
        maxSections: number;

        /** Types of sections to create */
        sectionTypes: string[];
    };

    /** Example titles for this template */
    exampleTitles: string[];
}

/**
 * Video type detection result with metadata
 */
export interface VideoTypeDetectionResult {
    /** Detected video type */
    videoType: VideoType;

    /** Confidence score (0.0 - 1.0) */
    confidence: number;

    /** Reasoning for detection */
    reasoning: string;

    /** Alternative types considered */
    alternatives?: Array<{
        type: VideoType;
        confidence: number;
    }>;
}
