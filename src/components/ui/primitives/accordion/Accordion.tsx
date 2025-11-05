import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import './Accordion.css';

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
            <div className="accordion" data-slot="accordion">
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
            <div className="accordion-item" data-slot="accordion-item">
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
        <div className="accordion-header">
            <button
                className="accordion-trigger"
                data-slot="accordion-trigger"
                data-state={itemContext.isOpen ? 'open' : 'closed'}
                onClick={handleClick}
                type="button"
            >
                {children}
                <ChevronDownIcon
                    className="accordion-chevron"
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
            className="accordion-content"
            data-slot="accordion-content"
            data-state={itemContext.isOpen ? 'open' : 'closed'}
            style={{
                height: itemContext.isOpen ? `${height}px` : '0px',
            }}
        >
            <div className="accordion-content-inner" ref={contentRef}>
                {children}
            </div>
        </div>
    );
}
