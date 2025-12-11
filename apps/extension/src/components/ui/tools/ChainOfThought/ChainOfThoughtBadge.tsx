/**
 * ChainOfThoughtBadge Component
 * 
 * Badge for displaying labels, counts, or status indicators
 */

import { memo, type ComponentProps, type ReactNode } from 'react';

export type ChainOfThoughtBadgeProps = ComponentProps<'span'> & {
    variant?: 'default' | 'secondary' | 'success' | 'error' | 'info';
    children: ReactNode;
};

export const ChainOfThoughtBadge = memo(({
    className = '',
    variant = 'secondary',
    children,
    ...props
}: ChainOfThoughtBadgeProps) => {
    return (
        <span
            className={`chain-of-thought-badge badge-${variant} ${className}`}
            {...props}
        >
            {children}
        </span>
    );
});

ChainOfThoughtBadge.displayName = 'ChainOfThoughtBadge';
