import React from 'react';

interface RobotIconProps {
    size?: number;
    className?: string;
}

export const RobotIcon: React.FC<RobotIconProps> = ({ size = 48, className }) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <defs>
                <filter id="glow-empty" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>
            {/* Head */}
            <rect x="28" y="20" width="44" height="38" rx="8" fill="none" stroke="#7dd3fc" strokeWidth="2" filter="url(#glow-empty)" opacity="0.8" />
            {/* Antenna */}
            <line x1="50" y1="20" x2="50" y2="5" stroke="#7dd3fc" strokeWidth="2" filter="url(#glow-empty)" opacity="0.8" />
            <circle cx="50" cy="3" r="3" fill="#7dd3fc" filter="url(#glow-empty)" />
            {/* Left Eye */}
            <circle cx="38" cy="32" r="5" fill="#e0f2fe" filter="url(#glow-empty)" />
            <circle cx="38" cy="32" r="3" fill="#0284c7" />
            {/* Right Eye */}
            <circle cx="62" cy="32" r="5" fill="#e0f2fe" filter="url(#glow-empty)" />
            <circle cx="62" cy="32" r="3" fill="#0284c7" />
            {/* Left Ear */}
            <circle cx="20" cy="38" r="6" fill="none" stroke="#7dd3fc" strokeWidth="2" filter="url(#glow-empty)" opacity="0.8" />
            {/* Right Ear */}
            <circle cx="80" cy="38" r="6" fill="none" stroke="#7dd3fc" strokeWidth="2" filter="url(#glow-empty)" opacity="0.8" />
            {/* Body */}
            <rect x="25" y="65" width="50" height="28" rx="6" fill="none" stroke="#7dd3fc" strokeWidth="2" filter="url(#glow-empty)" opacity="0.8" />
            {/* Mouth/Display Lines */}
            <line x1="35" y1="78" x2="65" y2="78" stroke="#7dd3fc" strokeWidth="1.5" filter="url(#glow-empty)" opacity="0.8" />
            <line x1="35" y1="84" x2="65" y2="84" stroke="#7dd3fc" strokeWidth="1.5" filter="url(#glow-empty)" opacity="0.8" />
        </svg>
    );
};
