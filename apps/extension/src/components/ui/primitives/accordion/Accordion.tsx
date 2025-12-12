import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from 'lucide-react';

interface AccordionProps {
    type?: 'single' | 'multiple';
    children: React.ReactNode;
    defaultValue?: string | string[];
}

interface AccordionItemProps {
    value: string;
    children: React.ReactNode;
}

interface AccordionTriggerProps {
    children: React.ReactNode;
}

interface AccordionContentProps {
    children: React.ReactNode;
}

interface AccordionContextValue {
    type: 'single' | 'multiple';
    openItems: Set<string>;
    toggleItem: (value: string) => void;
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null);

const AccordionItemContext = React.createContext<{ value: string; isOpen: boolean } | null>(null);

export function Accordion({ type = 'single', children, defaultValue }: AccordionProps) {
    const [openItems, setOpenItems] = useState<Set<string>>(() => {
        if (defaultValue) {
            return new Set(Array.isArray(defaultValue) ? defaultValue : [defaultValue]);
        }
        return new Set();
    });

    const toggleItem = (value: string) => {
        setOpenItems(prev => {
            const newSet = new Set(prev);
            if (type === 'single') {
                if (newSet.has(value)) {
                    newSet.clear();
                } else {
                    newSet.clear();
                    newSet.add(value);
                }
            } else {
                if (newSet.has(value)) {
                    newSet.delete(value);
                } else {
                    newSet.add(value);
                }
            }
            return newSet;
        });
    };

    return (
        <AccordionContext.Provider value={{ type, openItems, toggleItem }}>
            <div className="w-full" data-slot="accordion">
                {children}
            </div>
        </AccordionContext.Provider>
    );
}

export function AccordionItem({ value, children }: AccordionItemProps) {
    const context = React.useContext(AccordionContext);
    if (!context) throw new Error('AccordionItem must be used within Accordion');

    const isOpen = context.openItems.has(value);

    return (
        <AccordionItemContext.Provider value={{ value, isOpen }}>
            <div className="border-b border-[var(--border-color)] last:border-b-0" data-slot="accordion-item">
                {children}
            </div>
        </AccordionItemContext.Provider>
    );
}

export function AccordionTrigger({ children }: AccordionTriggerProps) {
    const accordionContext = React.useContext(AccordionContext);
    const itemContext = React.useContext(AccordionItemContext);

    if (!accordionContext || !itemContext) {
        throw new Error('AccordionTrigger must be used within AccordionItem');
    }

    const handleClick = () => {
        accordionContext.toggleItem(itemContext.value);
    };

    return (
        <div className="flex">
            <button
                className="flex flex-1 items-start justify-between gap-4 py-4 bg-transparent border-none rounded-md text-[var(--text-primary)] text-sm font-medium text-left cursor-pointer outline-none transition-all duration-200 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] focus-visible:outline-offset-2 focus-visible:shadow-[0_0_0_3px_rgba(198,254,30,0.1)] disabled:pointer-events-none disabled:opacity-50"
                data-slot="accordion-trigger"
                data-state={itemContext.isOpen ? 'open' : 'closed'}
                onClick={handleClick}
                type="button"
            >
                {children}
                <ChevronDownIcon
                    className={`flex-shrink-0 text-[var(--text-tertiary)] transition-transform duration-200 ${itemContext.isOpen ? 'rotate-180 -translate-y-0.5' : 'translate-y-0.5'
                        }`}
                    size={16}
                />
            </button>
        </div>
    );
}

export function AccordionContent({ children }: AccordionContentProps) {
    const itemContext = React.useContext(AccordionItemContext);
    const contentRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState<number>(0);

    if (!itemContext) {
        throw new Error('AccordionContent must be used within AccordionItem');
    }

    useEffect(() => {
        if (contentRef.current) {
            setHeight(contentRef.current.scrollHeight);
        }
    }, [children]);

    return (
        <div
            className="overflow-hidden text-sm transition-[height] duration-200"
            data-slot="accordion-content"
            data-state={itemContext.isOpen ? 'open' : 'closed'}
            style={{
                height: itemContext.isOpen ? `${height}px` : '0px',
            }}
        >
            <div className="pt-0 pb-4 text-[var(--text-secondary)] leading-relaxed" ref={contentRef}>
                {children}
            </div>
        </div>
    );
}
