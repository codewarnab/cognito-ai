'use client';

import { motion, useAnimation } from 'framer-motion';
import type { Variants } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

export interface LaptopMinimalCheckIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface LaptopMinimalCheckIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  className?: string;
}

const checkVariants: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
  animate: {
    pathLength: [0, 1],
    opacity: [0, 1],
    transition: {
      pathLength: { duration: 0.25, ease: 'easeOut' },
      opacity: { duration: 0.25, ease: 'easeOut' },
    },
  },
};

const LaptopMinimalCheckIcon = forwardRef<
  LaptopMinimalCheckIconHandle,
  LaptopMinimalCheckIconProps
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
      style={{ display: 'inline-flex', pointerEvents: 'none' }}
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
        <path d="M2 20h20" />
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <motion.path
          animate={controls}
          initial="normal"
          variants={checkVariants}
          d="m9 10 2 2 4-4"
          style={{ transformOrigin: 'center' }}
        />
      </svg>
    </div>
  );
});

LaptopMinimalCheckIcon.displayName = 'LaptopMinimalCheckIcon';

export { LaptopMinimalCheckIcon };
