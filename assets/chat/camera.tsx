import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { motion, useAnimation, type Variants } from 'framer-motion';

export interface CameraIconHandle {
    startAnimation: () => void;
    stopAnimation: () => void;
}

interface CameraIconProps extends React.HTMLAttributes<HTMLDivElement> {
    size?: number;
}

const bodyVariants: Variants = {
    normal: {
        rotate: 0,
        scale: 1,
        y: 0,
    },
    animate: {
        rotate: [0, -3, 3, -1, 0],
        scale: [1, 1.02, 1],
        y: [0, -1, 0],
        transition: {
            duration: 0.6,
            ease: 'easeInOut',
            times: [0, 0.2, 0.5, 0.8, 1],
        },
    },
};

const lensVariants: Variants = {
    normal: {
        scale: 1,
        opacity: 1,
    },
    animate: {
        scale: [1, 0.8, 1.1, 1],
        opacity: [1, 0.8, 1],
        transition: {
            duration: 0.6,
            ease: 'easeInOut',
            times: [0, 0.3, 0.7, 1],
        },
    },
};

const CameraIcon = forwardRef<CameraIconHandle, CameraIconProps>(
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
                style={{
                    cursor: 'pointer',
                    userSelect: 'none',
                    padding: '0.5rem',
                    borderRadius: '0.375rem',
                    transition: 'background-color 200ms, color 200ms',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...(props.style || {})
                }}
                className={className}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--accent-color, rgba(0, 0, 0, 0.05))';
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                }}
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
                    <motion.g
                        variants={bodyVariants}
                        animate={controls}
                        initial="normal"
                        style={{ originX: '12px', originY: '12px' }}
                    >
                        <path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z" />
                        <motion.circle
                            cx="12"
                            cy="13"
                            r="3"
                            variants={lensVariants}
                            animate={controls}
                            initial="normal"
                            style={{ originX: '12px', originY: '13px' }}
                        />
                    </motion.g>
                </svg>
            </div>
        );
    }
);

CameraIcon.displayName = 'CameraIcon';

export { CameraIcon };
