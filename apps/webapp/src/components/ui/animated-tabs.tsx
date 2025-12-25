"use client";

import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

export type AnimatedTab = {
    name: string;
    icon?: React.ReactNode;
    content: React.ReactNode;
};

interface AnimatedTabsProps {
    tabs: AnimatedTab[];
    defaultSelected?: number;
    className?: string;
    tabsClassName?: string;
    contentClassName?: string;
    onChange?: (index: number) => void;
}

interface IndicatorPosition {
    left: number;
    width: number;
}

export function AnimatedTabs({
    tabs,
    defaultSelected = 0,
    className,
    tabsClassName,
    contentClassName,
    onChange,
}: AnimatedTabsProps) {
    const [selected, setSelected] = useState(defaultSelected);
    const [direction, setDirection] = useState(0);
    const [indicator, setIndicator] = useState<IndicatorPosition>({ left: 0, width: 0 });
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    // Calculate indicator position using getBoundingClientRect for accuracy
    const updateIndicator = () => {
        const container = containerRef.current;
        const activeTab = tabRefs.current[selected];

        if (!container || !activeTab) return;

        const containerRect = container.getBoundingClientRect();
        const tabRect = activeTab.getBoundingClientRect();

        setIndicator({
            left: tabRect.left - containerRect.left,
            width: tabRect.width,
        });
    };

    // Use useLayoutEffect to avoid flicker on initial render
    useLayoutEffect(() => {
        updateIndicator();
    }, [selected, tabs]);

    useEffect(() => {
        window.addEventListener("resize", updateIndicator);
        return () => window.removeEventListener("resize", updateIndicator);
    }, [selected]);

    const handleSelect = (index: number) => {
        setDirection(index > selected ? 1 : -1);
        setSelected(index);
        onChange?.(index);
    };

    const slideVariants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 20 : -20,
            opacity: 0,
        }),
        center: {
            x: 0,
            opacity: 1,
        },
        exit: (direction: number) => ({
            x: direction > 0 ? -20 : 20,
            opacity: 0,
        }),
    };

    return (
        <div className={cn("w-full", className)}>
            {/* Tab Buttons */}
            <div
                ref={containerRef}
                className={cn(
                    "relative flex rounded-xl bg-[var(--bg-secondary)] p-1",
                    tabsClassName
                )}
            >
                {/* Sliding Background Indicator */}
                {indicator.width > 0 && (
                    <motion.div
                        className="absolute top-1 bottom-1 rounded-lg bg-[var(--bg-tertiary)] shadow-sm"
                        initial={false}
                        animate={{
                            left: indicator.left,
                            width: indicator.width,
                        }}
                        transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 30,
                        }}
                    />
                )}

                {tabs.map(({ name, icon }, i) => (
                    <button
                        key={i}
                        ref={(el) => {
                            tabRefs.current[i] = el;
                        }}
                        onClick={() => handleSelect(i)}
                        className={cn(
                            "relative z-10 flex flex-1 items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-stride)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-secondary)]",
                            i === selected
                                ? "text-[var(--text-primary)]"
                                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        )}
                    >
                        {icon && (
                            <span
                                className={cn(
                                    "transition-colors flex-shrink-0",
                                    i === selected
                                        ? "text-[var(--green-pulse)]"
                                        : "text-[var(--text-secondary)]"
                                )}
                            >
                                {icon}
                            </span>
                        )}
                        <span>{name}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className={cn("relative mt-4 overflow-hidden", contentClassName)}>
                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={selected}
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{
                            x: { type: "spring", stiffness: 300, damping: 30 },
                            opacity: { duration: 0.2 },
                        }}
                    >
                        {tabs[selected]?.content}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

// Export a simpler version with fixed height container for backwards compatibility
export function AnimatedTabsFixed({
    tabs,
    defaultSelected = 0,
    className,
    height = "8rem",
}: {
    tabs: AnimatedTab[];
    defaultSelected?: number;
    className?: string;
    height?: string;
}) {
    return (
        <AnimatedTabs
            tabs={tabs}
            defaultSelected={defaultSelected}
            className={className}
            contentClassName={`min-h-[${height}]`}
        />
    );
}
