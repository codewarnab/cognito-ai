'use client';

import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

export interface CodeExecuteIconHandle {
    startAnimation: () => void;
    stopAnimation: () => void;
}

interface CodeExecuteIconProps extends HTMLAttributes<HTMLDivElement> {
    size?: number;
}

const CodeExecuteIcon = forwardRef<CodeExecuteIconHandle, CodeExecuteIconProps>(
    ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
        const controls = useAnimation();
        const playControls = useAnimation();
        const isControlledRef = useRef(false);

        useImperativeHandle(ref, () => {
            isControlledRef.current = true;

            return {
                startAnimation: async () => {
                    await controls.start('animate');
                    await playControls.start('play');
                },
                stopAnimation: () => {
                    controls.start('normal');
                    playControls.start('normal');
                },
            };
        });

        const handleMouseEnter = useCallback(
            async (e: React.MouseEvent<HTMLDivElement>) => {
                if (!isControlledRef.current) {
                    await controls.start('animate');
                    await playControls.start('play');
                } else {
                    onMouseEnter?.(e);
                }
            },
            [controls, playControls, onMouseEnter]
        );

        const handleMouseLeave = useCallback(
            (e: React.MouseEvent<HTMLDivElement>) => {
                if (!isControlledRef.current) {
                    controls.start('normal');
                    playControls.start('normal');
                } else {
                    onMouseLeave?.(e);
                }
            },
            [controls, playControls, onMouseLeave]
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
                    {/* Code brackets */}
                    <motion.path
                        d="M16 18l6-6-6-6"
                        variants={{
                            normal: { translateX: '0%', opacity: 1 },
                            animate: { translateX: '4px', opacity: 0.7 },
                        }}
                        animate={controls}
                        transition={{ duration: 0.3 }}
                    />
                    <motion.path
                        d="M8 6L2 12l6 6"
                        variants={{
                            normal: { translateX: '0%', opacity: 1 },
                            animate: { translateX: '-4px', opacity: 0.7 },
                        }}
                        animate={controls}
                        transition={{ duration: 0.3 }}
                    />

                    {/* Play/Execute arrow in the middle */}
                    <motion.polygon
                        points="11,8 11,16 17,12"
                        fill="currentColor"
                        stroke="none"
                        variants={{
                            normal: { scale: 1, opacity: 0.8 },
                            play: {
                                scale: [1, 1.3, 1],
                                opacity: [0.8, 1, 0.8],
                            },
                        }}
                        animate={playControls}
                        transition={{
                            duration: 0.6,
                            times: [0, 0.5, 1],
                        }}
                    />
                </svg>
            </div>
        );
    }
);

CodeExecuteIcon.displayName = 'CodeExecuteIcon';

export { CodeExecuteIcon };
