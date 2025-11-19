'use client';

import { motion, useAnimation } from 'framer-motion';
import type { Variants } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

export interface PdfIconHandle {
    startAnimation: () => void;
    stopAnimation: () => void;
}

interface PdfIconProps extends HTMLAttributes<HTMLDivElement> {
    size?: number;
}

const documentVariants: Variants = {
    normal: {
        opacity: 1,
        pathLength: 1,
        pathOffset: 0,
        transition: {
            duration: 0.4,
            opacity: { duration: 0.1 },
        },
    },
    animate: {
        opacity: [0, 1],
        pathLength: [0, 1],
        pathOffset: [1, 0],
        transition: {
            duration: 0.6,
            ease: 'linear',
            opacity: { duration: 0.1 },
        },
    },
};

const linesVariants: Variants = {
    normal: {
        opacity: 1,
        pathLength: 1,
        transition: {
            duration: 0.4,
            opacity: { duration: 0.1 },
        },
    },
    animate: {
        opacity: [0, 1],
        pathLength: [0, 1],
        transition: {
            duration: 0.5,
            ease: 'easeInOut',
            opacity: { duration: 0.1 },
            delay: 0.2,
        },
    },
};

const PdfIcon = forwardRef<PdfIconHandle, PdfIconProps>(
    ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
        const documentControls = useAnimation();
        const linesControls = useAnimation();
        const isControlledRef = useRef(false);

        useImperativeHandle(ref, () => {
            isControlledRef.current = true;

            return {
                startAnimation: () => {
                    documentControls.start('animate');
                    linesControls.start('animate');
                },
                stopAnimation: () => {
                    documentControls.start('normal');
                    linesControls.start('normal');
                },
            };
        });

        const handleMouseEnter = useCallback(
            (e: React.MouseEvent<HTMLDivElement>) => {
                if (!isControlledRef.current) {
                    documentControls.start('animate');
                    linesControls.start('animate');
                } else {
                    onMouseEnter?.(e);
                }
            },
            [onMouseEnter, documentControls, linesControls]
        );

        const handleMouseLeave = useCallback(
            (e: React.MouseEvent<HTMLDivElement>) => {
                if (!isControlledRef.current) {
                    documentControls.start('normal');
                    linesControls.start('normal');
                } else {
                    onMouseLeave?.(e);
                }
            },
            [documentControls, linesControls, onMouseLeave]
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
                    {/* Document outline */}
                    <motion.path
                        variants={documentVariants}
                        initial="normal"
                        animate={documentControls}
                        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                    />
                    {/* Folded corner */}
                    <motion.path
                        variants={documentVariants}
                        initial="normal"
                        animate={documentControls}
                        d="M14 2v6h6"
                    />
                    {/* Text lines inside document */}
                    <motion.path
                        variants={linesVariants}
                        initial="normal"
                        animate={linesControls}
                        d="M8 13h8"
                    />
                    <motion.path
                        variants={linesVariants}
                        initial="normal"
                        animate={linesControls}
                        d="M8 17h8"
                    />
                    <motion.path
                        variants={linesVariants}
                        initial="normal"
                        animate={linesControls}
                        d="M8 9h2"
                    />
                </svg>
            </div>
        );
    }
);

PdfIcon.displayName = 'PdfIcon';

export { PdfIcon };
