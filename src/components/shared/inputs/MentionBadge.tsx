/**
 * Component to render mentions as styled badges
 * Converts @[Tab](id) and #[Tool](id) to clickable badges
 */

import React from 'react';

interface MentionBadgeProps {
    type: 'tab' | 'tool';
    display: string;
    id: string;
    faviconUrl?: string;
    fullTitle?: string; // For tooltip
}

export function MentionBadge({ type, display, id, faviconUrl, fullTitle }: MentionBadgeProps) {
    const handleClick = () => {
        if (type === 'tab') {
            // Switch to the mentioned tab
            const tabId = parseInt(id, 10);
            if (!isNaN(tabId) && typeof chrome !== 'undefined' && chrome.tabs) {
                chrome.tabs.update(tabId, { active: true }).catch(console.error);
            }
        }
    };
    return (
        <span
            className={`mention-badge mention-badge-${type}`}
            onClick={handleClick}
            title={type === 'tab' ? `Switch to tab: ${fullTitle || display}` : `Tool: ${display}`}
            style={{ cursor: type === 'tab' ? 'pointer' : 'default' }}
        >
            {type === 'tab' && faviconUrl && (
                <img
                    src={faviconUrl}
                    alt=""
                    className="mention-badge-favicon"
                    onError={(e) => {
                        // Hide image if it fails to load
                        e.currentTarget.style.display = 'none';
                    }}
                />
            )}
            {type === 'tab' && !faviconUrl && <span className="mention-badge-icon">🌐</span>}
            <span className="mention-badge-text">
                {type === 'tab' ? '@' : '#'}{display}
            </span>
        </span>
    );
}

/**
 * Process text to convert mention syntax to React components
 */
export function renderTextWithMentions(text: string): React.ReactNode[] {
    // Updated regex to capture display text and optional favicon URL
    const tabMentionRegex = /@\[([^|\]]+)(?:\|([^\]]*))?\]\((\d+)\)/g;
    const toolMentionRegex = /#\[([^\]]+)\]\(([^\)]+)\)/g;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;

    // Find all mentions (both tab and tool)
    const allMatches: Array<{
        index: number;
        length: number;
        type: 'tab' | 'tool';
        display: string;
        id: string;
        faviconUrl?: string;
    }> = [];

    // Find tab mentions
    let match;
    while ((match = tabMentionRegex.exec(text)) !== null) {
        allMatches.push({
            index: match.index,
            length: match[0].length,
            type: 'tab',
            display: match[1],
            faviconUrl: match[2] || undefined,
            id: match[3]
        });
    }

    // Find tool mentions
    while ((match = toolMentionRegex.exec(text)) !== null) {
        allMatches.push({
            index: match.index,
            length: match[0].length,
            type: 'tool',
            display: match[1],
            id: match[2]
        });
    }

    // Sort by index to process in order
    allMatches.sort((a, b) => a.index - b.index);

    // Build parts with mentions replaced by badges
    allMatches.forEach(mention => {
        // Add text before mention
        if (mention.index > lastIndex) {
            parts.push(text.substring(lastIndex, mention.index));
        }

        // Add mention badge
        parts.push(
            <MentionBadge
                key={`mention-${key++}`}
                type={mention.type}
                display={mention.display}
                id={mention.id}
                faviconUrl={mention.faviconUrl}
            />
        );

        lastIndex = mention.index + mention.length;
    });

    // Add remaining text
    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : [text];
}
