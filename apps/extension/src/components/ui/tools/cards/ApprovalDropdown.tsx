/**
 * ApprovalDropdown - Dropdown component for tool approval with auto-approve options
 *
 * Provides a split button with:
 * - Main "Allow" button for one-time approval
 * - Dropdown arrow for auto-approve options
 */

import { useState, useRef, useEffect } from 'react';

export interface ApprovalOption {
    id: 'session' | 'website' | 'always';
    label: string;
    description?: string;
    onClick: () => void;
}

interface ApprovalDropdownProps {
    /** Callback for one-time approval (main button click) */
    onApprove: () => void;
    /** Callback for deny action */
    onDeny: () => void;
    /** Auto-approve options to show in dropdown */
    options: ApprovalOption[];
    /** Whether dropdown is disabled */
    disabled?: boolean;
}

export function ApprovalDropdown({
    onApprove,
    onDeny,
    options,
    disabled = false,
}: ApprovalDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleOptionClick = (option: ApprovalOption) => {
        option.onClick();
        setIsOpen(false);
    };

    return (
        <div className="approval-dropdown-container flex items-center gap-2">
            {/* Main Allow button with dropdown */}
            <div ref={dropdownRef} className="relative inline-flex">
                {/* Split button group */}
                <div className="flex rounded-md overflow-hidden shadow-sm">
                    {/* Main Allow button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onApprove();
                        }}
                        disabled={disabled}
                        className="px-3 py-1 text-xs font-medium 
              bg-green-600 hover:bg-green-700 text-white cursor-pointer
              transition-colors duration-150 flex items-center gap-1
              disabled:opacity-50 disabled:cursor-not-allowed
              border-r border-green-700"
                    >
                        ✓ Allow
                    </button>

                    {/* Dropdown arrow button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(!isOpen);
                        }}
                        disabled={disabled}
                        className="px-1.5 py-1 text-xs font-medium
              bg-green-600 hover:bg-green-700 text-white cursor-pointer
              transition-colors duration-150
              disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="More approval options"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={`transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>
                </div>

                {/* Dropdown menu - minimal style */}
                {isOpen && (
                    <div
                        className="absolute top-full left-0 mt-1 z-50 min-w-[160px]
              bg-[var(--dropdown-bg,#1e293b)] border border-[var(--dropdown-border,#334155)]
              rounded-md shadow-lg py-0.5 animate-in fade-in slide-in-from-top-1 duration-150"
                    >
                        {options.map((option) => (
                            <button
                                key={option.id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOptionClick(option);
                                }}
                                className="w-full px-2.5 py-1.5 text-left text-[11px]
                  text-[var(--text-primary,#e2e8f0)] hover:bg-[var(--dropdown-hover,#334155)]
                  cursor-pointer transition-colors duration-150"
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Deny button */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDeny();
                }}
                disabled={disabled}
                className="px-3 py-1 text-xs font-medium rounded-md
          bg-red-600 hover:bg-red-700 text-white cursor-pointer
          transition-colors duration-150 flex items-center gap-1
          disabled:opacity-50 disabled:cursor-not-allowed"
            >
                ✕ Deny
            </button>
        </div>
    );
}
