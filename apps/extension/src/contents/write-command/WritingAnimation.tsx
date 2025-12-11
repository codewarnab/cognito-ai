/**
 * Writing Animation Component
 * Displays a skeleton loading animation while generating content
 */

interface WritingAnimationProps {
    className?: string;
}

export function WritingAnimation({ className = '' }: WritingAnimationProps) {
    return (
        <div className={`writer-skeleton ${className}`}>
            <div className="writer-skeleton-line writer-skeleton-line--full" />
            <div className="writer-skeleton-line writer-skeleton-line--full" />
            <div className="writer-skeleton-line writer-skeleton-line--medium" />
            <div className="writer-skeleton-line writer-skeleton-line--short" />
        </div>
    );
}
