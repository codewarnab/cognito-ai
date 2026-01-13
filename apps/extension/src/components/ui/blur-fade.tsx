'use client';

import { AnimatePresence, motion, useInView, Variants, HTMLMotionProps } from 'motion/react';
import { useRef, forwardRef, useImperativeHandle } from 'react';

interface BlurFadeProps extends HTMLMotionProps<'div'> {
    children: React.ReactNode;
    className?: string;
    variant?: Variants;
    duration?: number;
    delay?: number;
    yOffset?: number;
    inView?: boolean;
    inViewMargin?: string;
    blur?: string;
}

const BlurFade = forwardRef<HTMLDivElement, BlurFadeProps>(
    (
        {
            children,
            className,
            variant,
            duration = 0.4,
            delay = 0,
            yOffset = 6,
            inView = false,
            inViewMargin = '-50px',
            blur = '6px',
            style,
            ...props
        },
        ref
    ) => {
        const internalRef = useRef(null);

        // Combine refs
        useImperativeHandle(ref, () => internalRef.current!);

        const inViewResult = useInView(internalRef, { once: true, margin: inViewMargin as `${number}px` });
        const isInView = !inView || inViewResult;

        const defaultVariants: Variants = {
            hidden: { y: yOffset, opacity: 0, filter: `blur(${blur})` },
            visible: { y: -yOffset, opacity: 1, filter: `blur(0px)` },
        };

        const combinedVariants = variant || defaultVariants;

        return (
            <AnimatePresence>
                <motion.div
                    ref={internalRef}
                    initial="hidden"
                    animate={isInView ? 'visible' : 'hidden'}
                    exit="hidden"
                    variants={combinedVariants}
                    transition={{
                        delay: 0.04 + delay,
                        duration,
                        ease: 'easeOut',
                    }}
                    className={className}
                    style={style}
                    {...props}
                >
                    {children}
                </motion.div>
            </AnimatePresence>
        );
    }
);

BlurFade.displayName = 'BlurFade';

export default BlurFade;
