/**
 * FaviconImage - A favicon component with fallback size support
 * 
 * Tries multiple favicon sizes when one fails:
 * 1. First tries the specified size (default 32)
 * 2. Falls back to smaller size (16)
 * 3. Falls back to original favicon.ico if Google service fails
 * 4. Shows fallback icon or hides if all fail
 */

import { useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';

export interface FaviconImageProps {
    /** URL of the page/domain to get favicon for */
    url?: string;
    /** Direct favicon URL (skips Google service) */
    faviconUrl?: string;
    /** Domain name (alternative to url) */
    domain?: string;
    /** Size of the favicon image */
    size?: number;
    /** CSS class name */
    className?: string;
    /** Alt text */
    alt?: string;
    /** Fallback element to show when all favicon sources fail */
    fallback?: ReactNode;
    /** Callback when all favicon sources fail */
    onAllFailed?: () => void;
}

// Available sizes for Google's favicon service (common sizes that work)
const FALLBACK_SIZES = [32, 16, 64, 128];

/**
 * Get Google favicon service URL for a domain
 */
function getGoogleFaviconUrl(domain: string, size: number): string {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string | null {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch {
        return null;
    }
}

export const FaviconImage: React.FC<FaviconImageProps> = ({
    url,
    faviconUrl,
    domain,
    size = 16,
    className = '',
    alt = '',
    fallback,
    onAllFailed,
}) => {
    const [currentSizeIndex, setCurrentSizeIndex] = useState(0);
    const [useDirectFavicon, setUseDirectFavicon] = useState(!!faviconUrl);
    const [failed, setFailed] = useState(false);
    const attemptedSizes = useRef<Set<number>>(new Set());

    // Determine the domain to use
    const resolvedDomain = domain || (url ? extractDomain(url) : null);

    // Get the sizes to try, starting with the preferred size
    const sizesToTry = [size, ...FALLBACK_SIZES.filter(s => s !== size)];

    const getCurrentFaviconUrl = useCallback((): string | null => {
        // If using direct favicon URL
        if (useDirectFavicon && faviconUrl) {
            return faviconUrl;
        }

        // If we have a domain, use Google's service with current size
        if (resolvedDomain && currentSizeIndex < sizesToTry.length) {
            const currentSize = sizesToTry[currentSizeIndex];
            if (currentSize !== undefined) {
                return getGoogleFaviconUrl(resolvedDomain, currentSize);
            }
        }

        return null;
    }, [useDirectFavicon, faviconUrl, resolvedDomain, currentSizeIndex, sizesToTry]);

    const handleError = useCallback(() => {
        // If we were trying direct favicon, switch to Google service
        if (useDirectFavicon) {
            setUseDirectFavicon(false);
            setCurrentSizeIndex(0);
            attemptedSizes.current.clear();
            return;
        }

        // Try next size
        const currentSize = sizesToTry[currentSizeIndex];
        if (currentSize !== undefined) {
            attemptedSizes.current.add(currentSize);
        }

        if (currentSizeIndex < sizesToTry.length - 1) {
            setCurrentSizeIndex(prev => prev + 1);
        } else {
            // All sizes failed
            setFailed(true);
            onAllFailed?.();
        }
    }, [useDirectFavicon, currentSizeIndex, sizesToTry, onAllFailed]);

    const currentUrl = getCurrentFaviconUrl();

    // If failed or no URL, show fallback
    if (failed || !currentUrl) {
        if (fallback) {
            return <>{fallback}</>;
        }
        return null;
    }

    return (
        <img
            src={currentUrl}
            alt={alt}
            className={className}
            style={{ width: size, height: size }}
            onError={handleError}
        />
    );
};

export default FaviconImage;
