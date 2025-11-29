/**
 * Search Results Image Section Component
 * Displays search result images in a compact grid with lightbox preview.
 * Optimized for sidepanel width.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import type { SearchResultImage } from '@/search/types';
import '@/styles/features/search/search-images.css';

export interface SearchResultsImageSectionProps {
    /** Array of image results */
    images: SearchResultImage[];
    /** Original search query for alt text */
    query?: string;
    /** Maximum images to show in preview */
    maxPreview?: number;
}

interface NormalizedImage {
    url: string;
    description: string;
}

export const SearchResultsImageSection: React.FC<SearchResultsImageSectionProps> = ({
    images,
    query = '',
    maxPreview = 4,
}) => {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    const normalizedImages: NormalizedImage[] = images
        .map((img) => {
            if (typeof img === 'string') {
                return { url: img, description: '' };
            }
            return { url: img.url, description: img.description || '' };
        })
        .filter((img) => img.url && img.url.length > 0);

    const goToNext = useCallback(() => {
        if (selectedIndex !== null) {
            setSelectedIndex((selectedIndex + 1) % normalizedImages.length);
        }
    }, [selectedIndex, normalizedImages.length]);

    const goToPrev = useCallback(() => {
        if (selectedIndex !== null) {
            setSelectedIndex((selectedIndex - 1 + normalizedImages.length) % normalizedImages.length);
        }
    }, [selectedIndex, normalizedImages.length]);

    const closeLightbox = useCallback(() => {
        setSelectedIndex(null);
    }, []);

    useEffect(() => {
        if (selectedIndex === null) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') goToNext();
            if (e.key === 'ArrowLeft') goToPrev();
            if (e.key === 'Escape') closeLightbox();
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [selectedIndex, goToNext, goToPrev, closeLightbox]);

    if (normalizedImages.length === 0) {
        return null;
    }

    const previewImages = normalizedImages.slice(0, maxPreview);
    const remainingCount = normalizedImages.length - maxPreview;

    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ccc"><rect width="24" height="24"/></svg>';
    };

    return (
        <>
            <div className="search-images__grid">
                {previewImages.map((image, index) => (
                    <button
                        key={`${image.url}-${index}`}
                        type="button"
                        onClick={() => setSelectedIndex(index)}
                        aria-label={`View image ${index + 1}${image.description ? `: ${image.description}` : ''}`}
                        className="search-images__item"
                    >
                        <img
                            src={image.url}
                            alt={image.description || `Search result ${index + 1} for ${query}`}
                            loading="lazy"
                            onError={handleImageError}
                        />
                        
                        <div className="search-images__zoom-overlay">
                            <ZoomIn size={16} />
                        </div>

                        {index === maxPreview - 1 && remainingCount > 0 && (
                            <div className="search-images__more-overlay">
                                +{remainingCount}
                            </div>
                        )}
                    </button>
                ))}
            </div>

            {selectedIndex !== null && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Image viewer"
                    className="search-images__lightbox"
                    onClick={closeLightbox}
                >
                    <button
                        type="button"
                        onClick={closeLightbox}
                        aria-label="Close image viewer"
                        className="search-images__lightbox-close"
                    >
                        <X size={20} />
                    </button>

                    {normalizedImages.length > 1 && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); goToPrev(); }}
                            aria-label="Previous image"
                            className="search-images__lightbox-nav search-images__lightbox-nav--prev"
                        >
                            <ChevronLeft size={24} />
                        </button>
                    )}

                    <div
                        className="search-images__lightbox-content"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {(() => {
                            const currentImage = normalizedImages[selectedIndex];
                            if (!currentImage) return null;
                            return (
                                <>
                                    <img
                                        src={currentImage.url}
                                        alt={currentImage.description || `Image ${selectedIndex + 1}`}
                                    />
                                    {currentImage.description && (
                                        <div className="search-images__lightbox-description">
                                            {currentImage.description}
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                        <div className="search-images__lightbox-counter">
                            {selectedIndex + 1} / {normalizedImages.length}
                        </div>
                    </div>

                    {normalizedImages.length > 1 && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); goToNext(); }}
                            aria-label="Next image"
                            className="search-images__lightbox-nav search-images__lightbox-nav--next"
                        >
                            <ChevronRight size={24} />
                        </button>
                    )}
                </div>
            )}
        </>
    );
};

export default SearchResultsImageSection;
