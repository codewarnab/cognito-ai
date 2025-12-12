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
            className={`inline-flex items-center gap-1 px-2 py-[2px] rounded-[var(--radius-sm)] text-[11px] font-medium leading-[1.5] mt-1
                ${variant === 'default' ? 'bg-transparent text-[var(--text-primary)] border border-[var(--border-color)]' : ''}
                ${variant === 'secondary' ? 'bg-transparent text-[var(--text-secondary)] border border-[var(--border-color)]' : ''}
                ${variant === 'success' ? 'bg-[rgba(76,175,80,0.15)] text-[var(--color-success)] border border-[var(--color-success)]' : ''}
                ${variant === 'error' ? 'bg-[rgba(244,67,54,0.15)] text-[var(--color-error)] border border-[var(--color-error)]' : ''}
                ${variant === 'info' ? 'bg-[rgba(18,100,255,0.15)] text-[var(--blue-stride)] border border-[var(--blue-stride)]' : ''}
                ${className}`}
            {...props}
        >
            {children}
        </span>
    );
});

ChainOfThoughtBadge.displayName = 'ChainOfThoughtBadge';
