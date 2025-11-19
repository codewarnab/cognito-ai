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
            className={`chain-of-thought-step status-${status} ${className}`}
            {...props}
        >
            <div className="step-icon-wrapper">
                <StatusIcon
                    className={`step-icon ${status === 'active' ? 'spinning' : ''}`}
                    size={10}
                />
                <div className="step-connector" />
            </div>
            <div className="step-content-wrapper">
                <div className="step-label">{label}</div>
                {description && (
                    <div className="step-description">{description}</div>
                )}
                {children}
            </div>
        </div>
    );
});

ChainOfThoughtStep.displayName = 'ChainOfThoughtStep';
