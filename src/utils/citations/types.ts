/**
 * Citation Types
 * Type definitions for inline citation system
 */

/** Parsed citation from markdown text */
export interface ParsedCitation {
    /** Full match string (e.g., "[1](https://example.com)") */
    fullMatch: string;
    /** Citation number or text label */
    label: string;
    /** Source URL */
    url: string;
    /** Start index in original text */
    startIndex: number;
    /** End index in original text */
    endIndex: number;
}

/** Citation source with metadata */
export interface CitationSource {
    /** Citation number (1, 2, 3...) */
    number: number;
    /** Source title */
    title: string;
    /** Source URL */
    url: string;
    /** Optional favicon URL */
    favicon?: string;
    /** Optional content snippet */
    snippet?: string;
}

/** Citation context for a message */
export interface CitationContext {
    /** Map of citation number to source */
    sources: Map<number, CitationSource>;
    /** Original search results that generated these citations */
    searchResults?: SearchResultForCitation[];
}

/** Minimal search result for citation mapping */
export interface SearchResultForCitation {
    title: string;
    url: string;
    content?: string;
}
