import { ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';
import React from 'react';

interface AnimatedAccordionProps {
    title: string;
    description?: string;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

export function AnimatedAccordion({
    children,
    title,
    description,
    isOpen,
    onToggle,
}: AnimatedAccordionProps) {
    return (
        <motion.div
            layout
            className={cn(
                "bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl overflow-hidden transition-colors",
                isOpen && "bg-[var(--bg-tertiary)]"
            )}
        >
            <div className="p-4">
                <button
                    className="flex items-center justify-between w-full text-left cursor-pointer"
                    onClick={onToggle}
                    aria-expanded={isOpen}
                >
                    <div className='flex flex-col gap-0.5'>
                        <span className="text-sm font-medium text-[var(--text-primary)] pr-4">{title}</span>
                        {description && <span className="text-xs text-[var(--text-secondary)]">{description}</span>}
                    </div>
                    <motion.span
                        animate={{ rotate: isOpen ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-[var(--text-secondary)] shrink-0"
                    >
                        <ChevronRight size={16} />
                    </motion.span>
                </button>
                <AnimatePresence initial={false}>
                    {isOpen && (
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: "auto" }}
                            exit={{ height: 0 }}
                            transition={{
                                type: "spring",
                                stiffness: 180,
                                damping: 26,
                            }}
                            className="overflow-hidden"
                        >
                            <motion.div
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 4 }}
                                transition={{ duration: 0.2 }}
                                className="pt-4"
                            >
                                {children}
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
