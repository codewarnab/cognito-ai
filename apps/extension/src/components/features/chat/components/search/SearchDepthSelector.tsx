/**
 * Search Depth Selector Component
 * Compact dropdown for selecting search depth.
 * Shows as a small pill that expands on click.
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Zap, Search } from 'lucide-react';
import type { SearchDepth } from '@/search/types';

export interface SearchDepthSelectorProps {
    /** Current search depth */
    value: SearchDepth;
    /** Callback when depth changes */
    onChange: (depth: SearchDepth) => void;
    /** Whether the selector is disabled */
    disabled?: boolean;
    /** Additional CSS classes */
    className?: string;
}

interface DepthOption {
    value: SearchDepth;
    label: string;
    description: string;
    icon: React.ReactNode;
}

const DEPTH_OPTIONS: DepthOption[] = [
    {
        value: 'basic',
        label: 'Basic',
        description: 'Quick search, faster results',
        icon: <Zap size={12} />,
    },
    {
        value: 'advanced',
        label: 'Advanced',
        description: 'Thorough search, more results',
        icon: <Search size={12} />,
    },
];

export const SearchDepthSelector: React.FC<SearchDepthSelectorProps> = ({
    value,
    onChange,
    disabled = false,
    className,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const currentOption = DEPTH_OPTIONS.find(opt => opt.value === value) ?? DEPTH_OPTIONS[0]!;

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleSelect = (depth: SearchDepth) => {
        onChange(depth);
        setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setIsOpen(false);
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
        }
    };

    const containerClasses = ['relative', className].filter(Boolean).join(' ');

    return (
        <div ref={containerRef} className={containerClasses}>
            {/* Trigger button */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                aria-label={`Search depth: ${currentOption.label}`}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                className="inline-flex items-center gap-1 py-0.5 px-1.5 rounded text-xs text-[var(--text-secondary)] bg-transparent border-none cursor-pointer transition-all duration-150 hover:bg-[var(--color-surface)] focus:outline-none focus:ring-1 focus:ring-gray-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {currentOption.icon}
                <span className="hidden min-[400px]:inline">{currentOption.label}</span>
                <ChevronDown size={10} className={`transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown menu */}
            {isOpen && (
                <div role="listbox" className="absolute bottom-full left-0 mb-1 min-w-[200px] bg-[#1a1a1a] border border-[var(--border-color)] rounded-lg shadow-[0_10px_15px_-3px_rgba(0,0,0,0.3),0_4px_6px_-2px_rgba(0,0,0,0.2)] py-1 z-50">
                    {DEPTH_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            role="option"
                            aria-selected={option.value === value}
                            onClick={() => handleSelect(option.value)}
                            className={`w-full text-left py-1.5 px-3 flex items-start gap-2 bg-transparent border-none cursor-pointer transition-colors duration-100 text-[var(--text-primary)] hover:bg-[var(--color-surface)] ${option.value === value ? 'bg-[var(--color-surface)]' : ''}`}
                        >
                            <span className="mt-0.5 text-[var(--text-secondary)]">{option.icon}</span>
                            <div>
                                <div className="text-xs font-medium text-[var(--text-primary)]">
                                    {option.label}
                                </div>
                                <div className="text-[10px] text-[var(--text-secondary)] whitespace-nowrap">
                                    {option.description}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SearchDepthSelector;
