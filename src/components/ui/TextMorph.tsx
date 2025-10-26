import React, { useMemo, useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Transition, Variants } from 'framer-motion';

export type TextMorphProps = {
    children: string;
    as?: React.ElementType;
    className?: string;
    style?: React.CSSProperties;
    variants?: Variants;
    transition?: Transition;
};

export function TextMorph({
    children,
    as: Component = 'span',
    className,
    style,
    variants,
    transition,
}: TextMorphProps) {
    const uniqueId = useId();

    const words = useMemo(() => {
        const charCounts: Record<string, number> = {};
        const wordList: Array<{ id: string; label: string; isSpace: boolean }[]> = [];
        const textWords = children.split(' ');

        textWords.forEach((word, wordIndex) => {
            const wordChars = word.split('').map((char) => {
                const lowerChar = char.toLowerCase();
                charCounts[lowerChar] = (charCounts[lowerChar] || 0) + 1;

                return {
                    id: `${uniqueId}-${lowerChar}${charCounts[lowerChar]}`,
                    label: char,
                    isSpace: false,
                };
            });

            wordList.push(wordChars);

            // Add space after word (except for last word)
            if (wordIndex < textWords.length - 1) {
                charCounts['space'] = (charCounts['space'] || 0) + 1;
                wordList.push([{
                    id: `${uniqueId}-space${charCounts['space']}`,
                    label: '\u00A0',
                    isSpace: true,
                }]);
            }
        });

        return wordList;
    }, [children, uniqueId]);

    const defaultVariants: Variants = {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
    };

    const defaultTransition: Transition = {
        // Type of animation physics model
        // 'spring' creates natural, bouncy motion (vs 'tween' for linear interpolation)
        type: 'tween',

        // Stiffness: Controls how "tight" the spring is (10-500 typical range)
        // Higher values (100+) = faster, snappier animations with more bounce
        // Lower values (10-50) = slower, more gradual, fluid animations
        // Current: 50 = smooth, moderate speed animation
        stiffness: 80,

        // Damping: Controls resistance/friction that slows the spring (0-100 typical range)
        // Higher values (50+) = less oscillation, comes to rest quickly (overdamped)
        // Lower values (5-20) = more bouncy, overshoots target multiple times (underdamped)
        // Current: 25 = balanced with slight bounce before settling
        damping: 35,

        // Mass: Simulates weight of the animated element (0.1-5 typical range)
        // Higher values (2+) = feels heavier, slower to start/stop, more momentum
        // Lower values (0.1-1) = feels lighter, responds quickly to forces
        // Current: 1.2 = slightly heavier than default (1), subtle inertia effect
        mass: 1.2,
    };

    return (
        <Component className={className} aria-label={children} style={{ ...style, display: 'inline' }}>
            <AnimatePresence mode="popLayout" initial={false}>
                {words.map((word, wordIndex) => (
                    <span key={`word-${wordIndex}`} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
                        {word.map((character) => (
                            <motion.span
                                key={character.id}
                                layoutId={character.id}
                                style={{ display: 'inline-block' }}
                                aria-hidden="true"
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                variants={variants || defaultVariants}
                                transition={transition || defaultTransition}
                            >
                                {character.label}
                            </motion.span>
                        ))}
                    </span>
                ))}
            </AnimatePresence>
        </Component>
    );
}
