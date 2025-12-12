/**
 * ChainOfThoughtStep Component
 * 
 * Individual progress step with status indicator
 */

import { memo, type ComponentProps, type ReactNode, type ElementType } from 'react';
import { CheckCircle2, Circle, XCircle, Loader2 } from 'lucide-react';

export type ChainOfThoughtStepProps = ComponentProps<'div'> & {
    icon?: ElementType;
    label: ReactNode;
    description?: ReactNode;
    status?: 'complete' | 'active' | 'pending' | 'error';
};

export const ChainOfThoughtStep = memo(({
    className = '',
    icon: Icon,
    label,
    description,
    status = 'complete',
    children,
    ...props
}: ChainOfThoughtStepProps) => {
    // Icon selection based on status
    const StatusIcon = Icon ?? (
        status === 'complete' ? CheckCircle2 :
            status === 'active' ? Loader2 :
                status === 'error' ? XCircle :
                    Circle
    );

    return (
        <div
            className={`flex gap-2 text-[14px] my-2 animate-in slide-in-from-top-1 duration-300 fade-in group ${className}`}
            {...props}
        >
            <div className="relative mt-[2px] shrink-0">
                <StatusIcon
                    className={`w-4 h-4 block bg-transparent fill-none stroke-current
                        ${status === 'active' ? 'text-[var(--blue-stride)] animate-spin' : ''}
                        ${status === 'complete' ? 'text-[var(--color-success)]' : ''}
                        ${status === 'error' ? 'text-[var(--color-error)]' : ''}
                        ${status === 'pending' ? 'text-[var(--text-quaternary)]' : ''}
                    `}
                    size={10}
                />
                {/* Connector line - hidden on last child via group-last equivalent, wait no, last child handling needs conditional or class logic */}
                <div className="absolute top-6 left-2 -bottom-4 w-[1px] bg-[var(--border-color)] -translate-x-1/2 group-last:hidden" />
            </div>
            <div className={`flex-1 min-w-0 pt-[1px] ${status === 'pending' ? 'opacity-50' : ''}`}>
                <div className="text-[14px] font-normal leading-[1.4] text-[var(--text-primary)]">{label}</div>
                {description && (
                    <div className="text-[12px] text-[var(--text-tertiary)] mt-[2px] leading-[1.3]">{description}</div>
                )}
                {children}
            </div>
        </div>
    );
});

ChainOfThoughtStep.displayName = 'ChainOfThoughtStep';
