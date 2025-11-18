/**
 * Progress Types
 * TypeScript types for YouTube to Notion progress tracking
 */

/**
 * Progress update structure
 */
export interface ProgressUpdate {
    /** Unique identifier */
    id: string;

    /** User-friendly short title (max 80 chars) */
    title: string;

    /** Current status */
    status: 'pending' | 'active' | 'complete' | 'error';

    /** Update type for styling/icons */
    type?: 'page-created' | 'analysis' | 'planning' | 'info' | 'error';

    /** Unix timestamp (ms) */
    timestamp: number;

    /** Optional structured data */
    data?: {
        url?: string;           // Notion page URL
        videoType?: string;     // Detected video type
        confidence?: number;    // Detection confidence (0-1)
        count?: number;         // Item count
        error?: string;         // Error message
        [key: string]: any;     // Flexible for future needs
    };
}

/**
 * Progress listener callback type
 */
export type ProgressListener = (update: ProgressUpdate) => void;
