/**
 * Citation Renderer
 * Renders text with inline citations replaced by hoverable citation components
 */

import React, { useMemo } from 'react';
import { InlineCitation } from './InlineCitation';
import type { CitationSource } from '@/utils/citations';
import { parseCitations } from '@/utils/citations';

export interface CitationRendererProps {
    /** Text content that may contain citations */
    text: string;
    /** Map of URLs to citation sources */
    sources: Map<string, CitationSource>;
    /** Fallback render function for non-citation text */
    renderText?: (text: string, key: string) => React.ReactNode;
}

/**
 * Renders text with markdown-style citations replaced by InlineCitation components.
 * Citations are in format [label](url) where label can be a number or text.
 */
export const CitationRenderer: React.FC<CitationRendererProps> = ({
    text,
    sources,
    renderText = (t, key) => <span key={key}>{t}</span>,
}) => {
    const elements = useMemo(() => {
        const citations = parseCitations(text);

        if (citations.length === 0) {
            return [renderText(text, 'text-0')];
        }

        const result: React.ReactNode[] = [];
        let lastIndex = 0;

        citations.forEach((citation, index) => {
            // Add text before this citation
            if (citation.startIndex > lastIndex) {
                const beforeText = text.slice(lastIndex, citation.startIndex);
                result.push(renderText(beforeText, `text-${index}`));
            }

            // Find or create citation source
            let source = sources.get(citation.url);

            if (!source) {
                // Create a source from the citation itself
                source = {
                    number: parseInt(citation.label, 10) || index + 1,
                    title: citation.label,
                    url: citation.url,
                };
            }

            result.push(
                <InlineCitation
                    key={`citation-${index}-${citation.url}`}
                    source={source}
                />
            );

            lastIndex = citation.endIndex;
        });

        // Add remaining text after last citation
        if (lastIndex < text.length) {
            result.push(renderText(text.slice(lastIndex), `text-end`));
        }

        return result;
    }, [text, sources, renderText]);

    return <>{elements}</>;
};

export default CitationRenderer;
