import React from 'react';

interface GeminiCLIProps {
    className?: string;
    style?: React.CSSProperties;
}

export const GeminiCLI: React.FC<GeminiCLIProps> = ({ className, style }) => {
    return (
        <svg
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            style={style}
        >
            <defs>
                {/* Border gradient - blue to pink/red */}
                <linearGradient id="geminiCliBorderGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="50%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#EC4899" />
                </linearGradient>
                {/* Chevron gradient - blue to pink */}
                <linearGradient id="geminiCliChevronGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#38BDF8" />
                    <stop offset="50%" stopColor="#818CF8" />
                    <stop offset="100%" stopColor="#F472B6" />
                </linearGradient>
            </defs>

            {/* Outer rounded rectangle (border) */}
            <rect
                x="2"
                y="2"
                width="96"
                height="96"
                rx="20"
                ry="20"
                fill="none"
                stroke="url(#geminiCliBorderGradient)"
                strokeWidth="4"
            />

            {/* Inner dark background */}
            <rect
                x="6"
                y="6"
                width="88"
                height="88"
                rx="16"
                ry="16"
                fill="#1a1f2e"
            />

            {/* Chevron ">" shape */}
            <path
                d="M30 25 L60 50 L30 75 L38 75 L68 50 L38 25 Z"
                fill="url(#geminiCliChevronGradient)"
            />
        </svg>
    );
};

export default GeminiCLI;
