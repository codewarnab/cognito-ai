'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
    className?: string;
}

// Animation configuration for top-down rectangle reveal
const createTopDownAnimation = () => {
    const clipPath = {
        from: 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)',
        to: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
    };

    return {
        name: 'rectangle-top-down',
        css: `
            ::view-transition-group(root) {
                animation-duration: 0.7s;
                animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
            }
            
            ::view-transition-new(root) {
                animation-name: reveal-light-top-down;
            }

            ::view-transition-old(root),
            .dark::view-transition-old(root) {
                animation: none;
                z-index: -1;
            }

            .dark::view-transition-new(root) {
                animation-name: reveal-dark-top-down;
            }

            @keyframes reveal-dark-top-down {
                from {
                    clip-path: ${clipPath.from};
                }
                to {
                    clip-path: ${clipPath.to};
                }
            }

            @keyframes reveal-light-top-down {
                from {
                    clip-path: ${clipPath.from};
                }
                to {
                    clip-path: ${clipPath.to};
                }
            }
        `,
    };
};

// Custom hook for fancy theme toggle
const useThemeToggle = () => {
    const { theme, setTheme, resolvedTheme } = useTheme();
    const [isDark, setIsDark] = useState(false);

    // Sync isDark state with resolved theme after hydration
    useEffect(() => {
        setIsDark(resolvedTheme === 'dark');
    }, [resolvedTheme]);

    const styleId = 'theme-transition-styles';

    const updateStyles = useCallback((css: string) => {
        if (typeof window === 'undefined') return;

        let styleElement = document.getElementById(styleId) as HTMLStyleElement;

        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = styleId;
            document.head.appendChild(styleElement);
        }

        styleElement.textContent = css;
    }, []);

    const toggleTheme = useCallback(() => {
        setIsDark(!isDark);

        const animation = createTopDownAnimation();
        updateStyles(animation.css);

        if (typeof window === 'undefined') return;

        const switchTheme = () => {
            setTheme(theme === 'light' ? 'dark' : 'light');
        };

        if (!document.startViewTransition) {
            switchTheme();
            return;
        }

        document.startViewTransition(switchTheme);
    }, [theme, setTheme, updateStyles, isDark, setIsDark]);

    return { isDark, toggleTheme };
};

export function ThemeToggle({ className }: ThemeToggleProps) {
    const [mounted, setMounted] = useState(false);
    const { isDark, toggleTheme } = useThemeToggle();

    // Avoid hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        // Return a placeholder with the same dimensions to prevent layout shift
        return (
            <button
                className={cn(
                    'size-7 cursor-pointer rounded-full bg-black p-0 transition-all duration-300',
                    className
                )}
                aria-label="Toggle theme"
                disabled
            >
                <div className="size-4" />
            </button>
        );
    }

    return (
        <button
            type="button"
            className={cn(
                'size-7 cursor-pointer rounded-full bg-black p-0 transition-all duration-300 active:scale-95',
                className
            )}
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            <span className="sr-only">Toggle theme</span>
            <svg viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
                <motion.g
                    animate={{ rotate: isDark ? -180 : 0 }}
                    transition={{ ease: 'easeInOut', duration: 0.5 }}
                >
                    <path
                        d="M120 67.5C149.25 67.5 172.5 90.75 172.5 120C172.5 149.25 149.25 172.5 120 172.5"
                        fill="white"
                    />
                    <path
                        d="M120 67.5C90.75 67.5 67.5 90.75 67.5 120C67.5 149.25 90.75 172.5 120 172.5"
                        fill="black"
                    />
                </motion.g>
                <motion.path
                    animate={{ rotate: isDark ? 180 : 0 }}
                    transition={{ ease: 'easeInOut', duration: 0.5 }}
                    d="M120 3.75C55.5 3.75 3.75 55.5 3.75 120C3.75 184.5 55.5 236.25 120 236.25C184.5 236.25 236.25 184.5 236.25 120C236.25 55.5 184.5 3.75 120 3.75ZM120 214.5V172.5C90.75 172.5 67.5 149.25 67.5 120C67.5 90.75 90.75 67.5 120 67.5V25.5C172.5 25.5 214.5 67.5 214.5 120C214.5 172.5 172.5 214.5 120 214.5Z"
                    fill="white"
                />
            </svg>
        </button>
    );
}

/**
 * Theme Toggle with View Transition API
 * Uses top-down rectangle animation for theme switching.
 * Inspired by https://github.com/rudrodip/theme-toggle-effect
 * 
 * This uses the View Transitions API: https://developer.chrome.com/docs/web-platform/view-transitions/
 */
