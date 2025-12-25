'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

interface SettingsSearchProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export function SettingsSearch({
    value,
    onChange,
    placeholder = "Search settings...",
    className
}: SettingsSearchProps) {
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleClear = useCallback(() => {
        onChange('');
        inputRef.current?.focus();
    }, [onChange]);

    // Handle keyboard shortcut (Ctrl/Cmd + K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
            }
            // Clear on Escape
            if (e.key === 'Escape' && document.activeElement === inputRef.current) {
                handleClear();
                inputRef.current?.blur();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleClear]);

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={cn("relative", className)}
        >
            <div
                className={cn(
                    "relative flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all duration-200",
                    "bg-[var(--bg-secondary)] border border-[var(--border-color)]",
                    isFocused && "border-[var(--blue-stride)] ring-2 ring-[var(--blue-stride)]/20"
                )}
            >
                <Search
                    size={16}
                    className={cn(
                        "shrink-0 transition-colors duration-200",
                        isFocused ? "text-[var(--blue-stride)]" : "text-[var(--text-tertiary)]"
                    )}
                />

                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder={placeholder}
                    className={cn(
                        "flex-1 bg-transparent border-none outline-none",
                        "text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                    )}
                />

                <AnimatePresence>
                    {value && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.15 }}
                            onClick={handleClear}
                            className={cn(
                                "p-1 rounded-md transition-colors cursor-pointer",
                                "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]",
                                "hover:bg-[var(--bg-tertiary)]"
                            )}
                        >
                            <X size={14} />
                        </motion.button>
                    )}
                </AnimatePresence>

                <div className="hidden sm:flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] shrink-0">
                    <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                        ⌘
                    </kbd>
                    <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                        K
                    </kbd>
                </div>
            </div>

            {/* Search results count indicator */}
            <AnimatePresence>
                {value && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <p className="text-xs text-[var(--text-tertiary)] mt-2 px-1">
                            Showing settings matching "<span className="text-[var(--blue-stride)]">{value}</span>"
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
