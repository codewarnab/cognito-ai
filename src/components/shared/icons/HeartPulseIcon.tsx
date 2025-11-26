import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '@/utils/ui';

interface HeartPulseIconProps extends HTMLAttributes<HTMLDivElement> {
    size?: number;
}

/**
 * HeartPulse/Activity icon for health check indicators
 * Based on lucide icon pattern (path: M22 12h-4l-3 9L9 3l-3 9H2)
 */
const HeartPulseIcon = forwardRef<HTMLDivElement, HeartPulseIconProps>(
    ({ className, size = 16, ...props }, ref) => {
        return (
            <div ref={ref} className={cn(className)} {...props}>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width={size}
                    height={size}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
            </div>
        );
    }
);

HeartPulseIcon.displayName = 'HeartPulseIcon';

export { HeartPulseIcon };
