/**
 * Search Depth Selector Component
 * Compact dropdown for selecting search depth.
 * Shows as a small pill that expands on click.
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Zap, Search } from 'lucide-react';
import type { SearchDepth } from '@/search/types';
import '@/styles/features/search/search-depth-selector.css';

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

    const currentOption = DEPTH_OPTIONS.find(opt => opt.value === value) || DEPTH_OPTIONS[0];

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

    const containerClasses = ['search-depth-selector', className].filter(Boolean).join(' ');
    const chevronClasses = [
        'search-depth-selector__chevron',
        isOpen && 'search-depth-selector__chevron--open',
    ].filter(Boolean).join(' ');

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
                className="search-depth-selector__trigger"
            >
                {currentOption.icon}
                <span className="search-depth-selector__trigger-label">{currentOption.label}</span>
                <ChevronDown size={10} className={chevronClasses} />
            </button>

            {/* Dropdown menu */}
            {isOpen && (
                <div role="listbox" className="search-depth-selector__dropdown">
                    {DEPTH_OPTIONS.map((option) => {
                        const optionClasses = [
                            'search-depth-selector__option',
                            option.value === value && 'search-depth-selector__option--selected',
                        ].filter(Boolean).join(' ');

                        return (
                            <button
                                key={option.value}
                                type="button"
                                role="option"
                                aria-selected={option.value === value}
                                onClick={() => handleSelect(option.value)}
                                className={optionClasses}
                            >
                                <span className="search-depth-selector__option-icon">{option.icon}</span>
                                <div>
                                    <div className="search-depth-selector__option-label">
                                        {option.label}
                                    </div>
                                    <div className="search-depth-selector__option-description">
                                        {option.description}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SearchDepthSelector;
