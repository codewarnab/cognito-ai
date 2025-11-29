/**
 * Citation Parser
 * Utilities for parsing and extracting citations from markdown text
 */

import type { ParsedCitation, CitationSource, SearchResultForCitation } from './types';

/**
 * Regex pattern for markdown links that are citations.
 * Matches: [label](url) where label is a number or short text
 * 
 * Examples:
 * - [1](https://example.com)
 * - [Source](https://example.com)
 * - [Reuters](https://reuters.com/article)
 */
const CITATION_PATTERN = /\[([^\]]{1,50})\]\((https?:\/\/[^\s)]+)\)/g;

/**
 * Pattern specifically for numbered citations like [1], [2], etc.
 */
const NUMBERED_CITATION_PATTERN = /\[(\d{1,2})\]\((https?:\/\/[^\s)]+)\)/g;

/**
 * Parse all citations from markdown text.
 * @param text - Markdown text containing citations
 * @returns Array of parsed citations
 */
export function parseCitations(text: string): ParsedCitation[] {
    const citations: ParsedCitation[] = [];
    let match: RegExpExecArray | null;

    // Reset regex state
    CITATION_PATTERN.lastIndex = 0;

    while ((match = CITATION_PATTERN.exec(text)) !== null) {
        citations.push({
            fullMatch: match[0],
            label: match[1],
            url: match[2],
            startIndex: match.index,
            endIndex: match.index + match[0].length,
        });
    }

    return citations;
}

/**
 * Parse only numbered citations from markdown text.
 * @param text - Markdown text containing citations
 * @returns Array of parsed citations with numeric labels
 */
export function parseNumberedCitations(text: string): ParsedCitation[] {
    const citations: ParsedCitation[] = [];
    let match: RegExpExecArray | null;

    // Reset regex state
    NUMBERED_CITATION_PATTERN.lastIndex = 0;

    while ((match = NUMBERED_CITATION_PATTERN.exec(text)) !== null) {
        citations.push({
            fullMatch: match[0],
            label: match[1],
            url: match[2],
            startIndex: match.index,
            endIndex: match.index + match[0].length,
        });
    }

    return citations;
}

/**
 * Extract unique citation sources from parsed citations.
 * @param citations - Array of parsed citations
 * @param searchResults - Optional search results to enrich with titles
 * @returns Array of citation sources
 */
export function extractCitationSources(
    citations: ParsedCitation[],
    searchResults?: SearchResultForCitation[]
): CitationSource[] {
    const sourceMap = new Map<string, CitationSource>();
    let nextNumber = 1;

    for (const citation of citations) {
        // Use URL as unique key
        if (sourceMap.has(citation.url)) {
            continue;
        }

        // Try to find matching search result for title
        const matchingResult = searchResults?.find(
            (r) => r.url === citation.url || normalizeUrl(r.url) === normalizeUrl(citation.url)
        );

        const source: CitationSource = {
            number: isNumericLabel(citation.label) ? parseInt(citation.label, 10) : nextNumber,
            title: matchingResult?.title || citation.label || getDomainFromUrl(citation.url),
            url: citation.url,
            snippet: matchingResult?.content,
        };

        sourceMap.set(citation.url, source);
        nextNumber++;
    }

    return Array.from(sourceMap.values()).sort((a, b) => a.number - b.number);
}

/**
 * Check if a label is numeric.
 */
function isNumericLabel(label: string): boolean {
    return /^\d+$/.test(label);
}

/**
 * Normalize URL for comparison (remove trailing slashes, www, etc.)
 */
function normalizeUrl(url: string): string {
    try {
        const parsed = new URL(url);
        return parsed.hostname.replace('www.', '') + parsed.pathname.replace(/\/$/, '');
    } catch {
        return url;
    }
}

/**
 * Extract domain from URL for display.
 */
export function getDomainFromUrl(url: string): string {
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch {
        return url;
    }
}

/**
 * Get favicon URL for a domain using Google's favicon service.
 */
export function getFaviconUrl(url: string): string {
    try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    } catch {
        return '';
    }
}

/**
 * Build citation sources from search results.
 * Assigns numbers based on order in results.
 * @param results - Search results to convert to citation sources
 * @returns Array of citation sources
 */
export function buildCitationSourcesFromResults(
    results: SearchResultForCitation[]
): CitationSource[] {
    return results.map((result, index) => ({
        number: index + 1,
        title: result.title,
        url: result.url,
        snippet: result.content,
        favicon: getFaviconUrl(result.url),
    }));
}
