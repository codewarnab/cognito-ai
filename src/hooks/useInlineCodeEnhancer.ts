import { useEffect, useCallback, useRef } from 'react';
import { createLogger } from '~logger';

const log = createLogger('InlineCodeEnhancer');

/**
 * URL detection regex pattern
 * Matches http:// and https:// URLs
 */
const URL_PATTERN = /^https?:\/\//i;

/**
 * Shortens a URL for display
 * Example: https://www.google.com/search?q=test → google.com/search
 */
function shortenUrl(url: string): string {
    try {
        const parsed = new URL(url);
        // Remove 'www.' prefix
        const hostname = parsed.hostname.replace(/^www\./, '');
        // Get path without trailing slash
        const path = parsed.pathname === '/' ? '' : parsed.pathname;
        // Truncate if too long
        const shortened = `${hostname}${path}`;
        return shortened.length > 50 ? shortened.substring(0, 47) + '...' : shortened;
    } catch {
        return url;
    }
}

/**
 * Creates the enhanced inline code element with link/copy functionality
 */
function enhanceInlineCode(codeElement: HTMLElement): void {
    // Skip if already enhanced
    if (codeElement.dataset.enhanced === 'true') {
        return;
    }

    const content = codeElement.textContent || '';
    const isUrl = URL_PATTERN.test(content);

    // Mark as enhanced
    codeElement.dataset.enhanced = 'true';

    // Add appropriate classes
    codeElement.classList.add('inline-code-clickable');
    if (isUrl) {
        codeElement.classList.add('inline-code-link');
        // Store original URL and show shortened version
        codeElement.dataset.originalUrl = content;
        codeElement.textContent = shortenUrl(content);
        codeElement.title = content; // Full URL on hover
    }

    // Make it interactive
    codeElement.setAttribute('role', 'button');
    codeElement.setAttribute('tabindex', '0');

    // Create wrapper for tooltip positioning
    const wrapper = document.createElement('span');
    wrapper.className = 'inline-code-wrapper';

    // Move code element into wrapper
    codeElement.parentNode?.insertBefore(wrapper, codeElement);
    wrapper.appendChild(codeElement);

    // Create tooltip element
    const tooltip = document.createElement('span');
    tooltip.className = 'inline-code-tooltip';
    tooltip.textContent = isUrl ? 'Click to open' : 'Click to copy';
    tooltip.style.display = 'none';
    wrapper.appendChild(tooltip);

    // Tooltip show/hide handlers
    wrapper.addEventListener('mouseenter', () => {
        tooltip.style.display = 'block';
        // Trigger animation by setting opacity after a frame
        requestAnimationFrame(() => {
            tooltip.style.opacity = '1';
            tooltip.style.transform = 'translateX(-50%) translateY(0)';
        });
    });

    wrapper.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
        tooltip.style.transform = 'translateX(-50%) translateY(4px)';
        setTimeout(() => {
            tooltip.style.display = 'none';
        }, 150);
    });

    // Click handler
    const handleClick = async (e: Event) => {
        e.preventDefault();
        e.stopPropagation();

        if (isUrl) {
            // Open URL in new tab
            const url = codeElement.dataset.originalUrl || content;
            window.open(url, '_blank', 'noopener,noreferrer');
        } else {
            // Copy to clipboard
            try {
                await navigator.clipboard.writeText(content);
                // Show success feedback
                tooltip.textContent = '✓ Copied!';
                tooltip.classList.add('inline-code-tooltip-success');
                tooltip.style.display = 'block';
                tooltip.style.opacity = '1';

                // Reset after delay
                setTimeout(() => {
                    tooltip.textContent = 'Click to copy';
                    tooltip.classList.remove('inline-code-tooltip-success');
                }, 2000);
            } catch (err) {
                log.error('Failed to copy code:', err);
            }
        }
    };

    codeElement.addEventListener('click', handleClick);
    codeElement.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick(e);
        }
    });
}

/**
 * Hook to enhance inline code elements rendered by Streamdown
 * 
 * This hook uses MutationObserver to detect when new inline code elements
 * are rendered and automatically enhances them with:
 * - URL detection and auto-open on click
 * - Copy-to-clipboard for non-URL content
 * - Animated tooltips
 * - Shortened URL display
 * 
 * @param containerRef - Ref to the container element to observe
 * @param isStreaming - Whether content is currently streaming (delays processing)
 */
export function useInlineCodeEnhancer(
    containerRef: React.RefObject<HTMLElement | null>,
    isStreaming: boolean
): void {
    const observerRef = useRef<MutationObserver | null>(null);
    const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const processInlineCodes = useCallback(() => {
        if (!containerRef.current) return;

        // Find all inline code elements that haven't been enhanced
        // Streamdown uses [data-streamdown-code] for inline code
        // Exclude code blocks (inside [data-streamdown-pre])
        const inlineCodes = containerRef.current.querySelectorAll<HTMLElement>(
            '[data-streamdown-code]:not([data-streamdown-pre] [data-streamdown-code]):not([data-enhanced="true"])'
        );

        if (inlineCodes.length > 0) {
            log.debug(`Enhancing ${inlineCodes.length} inline code elements`);
            inlineCodes.forEach(enhanceInlineCode);
        }
    }, [containerRef]);

    useEffect(() => {
        // Don't process while streaming to avoid flickering
        // Process after streaming stops
        if (isStreaming) {
            // Clear any pending timeout
            if (processingTimeoutRef.current) {
                clearTimeout(processingTimeoutRef.current);
            }
            return;
        }

        // Process existing elements after streaming stops
        processingTimeoutRef.current = setTimeout(() => {
            processInlineCodes();
        }, 100);

        // Setup MutationObserver to catch dynamically added content
        if (containerRef.current && !observerRef.current) {
            observerRef.current = new MutationObserver((mutations) => {
                let hasNewCodes = false;

                for (const mutation of mutations) {
                    if (mutation.type === 'childList') {
                        for (const node of mutation.addedNodes) {
                            if (node instanceof HTMLElement) {
                                // Check if node or its children contain inline code
                                if (node.matches?.('[data-streamdown-code]') ||
                                    node.querySelector?.('[data-streamdown-code]')) {
                                    hasNewCodes = true;
                                    break;
                                }
                            }
                        }
                    }
                }

                if (hasNewCodes) {
                    // Debounce processing
                    if (processingTimeoutRef.current) {
                        clearTimeout(processingTimeoutRef.current);
                    }
                    processingTimeoutRef.current = setTimeout(processInlineCodes, 50);
                }
            });

            observerRef.current.observe(containerRef.current, {
                childList: true,
                subtree: true,
            });
        }

        return () => {
            if (processingTimeoutRef.current) {
                clearTimeout(processingTimeoutRef.current);
            }
            if (observerRef.current) {
                observerRef.current.disconnect();
                observerRef.current = null;
            }
        };
    }, [isStreaming, processInlineCodes, containerRef]);
}
