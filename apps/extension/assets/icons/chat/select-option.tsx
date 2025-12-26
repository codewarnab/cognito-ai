
import type { Variants } from 'motion/react';
import { motion, useAnimation } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

export interface SelectOptionIconHandle {
    startAnimation: () => void;
    stopAnimation: () => void;
}

interface SelectOptionIconProps extends HTMLAttributes<HTMLDivElement> {
    size?: number;
}

const checkVariants: Variants = {
    initial: { pathLength: 1, opacity: 1 },
    animate: {
        pathLength: [0, 1],
        opacity: [0, 1],
        transition: {
            duration: 0.5,
            ease: "easeInOut"
        }
    }
};

const linesVariants: Variants = {
    initial: { opacity: 1 },
    animate: { opacity: 1 }
};

const SelectOptionIcon = forwardRef<SelectOptionIconHandle, SelectOptionIconProps>(
    ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
        const controls = useAnimation();
        const isControlledRef = useRef(false);

        useImperativeHandle(ref, () => {
            isControlledRef.current = true;
            return {
                startAnimation: () => controls.start('animate'),
                stopAnimation: () => controls.start('initial'),
            };
        });

        const handleMouseEnter = useCallback(
            (e: React.MouseEvent<HTMLDivElement>) => {
                if (!isControlledRef.current) {
                    controls.start('animate');
                } else {
                    onMouseEnter?.(e);
                }
            },
            [controls, onMouseEnter]
        );

        const handleMouseLeave = useCallback(
            (e: React.MouseEvent<HTMLDivElement>) => {
                if (!isControlledRef.current) {
                    controls.start('initial');
                } else {
                    onMouseLeave?.(e);
                }
            },
            [controls, onMouseLeave]
        );

        return (
            <div
                className={className}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                {...props}
            >
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
                    <path d="M3 6h18" />
                    <path d="M3 18h18" />
                    <path d="M3 12h8" />
                    <motion.path
                        d="M15 10l2 2 4-4"
                        variants={checkVariants}
                        animate={controls}
                    />
                </svg>
            </div>
        );
    }
);

SelectOptionIcon.displayName = 'SelectOptionIcon';

export { SelectOptionIcon };
