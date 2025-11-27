'use client';

import type { Variants } from 'framer-motion';
import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

export interface SupermemoryIconHandle {
    startAnimation: () => void;
    stopAnimation: () => void;
}

interface SupermemoryIconProps extends HTMLAttributes<HTMLDivElement> {
    size?: number;
}

const PATH_VARIANTS: Variants = {
    normal: {
        scale: 1,
        opacity: 1
    },
    animate: {
        scale: [1, 1.05, 1],
        opacity: [1, 0.8, 1],
        transition: {
            duration: 0.6,
            ease: 'easeInOut',
        },
    },
};

const SupermemoryIcon = forwardRef<
    SupermemoryIconHandle,
    SupermemoryIconProps
>(({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
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
            <motion.svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 206 168"
                width={size}
                height={size}
                variants={PATH_VARIANTS}
                animate={controls}
                initial="normal"
            >
                <path
                    fill="currentColor"
                    d="M205.864 66.263h-76.401V0h-24.684v71.897c0 7.636 3.021 14.97 8.391 20.373l62.383 62.777 17.454-17.564-46.076-46.365h58.948v-24.84l-.015-.015ZM12.872 30.517l46.075 46.365H0v24.84h76.4v66.264h24.685V96.089c0-7.637-3.021-14.97-8.39-20.374l-62.37-62.762-17.453 17.564Z"
                />
            </motion.svg>
        </div>
    );
});

SupermemoryIcon.displayName = 'SupermemoryIcon';

export { SupermemoryIcon };
