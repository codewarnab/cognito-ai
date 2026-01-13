/**
 * Search Input Component
 * 
 * Search field for filtering models in the popover
 */

import React from 'react';
import { Search } from 'lucide-react';

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    inputRef: React.RefObject<HTMLInputElement | null>;
}

export const SearchInput: React.FC<SearchInputProps> = ({
    value,
    onChange,
    onKeyDown,
    inputRef,
}) => {
    return (
        <div className="px-2.5 pt-2.5 pb-1.5">
            <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="Search models..."
                    className="w-full h-8 pl-8 pr-3 bg-input border border-border rounded-lg text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:bg-accent transition-all"
                    onKeyDown={onKeyDown}
                />
            </div>
        </div>
    );
};

export default SearchInput;
