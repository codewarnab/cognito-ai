import React from 'react';

interface TallyProps extends React.SVGProps<SVGSVGElement> {
    className?: string;
}

export function Tally({ className, ...props }: TallyProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 100 100"
            width="24"
            height="24"
            className={className}
            {...props}
        >
            {/* Tally asterisk/flower logo */}
            <g fill="currentColor">
                {/* Top petal */}
                <ellipse cx="50" cy="22" rx="10" ry="22" />
                {/* Top-right petal - rotated 72 degrees */}
                <ellipse cx="50" cy="22" rx="10" ry="22" transform="rotate(72 50 50)" />
                {/* Bottom-right petal - rotated 144 degrees */}
                <ellipse cx="50" cy="22" rx="10" ry="22" transform="rotate(144 50 50)" />
                {/* Bottom-left petal - rotated 216 degrees */}
                <ellipse cx="50" cy="22" rx="10" ry="22" transform="rotate(216 50 50)" />
                {/* Top-left petal - rotated 288 degrees */}
                <ellipse cx="50" cy="22" rx="10" ry="22" transform="rotate(288 50 50)" />
            </g>
        </svg>
    );
}

export default Tally;
