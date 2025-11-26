/**
 * Writing Animation Component
 * Displays a bouncing dots animation while generating content
 */

interface WritingAnimationProps {
    className?: string;
}

export function WritingAnimation({ className = '' }: WritingAnimationProps) {
    return (
        <div className={`writing-animation ${className}`}>
            <span className="writing-animation-dot" />
            <span className="writing-animation-dot" />
            <span className="writing-animation-dot" />
        </div>
    );
}
