'use client';

import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef, useEffect } from 'react';
import './loading-check.css';

export interface LoadingCheckIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface LoadingCheckIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  active?: boolean;
}

const LoadingCheckIcon = forwardRef<LoadingCheckIconHandle, LoadingCheckIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, active, ...props }, ref) => {
    const wormControls = useAnimation();
    const checkControls = useAnimation();
    const popStartControls = useAnimation();
    const popEndControls = useAnimation();
    const dotGroup1Controls = useAnimation();
    const dotGroup2Controls = useAnimation();
    const dotGroup3Controls = useAnimation();
    const dotGroup4Controls = useAnimation();
    const dotGroup5Controls = useAnimation();
    const dotGroup6Controls = useAnimation();
    const dotGroup7Controls = useAnimation();
    const dotGroup8Controls = useAnimation();
    const isControlledRef = useRef(false);

    useEffect(() => {
      if (isControlledRef.current || active === undefined) {
        return;
      }

      wormControls.start(active ? 'animate' : 'initial');
    }, [active, wormControls]);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;

      return {
        startAnimation: () => {
          // Only start the worm spinner animation (loop indefinitely)
          // Don't start checkmark, pop, or confetti animations
          wormControls.start('animate');
        },
        stopAnimation: () => {
          wormControls.start('initial');
          checkControls.start('initial');
          popStartControls.start('initial');
          popEndControls.start('initial');
          dotGroup1Controls.start('initial');
          dotGroup2Controls.start('initial');
          dotGroup3Controls.start('initial');
          dotGroup4Controls.start('initial');
          dotGroup5Controls.start('initial');
          dotGroup6Controls.start('initial');
          dotGroup7Controls.start('initial');
          dotGroup8Controls.start('initial');
        },
      };
    }, [wormControls, checkControls, popStartControls, popEndControls, dotGroup1Controls, dotGroup2Controls, dotGroup3Controls, dotGroup4Controls, dotGroup5Controls, dotGroup6Controls, dotGroup7Controls, dotGroup8Controls]);

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isControlledRef.current) {
          // Auto-start animation on hover (only spinner)
          wormControls.start('animate');
        } else {
          onMouseEnter?.(e);
        }
      },
      [wormControls, onMouseEnter]
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isControlledRef.current) {
          wormControls.start('initial');
        } else {
          onMouseLeave?.(e);
        }
      },
      [wormControls, onMouseLeave]
    );

    return (
      <div
        className={`loading-check-icon ${className || ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 48 48"
          fill="none"
          style={{ overflow: 'visible' }}
        >
          <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="4">
            {/* Spinning worm */}
            <motion.circle
              cx="24"
              cy="24"
              r="22"
              strokeDasharray="138.23 138.23"
              strokeDashoffset="-51.84"
              transform="rotate(-119)"
              initial="initial"
              variants={{
                initial: {
                  strokeDashoffset: -51.84,
                  rotate: -119,
                  opacity: 0,
                },
                animate: {
                  strokeDashoffset: -51.84,
                  rotate: -119 + 360,
                  opacity: 1,
                  transition: {
                    rotate: {
                      duration: 1,
                      ease: 'linear',
                      repeat: Infinity,
                    },
                    opacity: {
                      duration: 0.2,
                    },
                  },
                },
              }}
              animate={wormControls}
            />

            {/* Pop end circle */}
            <motion.circle
              cx="24"
              cy="24"
              r="18"
              stroke="var(--light-green)"
              opacity={0}
              variants={{
                initial: {
                  opacity: 0,
                  r: 18,
                  strokeWidth: 4,
                },
                animate: {
                  opacity: [0, 1, 0],
                  r: [18, 18, 19],
                  strokeWidth: [4, 4, 3],
                  transition: {
                    duration: 4,
                    times: [0, 0.825, 0.84],
                    ease: 'linear',
                  },
                },
              }}
              animate={popEndControls}
            />

            {/* Pop start circle */}
            <motion.circle
              cx="24"
              cy="24"
              r="20"
              fill="var(--light-green)"
              opacity={0}
              variants={{
                initial: {
                  opacity: 0,
                  scale: 0.35,
                },
                animate: {
                  opacity: [0, 1, 1, 0],
                  scale: [0.35, 0.35, 1, 1],
                  transition: {
                    duration: 4,
                    times: [0, 0.76, 0.825, 1],
                    ease: [0.65, 0, 0.35, 1],
                  },
                },
              }}
              animate={popStartControls}
            />

            {/* Confetti dots - Group 1 */}
            <g>
              <motion.g
                opacity={0}
                variants={{
                  initial: { opacity: 0 },
                  animate: {
                    opacity: [0, 1, 0],
                    transition: {
                      duration: 4,
                      times: [0, 0.85, 0.875],
                    },
                  },
                }}
                animate={dotGroup1Controls}
              >
                <circle fill="var(--periwinkle)" cx="22" cy="5" r="1.5" />
              </motion.g>
              <motion.g
                opacity={0}
                variants={{
                  initial: { opacity: 0 },
                  animate: {
                    opacity: [0, 1, 0],
                    transition: {
                      duration: 4,
                      times: [0, 0.85, 0.9],
                    },
                  },
                }}
                animate={dotGroup2Controls}
              >
                <circle fill="var(--light-blue)" cx="26" cy="2" r="1.5" />
              </motion.g>
            </g>

            {/* Confetti dots - Group 2 (rotated) */}
            <g transform="rotate(51.43,24,24)">
              <motion.g
                opacity={0}
                variants={{
                  initial: { opacity: 0 },
                  animate: {
                    opacity: [0, 1, 0],
                    transition: {
                      duration: 4,
                      times: [0, 0.85, 0.875],
                    },
                  },
                }}
                animate={dotGroup3Controls}
              >
                <circle fill="var(--orange)" cx="22" cy="5" r="1.5" />
              </motion.g>
              <motion.g
                opacity={0}
                variants={{
                  initial: { opacity: 0 },
                  animate: {
                    opacity: [0, 1, 0],
                    transition: {
                      duration: 4,
                      times: [0, 0.85, 0.9],
                    },
                  },
                }}
                animate={dotGroup4Controls}
              >
                <circle fill="var(--magenta)" cx="26" cy="2" r="1.5" />
              </motion.g>
            </g>

            {/* Confetti dots - Group 3 (rotated) */}
            <g transform="rotate(102.86,24,24)">
              <motion.g
                opacity={0}
                variants={{
                  initial: { opacity: 0 },
                  animate: {
                    opacity: [0, 1, 0],
                    transition: {
                      duration: 4,
                      times: [0, 0.85, 0.875],
                    },
                  },
                }}
                animate={dotGroup5Controls}
              >
                <circle fill="var(--light-green)" cx="22" cy="5" r="1.5" />
              </motion.g>
              <motion.g
                opacity={0}
                variants={{
                  initial: { opacity: 0 },
                  animate: {
                    opacity: [0, 1, 0],
                    transition: {
                      duration: 4,
                      times: [0, 0.85, 0.9],
                    },
                  },
                }}
                animate={dotGroup6Controls}
              >
                <circle fill="var(--light-teal)" cx="26" cy="2" r="1.5" />
              </motion.g>
            </g>

            {/* Confetti dots - Group 4 (rotated) */}
            <g transform="rotate(154.29,24,24)">
              <motion.g
                opacity={0}
                variants={{
                  initial: { opacity: 0 },
                  animate: {
                    opacity: [0, 1, 0],
                    transition: {
                      duration: 4,
                      times: [0, 0.85, 0.875],
                    },
                  },
                }}
                animate={dotGroup7Controls}
              >
                <circle fill="var(--purple)" cx="22" cy="5" r="1.5" />
              </motion.g>
              <motion.g
                opacity={0}
                variants={{
                  initial: { opacity: 0 },
                  animate: {
                    opacity: [0, 1, 0],
                    transition: {
                      duration: 4,
                      times: [0, 0.85, 0.9],
                    },
                  },
                }}
                animate={dotGroup8Controls}
              >
                <circle fill="var(--magenta)" cx="26" cy="2" r="1.5" />
              </motion.g>
            </g>

            {/* Checkmark */}
            <motion.path
              d="M 17 25 L 22 30 C 22 30 32.2 19.8 37.3 14.7 C 41.8 10.2 39 7.9 39 7.9"
              strokeDasharray="36.7 36.7"
              strokeDashoffset="-36.7"
              initial="initial"
              variants={{
                initial: {
                  strokeDashoffset: -36.7,
                  scale: 1,
                  opacity: 0,
                },
                animate: {
                  strokeDashoffset: [-36.7, 13.7, 13.7, 13.7],
                  scale: [1, 1, 0.4, 1.4, 1],
                  opacity: [0, 0, 1, 1, 1],
                  transition: {
                    duration: 4,
                    times: [0, 0.75, 0.79, 0.87, 0.93],
                    ease: [0.65, 0, 0.35, 1],
                  },
                },
              }}
              animate={checkControls}
            />
          </g>
        </svg>
      </div>
    );
  }
);

LoadingCheckIcon.displayName = 'LoadingCheckIcon';

export { LoadingCheckIcon };
