import React, { forwardRef, useImperativeHandle, useState } from 'react';

interface PaperclipIconProps {
    size?: number;
    style?: React.CSSProperties;
}

export interface PaperclipIconHandle {
    startAnimation: () => void;
    stopAnimation: () => void;
}

export const PaperclipIcon = forwardRef<PaperclipIconHandle, PaperclipIconProps>(
    ({ size = 20, style }, ref) => {
        const [isAnimating, setIsAnimating] = useState(false);

        useImperativeHandle(ref, () => ({
            startAnimation: () => setIsAnimating(true),
            stopAnimation: () => setIsAnimating(false),
        }));

        return (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                    ...style,
                    transition: 'transform 0.2s ease',
                    transform: isAnimating ? 'rotate(-15deg) scale(1.1)' : 'rotate(0deg) scale(1)',
                }}
            >
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
        );
    }
);

PaperclipIcon.displayName = 'PaperclipIcon';
