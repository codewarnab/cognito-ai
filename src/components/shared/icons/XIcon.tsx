import React from 'react';

interface XIconProps {
    size?: number;
    color?: string;
}

export const XIcon: React.FC<XIconProps> = ({ size = 24, color = 'currentColor' }) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M18 6L6 18M6 6l12 12"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};
