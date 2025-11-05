import React from 'react';

interface StopIconProps {
    size?: number;
    className?: string;
}

export const StopIcon: React.FC<StopIconProps> = ({ size = 16, className }) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="currentColor"
            className={className}
        >
            <rect x="5" y="5" width="14" height="14" rx="2"></rect>
        </svg>
    );
};
