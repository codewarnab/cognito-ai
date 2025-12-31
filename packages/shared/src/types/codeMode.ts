/**
 * Code Mode Element Context
 *
 * Defines the structure for DOM elements selected by the user in Code Mode.
 */

export interface CodeModeElementContext {
    /** The URL of the page where the element was selected */
    url: string;
    /** The title of the page */
    title?: string;
    /** Best-effort CSS selector for the element */
    selector?: string;
    /** The tag name of the element (lowercase) */
    tagName: string;
    /** The ID of the element, if present */
    id?: string;
    /** List of classes on the element */
    classList: string[];
    /** Truncated text content preview */
    textPreview?: string;
    /** Sanitized and truncated outerHTML preview */
    outerHtmlPreview?: string;
    /** Bounding box coordinates */
    boundingBox?: {
        top: number;
        left: number;
        width: number;
        height: number;
    };
}
