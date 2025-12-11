'use client';

import type { Variants } from 'framer-motion';
import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

export interface FilePlusIconHandle {
    startAnimation: () => void;
    stopAnimation: () => void;
}

interface FilePlusIconProps extends HTMLAttributes<HTMLDivElement> {
    size?: number;
}

const PAGE_VARIANTS: Variants = {
    normal: { y: 0 },
    animate: {
        y: [-1, 0],
        transition: {
            type: 'spring',
            stiffness: 200,
            damping: 10,
            mass: 1,
        },
    },
};

const PLUS_VARIANTS: Variants = {
    normal: { scale: 1, opacity: 1 },
    animate: {
        scale: [1, 1.3, 1],
        opacity: [1, 0.7, 1],
        transition: {
            duration: 0.4,
            ease: 'easeInOut',
        },
    },
};

const FilePlusIcon = forwardRef<FilePlusIconHandle, FilePlusIconProps>(
    ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
        const controls = useAnimation();
        const isControlledRef = useRef(false);

        useImperativeHandle(ref, () => {
            isControlledRef.current = true;

            return {
                startAnimation: () => controls.start('animate'),
                stopAnimation: () => controls.start('normal'),
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
                    controls.start('normal');
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
                    {/* Document shape */}
                    <motion.path
                        d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"
                        variants={PAGE_VARIANTS}
                        animate={controls}
                    />
                    <motion.path
                        d="M14 2v4a2 2 0 0 0 2 2h4"
                        variants={PAGE_VARIANTS}
                        animate={controls}
                    />
                    {/* Plus sign */}
                    <motion.g variants={PLUS_VARIANTS} animate={controls}>
                        <path d="M9 15h6" />
                        <path d="M12 12v6" />
                    </motion.g>
                </svg>
            </div>
        );
    }
);

FilePlusIcon.displayName = 'FilePlusIcon';

export { FilePlusIcon };
