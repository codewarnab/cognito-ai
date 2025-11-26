'use client';

import type { HTMLAttributes } from 'react';
import React, {
    forwardRef,
    useCallback,
    useImperativeHandle,
    useRef,
} from 'react';
import { motion, useAnimation, type Variants } from 'framer-motion';
import { cn } from '@/utils/ui';

export interface IconHandle {
    startAnimation: () => void;
    stopAnimation: () => void;
}

interface IconProps extends HTMLAttributes<HTMLDivElement> {
    size?: number;
}

// --- Question Planner Icon ---
const QuestionPlanner = forwardRef<IconHandle, IconProps>(
    ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
        const controls = useAnimation();
        const isControlledRef = useRef(false);

        useImperativeHandle(
            ref,
            () => {
                isControlledRef.current = true;
                return {
                    startAnimation: () => controls.start('animate'),
                    stopAnimation: () => controls.start('normal'),
                };
            },
            [controls]
        );

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

        const questionVariants: Variants = {
            normal: {
                rotate: 0,
                scale: 1,
                originX: '12px',
                originY: '12px',
            },
            animate: {
                rotate: [0, -10, 10, -5, 5, 0],
                scale: [1, 1.1, 1],
                transition: {
                    duration: 0.6,
                    ease: "easeInOut",
                }
            }
        };

        return (
            <div
                className={cn("select-none", className)}
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
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                    <motion.g variants={questionVariants} animate={controls}>
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                        <path d="M12 17h.01" />
                    </motion.g>
                </svg>
            </div>
        );
    }
);
QuestionPlanner.displayName = 'QuestionPlannerIcon';

// --- Answer Writer Icon ---
const AnswerWriter = forwardRef<IconHandle, IconProps>(
    ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
        const controls = useAnimation();
        const isControlledRef = useRef(false);

        useImperativeHandle(
            ref,
            () => {
                isControlledRef.current = true;
                return {
                    startAnimation: () => controls.start('animate'),
                    stopAnimation: () => controls.start('normal'),
                };
            },
            [controls]
        );

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

        const penVariants: Variants = {
            normal: {
                x: 0,
                y: 0,
                rotate: 0,
            },
            animate: {
                x: [0, 2, -1, 0],
                y: [0, 1, -1, 0],
                rotate: [0, -5, 5, 0],
                transition: {
                    duration: 0.5,
                    ease: "easeInOut",
                    repeat: 1
                }
            }
        };

        const lineVariants: Variants = {
            normal: { pathLength: 1, opacity: 1 },
            animate: {
                pathLength: [0, 1],
                opacity: [0.5, 1],
                transition: {
                    duration: 0.4,
                    ease: "easeOut"
                }
            }
        };

        return (
            <div
                className={cn("select-none", className)}
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
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />

                    <motion.g animate={controls}>
                        <motion.path d="M8 13h6" variants={lineVariants} />
                        <motion.path d="M8 17h4" variants={{ ...lineVariants, animate: { ...lineVariants.animate, transition: { delay: 0.1, duration: 0.4 } } }} />
                    </motion.g>

                    <motion.g variants={penVariants} animate={controls}>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </motion.g>
                </svg>
            </div>
        );
    }
);
AnswerWriter.displayName = 'AnswerWriterIcon';

// --- Notion Page Writer Icon ---
const NotionPageWriter = forwardRef<IconHandle, IconProps>(
    ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
        const controls = useAnimation();
        const isControlledRef = useRef(false);

        useImperativeHandle(
            ref,
            () => {
                isControlledRef.current = true;
                return {
                    startAnimation: () => controls.start('animate'),
                    stopAnimation: () => controls.start('normal'),
                };
            },
            [controls]
        );

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

        const cubeVariants: Variants = {
            normal: {
                scale: 1,
                rotate: 0,
                originX: '12px',
                originY: '14px',
            },
            animate: {
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0],
                transition: {
                    duration: 0.5,
                    ease: "easeInOut"
                }
            }
        };

        return (
            <div
                className={cn("select-none", className)}
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
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />

                    <motion.g variants={cubeVariants} animate={controls}>
                        {/* Minimal Cube / Notion-like shape */}
                        <path d="M8 13v5l4 2 4-2v-5l-4-2-4 2z" />
                        <path d="M12 13v7" />
                        <path d="M12 13l4-2" />
                        <path d="M12 13l-4-2" />
                    </motion.g>
                </svg>
            </div>
        );
    }
);
NotionPageWriter.displayName = 'NotionPageWriterIcon';

export { QuestionPlanner, AnswerWriter, NotionPageWriter };
