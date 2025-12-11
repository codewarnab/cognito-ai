import type { Position } from './useTextSelection';

interface SummarizeButtonProps {
    position: Position;
    onClick: () => void;
}

export function SummarizeButton({ position, onClick }: SummarizeButtonProps) {
    return (
        <button
            className="summarize-button"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
            }}
            onClick={onClick}
            aria-label="Summarize selected text"
        >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
            </svg>
        </button>
    );
}
